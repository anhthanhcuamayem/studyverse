"""Mobile Viewport & iOS Safari Optimization Test Suite (iPhone 11 Pro).

Covers Tiers 1-4 (+ Tier 5 Boundary/Reflow) verifying:
- Tier 1: Viewport meta tag with viewport-fit=cover, width=device-width, initial-scale=1 across all core pages & route aliases (R1)
- Tier 2: Safe area insets (env(safe-area-inset-top) & env(safe-area-inset-bottom)) in fixed headers, footers, toolbars & content offsets (R1)
- Tier 3: Dynamic viewport height (100dvh) with fallback (100vh) across full-height views (R1)
- Tier 4: Mobile form input font-size >= 16px to prevent iOS Safari auto-zoom on focus (R3)
- Tier 5 / Boundary: Responsive reflow & 375px horizontal boundary integrity (R2 & R4)

Authoritative sources: ORIGINAL_REQUEST.md, PROJECT.md.
Device Profile: iPhone 11 Pro (375x812 pt viewport, Notch: ~44px, Home Indicator: ~34px, iOS Safari).
"""

import re
from pathlib import Path
import pytest
from app import app as flask_app

BASE_DIR = Path(__file__).resolve().parent.parent

CORE_PAGES = [
    'index.html',
    'account.html',
    'career/chat.html',
    'flashcard/flashcard.html',
    'schedule/create.html',
    'todo/mylist.html',
    'config-preview.html',
]

ROUTE_ALIASES = [
    '/',
    '/account',
    '/career',
    '/schedule',
    '/todo',
    '/flashcard',
]


@pytest.fixture
def client():
    """Flask test client fixture configured for testing."""
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as test_client:
        yield test_client


def _get_viewport_meta_content(html: str) -> str:
    """Extract content string from <meta name="viewport" content="...">."""
    match = re.search(
        r'<meta\s+[^>]*name=["\']viewport["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        re.IGNORECASE,
    )
    if not match:
        match = re.search(
            r'<meta\s+[^>]*content=["\']([^"\']+)["\'][^>]*name=["\']viewport["\']',
            html,
            re.IGNORECASE,
        )
    return match.group(1).lower() if match else ''


# ==============================================================================
# ZERO-DEPENDENCY BRACE-BALANCED CSS PARSER HELPERS
# ==============================================================================

def _extract_media_blocks(css: str, max_width_threshold: int | None = 768) -> list[tuple[str, str, int | None]]:
    """Extract all @media blocks from CSS with balanced nested brace tracking.
    Handles comments and string literals to prevent bracket mismatch.
    Returns list of tuples: (media_condition, interior_block_body, max_width_px).
    """
    results = []
    pattern = re.compile(r'@media\s*([^{]+)\{', re.IGNORECASE)
    pos = 0
    n = len(css)
    while pos < n:
        match = pattern.search(css, pos)
        if not match:
            break
        query = match.group(1).strip()
        start = match.end()
        depth = 1
        i = start
        in_string = False
        str_ch = ''
        in_comment = False
        while i < n and depth > 0:
            c = css[i]
            if in_comment:
                if c == '*' and i + 1 < n and css[i + 1] == '/':
                    in_comment = False
                    i += 2
                    continue
            elif in_string:
                if c == '\\':
                    i += 2
                    continue
                elif c == str_ch:
                    in_string = False
            else:
                if c == '/' and i + 1 < n and css[i + 1] == '*':
                    in_comment = True
                    i += 2
                    continue
                elif c in ('"', "'"):
                    in_string = True
                    str_ch = c
                elif c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        body = css[start:i]
                        mw_match = re.search(r'max-width:\s*(\d+)px', query, re.IGNORECASE)
                        mw_val = int(mw_match.group(1)) if mw_match else None
                        if max_width_threshold is None or (mw_val is not None and mw_val <= max_width_threshold):
                            results.append((query, body, mw_val))
                        pos = i + 1
                        break
            i += 1
        else:
            pos = start + 1
    return results


def _extract_rule_declarations(css_text: str, selector_pattern: str) -> list[str]:
    """Find all declaration bodies { ... } for a selector matching selector_pattern within CSS text."""
    pattern = re.compile(r'(?:^|[,\s;}])(' + selector_pattern + r')[^{]*\{([^}]+)\}', re.MULTILINE)
    return [m.group(2).strip() for m in pattern.finditer(css_text)]


def _get_rule_declaration(css_block: str, selector_pattern: str, prop: str = "font-size") -> str | None:
    """Find rule matching selector_pattern in css_block and extract property declaration value."""
    decls = _extract_rule_declarations(css_block, selector_pattern)
    for body in decls:
        decl = re.search(rf"\b{prop}\s*:\s*([^;!]+)", body, re.IGNORECASE)
        if decl:
            return decl.group(1).strip()
    return None


def _parse_font_size_px(val: str | None) -> float | None:
    """Extract font-size value and convert to numeric px (assuming 1rem/1em = 16px)."""
    if not val:
        return None
    m = re.search(r'([0-9.]+)\s*(px|rem|em)', val, re.IGNORECASE)
    if not m:
        return None
    num, unit = float(m.group(1)), m.group(2).lower()
    return num if unit == 'px' else num * 16.0


def _is_font_size_ge_16(val: str | None) -> bool:
    """Check if font-size declaration string is >= 16px (supports px, rem, em)."""
    px = _parse_font_size_px(val)
    if px is None:
        return False
    return px >= 16.0


def _get_effective_mobile_font_size(css: str, selector_pattern: str, max_width_limit: int = 768) -> str | None:
    """Evaluate effective mobile font size: mobile query override first, then base rule."""
    media_blocks = _extract_media_blocks(css, max_width_threshold=max_width_limit)
    for _, block, _ in media_blocks:
        val = _get_rule_declaration(block, selector_pattern, "font-size")
        if val is not None:
            return val
    return _get_rule_declaration(css, selector_pattern, "font-size")


def assert_viewport_fallback_order(css: str, selector: str) -> None:
    """Assert that 100vh strictly precedes 100dvh within selector's rule block, and no inverted order exists."""
    decls = _extract_rule_declarations(css, selector)
    assert len(decls) > 0, f"Selector '{selector}' not found in stylesheet"

    found_order = False
    for block in decls:
        vh_pos = block.find('100vh')
        dvh_pos = block.find('100dvh')
        if vh_pos != -1 and dvh_pos != -1:
            assert vh_pos < dvh_pos, (
                f"Selector '{selector}': 100vh fallback must appear BEFORE 100dvh in declaration order"
            )
            found_order = True
    assert found_order, f"Selector '{selector}' must declare both 100vh and 100dvh"

    for match in re.finditer(r'\{([^}]+)\}', css):
        body = match.group(1)
        if '100dvh' in body and '100vh' in body:
            assert body.find('100vh') < body.find('100dvh'), (
                f"Inverted order detected: 100dvh appears before 100vh in declaration: {body}"
            )


# ==============================================================================
# TIER 1: VIEWPORT META TAG & GEOMETRY (R1)
# ==============================================================================

@pytest.mark.parametrize('page', CORE_PAGES)
def test_tier1_meta_viewport_present_all_core_pages(client, page):
    """R1: Every core page must contain a <meta name="viewport"> tag when served."""
    resp = client.get('/' + page)
    assert resp.status_code == 200, f"Page {page} must return HTTP 200"
    html = resp.data.decode('utf-8')
    content = _get_viewport_meta_content(html)
    assert content != '', f"Page {page} must contain a viewport meta tag"


@pytest.mark.parametrize('page', CORE_PAGES)
def test_tier1_meta_viewport_properties_all_core_pages(client, page):
    """R1: Viewport meta tag must declare width=device-width, initial-scale=1, and viewport-fit=cover."""
    resp = client.get('/' + page)
    assert resp.status_code == 200, f"Page {page} must return HTTP 200"
    html = resp.data.decode('utf-8')
    content = _get_viewport_meta_content(html)

    assert 'width=device-width' in content, f"Page {page} viewport meta tag must include width=device-width"
    assert 'initial-scale=1' in content, f"Page {page} viewport meta tag must include initial-scale=1"
    assert 'viewport-fit=cover' in content, (
        f"Page {page} viewport meta tag must include viewport-fit=cover for iPhone 11 Pro notch and safe areas"
    )


@pytest.mark.parametrize('route', ROUTE_ALIASES)
def test_tier1_meta_viewport_route_aliases(client, route):
    """R1: All clean route aliases must serve HTML with viewport-fit=cover."""
    resp = client.get(route)
    assert resp.status_code == 200, f"Route {route} must return HTTP 200"
    html = resp.data.decode('utf-8')
    content = _get_viewport_meta_content(html)
    assert 'viewport-fit=cover' in content, f"Route {route} must include viewport-fit=cover in viewport meta tag"


@pytest.mark.parametrize('page', CORE_PAGES)
def test_tier1_meta_viewport_on_disk_source_files(page):
    """R1: Raw on-disk HTML source files must persistently declare viewport-fit=cover."""
    file_path = BASE_DIR / page
    assert file_path.is_file(), f"HTML file {page} must exist on disk"
    html = file_path.read_text(encoding='utf-8')
    content = _get_viewport_meta_content(html)
    assert 'viewport-fit=cover' in content, f"Source file {page} must persistently include viewport-fit=cover"


# ==============================================================================
# TIER 2: SAFE AREA INSETS (TOP NOTCH & BOTTOM HOME INDICATOR) (R1)
# ==============================================================================

def test_tier2_safe_area_top_shared_navbar():
    """R1: Fixed navbar in shared.css must use safe-area-inset-top to avoid clipping under the iPhone 11 Pro notch."""
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    navbar_decls = _extract_rule_declarations(css, r'\.navbar')
    assert len(navbar_decls) > 0, "shared.css must define .navbar rule"
    assert any('safe-area-inset-top' in decl for decl in navbar_decls), (
        "shared.css .navbar rule must declare safe-area-inset-top"
    )


def test_tier2_safe_area_top_navbar_height():
    """R1: Fixed navbar height or padding in shared.css must compute with safe-area-inset-top."""
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    navbar_decls = _extract_rule_declarations(css, r'\.navbar')
    has_safe_height_or_pad = any(
        re.search(r'calc\([^)]*safe-area-inset-top', decl) or
        re.search(r'padding-top:\s*env\(safe-area-inset-top', decl)
        for decl in navbar_decls
    )
    assert has_safe_height_or_pad, (
        "shared.css .navbar rule must calculate height or padding-top with safe-area-inset-top"
    )


def test_tier2_safe_area_top_account_topbar():
    """R1: Account topbar in account.css must account for safe-area-inset-top."""
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.account-topbar')
    assert len(decls) > 0, "account.css must define .account-topbar rule"
    assert any('safe-area-inset-top' in decl for decl in decls), (
        "account.css .account-topbar must declare safe-area-inset-top"
    )


def test_tier2_safe_area_top_offset_homepage_content():
    """R1: Homepage .main-content in style.css must adjust top offset for safe-area-inset-top."""
    css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.main-content')
    assert len(decls) > 0, "style.css must define .main-content rule"
    assert any('safe-area-inset-top' in decl for decl in decls), (
        "style.css .main-content must account for safe-area-inset-top in top padding"
    )


def test_tier2_safe_area_top_offset_career_chat():
    """R1: Career Chat container (.main-career) in career/chat.css must adjust for safe-area-inset-top."""
    css = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.main-career')
    assert len(decls) > 0, "career/chat.css must define .main-career rule"
    assert any('safe-area-inset-top' in decl for decl in decls), (
        "career/chat.css .main-career must account for safe-area-inset-top in top padding"
    )


def test_tier2_safe_area_top_offset_schedule():
    """R1: Schedule container (.main-schedule) in schedule/create.css must adjust for safe-area-inset-top."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.main-schedule')
    assert len(decls) > 0, "schedule/create.css must define .main-schedule rule"
    assert any('safe-area-inset-top' in decl for decl in decls), (
        "schedule/create.css .main-schedule must account for safe-area-inset-top in top padding"
    )


def test_tier2_safe_area_top_offset_todo():
    """R1: Todo container (.project-wrapper) in todo/mylist.css must adjust for safe-area-inset-top."""
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.project-wrapper')
    assert len(decls) > 0, "todo/mylist.css must define .project-wrapper rule"
    assert any('safe-area-inset-top' in decl for decl in decls), (
        "todo/mylist.css .project-wrapper must account for safe-area-inset-top in padding/margin"
    )


def test_tier2_safe_area_top_offset_flashcards():
    """R1: Flashcards container (.fc-main) in flashcard/flashcard.css must adjust for safe-area-inset-top."""
    css = (BASE_DIR / 'flashcard/flashcard.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.fc-main')
    assert len(decls) > 0, "flashcard/flashcard.css must define .fc-main rule"
    assert any('safe-area-inset-top' in decl for decl in decls), (
        "flashcard/flashcard.css .fc-main must account for safe-area-inset-top in top padding"
    )


def test_tier2_safe_area_bottom_shared_guest_notice():
    """R1: Guest notice (.sv-guest-notice) in shared.css must include safe-area-inset-bottom to avoid iOS Home Indicator."""
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.sv-guest-notice')
    assert len(decls) > 0, "shared.css must define .sv-guest-notice rule"
    assert any('safe-area-inset-bottom' in decl for decl in decls), (
        "shared.css .sv-guest-notice rule must declare safe-area-inset-bottom"
    )


def test_tier2_safe_area_bottom_account_footer():
    """R1: Account footer or shell in account.css must include safe-area-inset-bottom."""
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.account-footer|\.account-shell')
    assert len(decls) > 0, "account.css must define .account-footer or .account-shell rule"
    assert any('safe-area-inset-bottom' in decl for decl in decls), (
        "account.css (.account-footer or .account-shell) must declare safe-area-inset-bottom"
    )


def test_tier2_safe_area_bottom_career_chat_input():
    """R1: Career Chat input toolbar (.chat-input-area) must include safe-area-inset-bottom."""
    css = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.chat-input-area|\.main-career')
    assert len(decls) > 0, "career/chat.css must define .chat-input-area or .main-career rule"
    assert any('safe-area-inset-bottom' in decl for decl in decls), (
        "career/chat.css must declare safe-area-inset-bottom for bottom area"
    )


def test_tier2_safe_area_bottom_schedule_page():
    """R1: Schedule main container/toolbar in schedule/create.css must include safe-area-inset-bottom."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.main-schedule')
    assert len(decls) > 0, "schedule/create.css must define .main-schedule rule"
    assert any('safe-area-inset-bottom' in decl for decl in decls), (
        "schedule/create.css .main-schedule must declare safe-area-inset-bottom"
    )


def test_tier2_safe_area_bottom_todo_page():
    """R1: Todo main container/actions in todo/mylist.css must include safe-area-inset-bottom."""
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.project-wrapper|main')
    assert len(decls) > 0, "todo/mylist.css must define .project-wrapper or main rule"
    assert any('safe-area-inset-bottom' in decl for decl in decls), (
        "todo/mylist.css (.project-wrapper or main) must include safe-area-inset-bottom"
    )


def test_tier2_safe_area_bottom_flashcard_page():
    """R1: Flashcards container/actions in flashcard/flashcard.css must include safe-area-inset-bottom."""
    css = (BASE_DIR / 'flashcard/flashcard.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.fc-main|\.fc-review-actions')
    assert len(decls) > 0, "flashcard/flashcard.css must define .fc-main or .fc-review-actions rule"
    assert any('safe-area-inset-bottom' in decl for decl in decls), (
        "flashcard/flashcard.css (.fc-main or .fc-review-actions) must include safe-area-inset-bottom"
    )


def test_tier2_safe_area_syntax_standard_webkit_env():
    """R1: All safe-area-inset declarations must follow standard CSS env() syntax."""
    css_files = ['shared.css', 'style.css', 'account.css', 'career/chat.css', 'schedule/create.css', 'todo/mylist.css', 'flashcard/flashcard.css']
    for filename in css_files:
        css = (BASE_DIR / filename).read_text(encoding='utf-8')
        insets = re.findall(r'env\((safe-area-inset-[^)]+)\)', css)
        for inset in insets:
            assert inset.startswith(('safe-area-inset-top', 'safe-area-inset-bottom', 'safe-area-inset-left', 'safe-area-inset-right')), (
                f"Invalid safe area inset syntax '{inset}' in {filename}"
            )


# ==============================================================================
# TIER 3: DYNAMIC VIEWPORT UNITS (100dvh) (R1)
# ==============================================================================

def test_tier3_dynamic_viewport_height_account_page():
    """R1: Account page full-height container must use 100dvh."""
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.account-page|\.account-shell')
    assert len(decls) > 0, "account.css must define .account-page or .account-shell rule"
    assert any('100dvh' in decl for decl in decls), (
        "account.css must use 100dvh for dynamic mobile viewport height"
    )


def test_tier3_dynamic_viewport_height_career_chat():
    """R1: Career Chat container must use 100dvh."""
    css = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.main-career')
    assert len(decls) > 0, "career/chat.css must define .main-career rule"
    assert any('100dvh' in decl for decl in decls), (
        "career/chat.css must use 100dvh for dynamic mobile viewport height"
    )


def test_tier3_dynamic_viewport_height_flashcard():
    """R1: Flashcards full-height view must use 100dvh."""
    css = (BASE_DIR / 'flashcard/flashcard.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.fc-main')
    assert len(decls) > 0, "flashcard/flashcard.css must define .fc-main rule"
    assert any('100dvh' in decl for decl in decls), (
        "flashcard/flashcard.css must use 100dvh for dynamic mobile viewport height"
    )


def test_tier3_dynamic_viewport_height_schedule():
    """R1: Schedule full-height container must use 100dvh."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.main-schedule')
    assert len(decls) > 0, "schedule/create.css must define .main-schedule rule"
    assert any('100dvh' in decl for decl in decls), (
        "schedule/create.css must use 100dvh for dynamic mobile viewport height"
    )


def test_tier3_dynamic_viewport_height_todo():
    """R1: Todo full-height container must use 100dvh."""
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    decls = _extract_rule_declarations(css, r'\.project-wrapper')
    assert len(decls) > 0, "todo/mylist.css must define .project-wrapper rule"
    assert any('100dvh' in decl for decl in decls), (
        "todo/mylist.css must use 100dvh for dynamic mobile viewport height"
    )


def test_tier3_fallback_order_account_css():
    """R1: account.css must include 100vh fallback preceding 100dvh for older browsers."""
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    assert_viewport_fallback_order(css, r'\.account-page')


def test_tier3_fallback_order_career_chat_css():
    """R1: career/chat.css must include 100vh fallback preceding 100dvh."""
    css = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
    assert_viewport_fallback_order(css, r'\.main-career')


def test_tier3_fallback_order_flashcard_css():
    """R1: flashcard/flashcard.css must include 100vh fallback preceding 100dvh."""
    css = (BASE_DIR / 'flashcard/flashcard.css').read_text(encoding='utf-8')
    assert_viewport_fallback_order(css, r'\.fc-main')


def test_tier3_fallback_order_schedule_css():
    """R1: schedule/create.css must include 100vh fallback preceding 100dvh."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    assert_viewport_fallback_order(css, r'\.main-schedule')


def test_tier3_fallback_order_todo_css():
    """R1: todo/mylist.css must include 100vh fallback preceding 100dvh."""
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    assert_viewport_fallback_order(css, r'\.project-wrapper')


# ==============================================================================
# TIER 4: MOBILE FORM INPUT ZOOM PREVENTION (FONT-SIZE >= 16PX) (R3)
# ==============================================================================

def test_tier4_input_font_size_shared_modal():
    """R3: .sv-modal-input in shared.css must maintain font-size >= 16px to prevent iOS Safari auto-zoom."""
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.sv-modal-input', max_width_limit=768)
    assert eff is not None, "shared.css must declare font-size for .sv-modal-input"
    assert _is_font_size_ge_16(eff), (
        f".sv-modal-input font-size must be >= 16px (or >= 1rem) on mobile viewports, got '{eff}'"
    )


def test_tier4_input_font_size_shared_mobile_base():
    """R3: shared.css must enforce font-size >= 16px for input, select, textarea on mobile viewports."""
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    media_blocks = _extract_media_blocks(css, max_width_threshold=768)
    found_rule = False
    for _, block, _ in media_blocks:
        m = re.search(r'(?:^|[,\s;}])((?:input|select|textarea)[^{]*)\{([^}]+)\}', block, re.IGNORECASE)
        if m:
            body = m.group(2)
            decl = re.search(r'\bfont-size\s*:\s*([^;!]+)', body, re.IGNORECASE)
            if decl and _is_font_size_ge_16(decl.group(1).strip()):
                found_rule = True
                break
    assert found_rule, (
        "shared.css must define a mobile media query rule (<= 768px) ensuring input, select, textarea "
        "have font-size >= 16px (or 1rem) to prevent iOS Safari auto-zoom"
    )


def test_tier4_input_font_size_account_inputs():
    """R3: account.css input fields must maintain font-size >= 16px on mobile viewports."""
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.account-input-wrap\s+input', max_width_limit=768)
    assert eff is not None, "account.css must declare font-size for .account-input-wrap input"
    assert _is_font_size_ge_16(eff), (
        f"account.css inputs must have font-size >= 16px on mobile viewports (<= 768px), got '{eff}'"
    )


def test_tier4_input_font_size_account_selects():
    """R3: account.css select elements must maintain font-size >= 16px on mobile."""
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.account-select-wrap\s+select', max_width_limit=768)
    assert eff is not None, "account.css must declare font-size for .account-select-wrap select"
    assert _is_font_size_ge_16(eff), (
        f"account.css selects must have font-size >= 16px on mobile viewports (<= 768px), got '{eff}'"
    )


def test_tier4_input_font_size_schedule_tc_input():
    """R3: schedule/create.css .tc-input must maintain font-size >= 16px on mobile."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.tc-input', max_width_limit=768)
    assert eff is not None, "schedule/create.css must declare font-size for .tc-input"
    assert _is_font_size_ge_16(eff), (
        f"schedule/create.css .tc-input must have font-size >= 16px (or >= 1rem) on mobile, got '{eff}'"
    )


def test_tier4_input_font_size_schedule_modal_inputs():
    """R3: schedule/create.css modal form inputs must have font-size >= 16px on mobile viewports."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'input\[type=[\'"]?(?:text|number)[\'"]?\]', max_width_limit=768)
    assert eff is not None, "schedule/create.css must define mobile font-size for text/number inputs"
    assert _is_font_size_ge_16(eff), (
        f"schedule/create.css text/number inputs must have font-size >= 16px on mobile, got '{eff}'"
    )


def test_tier4_input_font_size_todo_search_input():
    """R3: todo/mylist.css search input must maintain font-size >= 16px on mobile."""
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.todo-search-wrap\s+input', max_width_limit=768)
    assert eff is not None, "todo/mylist.css must declare font-size for .todo-search-wrap input"
    assert _is_font_size_ge_16(eff), (
        f"todo/mylist.css search input must have font-size >= 16px on mobile, got '{eff}'"
    )


def test_tier4_input_font_size_todo_task_inputs():
    """R3: todo/mylist.css task and modal inputs must maintain font-size >= 16px."""
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    eff_task = _get_effective_mobile_font_size(css, r'#taskNameInput', max_width_limit=768)
    eff_filter = _get_effective_mobile_font_size(css, r'\.todo-filter-row\s+select', max_width_limit=768)
    eff_meta = _get_effective_mobile_font_size(css, r'\.task-meta-grid\s+select', max_width_limit=768)

    assert eff_task is not None and _is_font_size_ge_16(eff_task), (
        f"todo/mylist.css #taskNameInput must have font-size >= 16px on mobile, got '{eff_task}'"
    )
    assert eff_filter is not None and _is_font_size_ge_16(eff_filter), (
        f"todo/mylist.css filter selects must have font-size >= 16px on mobile, got '{eff_filter}'"
    )
    assert eff_meta is not None and _is_font_size_ge_16(eff_meta), (
        f"todo/mylist.css task meta inputs/selects must have font-size >= 16px on mobile, got '{eff_meta}'"
    )


def test_tier4_input_font_size_flashcard_controls():
    """R3: flashcard/flashcard.css .fc-select, .fc-input, .fc-textarea must maintain font-size >= 16px on mobile."""
    css = (BASE_DIR / 'flashcard/flashcard.css').read_text(encoding='utf-8')
    eff_sel = _get_effective_mobile_font_size(css, r'\.fc-select', max_width_limit=768)
    eff_inp = _get_effective_mobile_font_size(css, r'\.fc-input', max_width_limit=768)
    eff_txt = _get_effective_mobile_font_size(css, r'\.fc-textarea', max_width_limit=768)
    eff_prev = _get_effective_mobile_font_size(css, r'\.fc-preview-input', max_width_limit=768)

    for name, eff in [
        ('.fc-select', eff_sel),
        ('.fc-input', eff_inp),
        ('.fc-textarea', eff_txt),
        ('.fc-preview-input', eff_prev),
    ]:
        assert eff is not None, f"flashcard.css must declare font-size for {name}"
        assert _is_font_size_ge_16(eff), (
            f"flashcard.css {name} must have font-size >= 16px (or >= 1rem) on mobile, got '{eff}'"
        )


def test_tier4_no_sub16px_inline_font_sizes_in_mylist_js():
    """R3: todo/mylist.js and todo/mylist.html must not hardcode input font-size < 16px in inline styles."""
    js = (BASE_DIR / 'todo/mylist.js').read_text(encoding='utf-8')
    js_matches = re.findall(
        r'<(?:input|select|textarea)[^>]*style=["\'][^"\']*font-size:\s*(\d+(?:\.\d+)?(?:px|rem|em))[^"\']*["\']',
        js,
        re.IGNORECASE,
    )
    js_violating = [m for m in js_matches if not _is_font_size_ge_16(m)]
    assert len(js_violating) == 0, (
        f"todo/mylist.js must not inject inputs with inline font-size < 16px: found {js_violating}"
    )

    html = (BASE_DIR / 'todo/mylist.html').read_text(encoding='utf-8')
    html_matches = re.findall(
        r'<(?:input|select|textarea)[^>]*style=["\'][^"\']*font-size:\s*(\d+(?:\.\d+)?(?:px|rem|em))[^"\']*["\']',
        html,
        re.IGNORECASE,
    )
    html_violating = [m for m in html_matches if not _is_font_size_ge_16(m)]
    assert len(html_violating) == 0, (
        f"todo/mylist.html must not contain form inputs with inline font-size < 16px: found {html_violating}"
    )


def test_tier4_career_chat_textarea_maintains_16px():
    """R3: career/chat.css chat textarea must maintain font-size >= 16px on mobile viewports."""
    css = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.chat-input-area\s+textarea', max_width_limit=768)
    assert eff is not None, "career/chat.css must define mobile font-size for .chat-input-area textarea"
    assert _is_font_size_ge_16(eff), (
        f"career/chat.css .chat-input-area textarea must maintain font-size >= 16px on mobile, got '{eff}'"
    )


# ==============================================================================
# TIER 5 / BOUNDARY: RESPONSIVE REFLOW & 375PX BOUNDARY (R2 & R4)
# ==============================================================================

def test_tier5_hero_title_no_rigid_nowrap_on_mobile():
    """R4: Homepage hero title in style.css must not enforce white-space: nowrap !important on mobile."""
    css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
    mobile_blocks = _extract_media_blocks(css, max_width_threshold=768)
    assert len(mobile_blocks) > 0, "style.css must contain mobile media queries (<= 768px)"

    nowrap_violations = []
    for query, body, _ in mobile_blocks:
        hero_decls = _extract_rule_declarations(body, r'\.hero-title')
        for decl in hero_decls:
            if re.search(r'white-space:\s*nowrap', decl, re.IGNORECASE):
                nowrap_violations.append((query.strip(), decl.strip()))

    assert len(nowrap_violations) == 0, (
        f"style.css enforces white-space: nowrap on .hero-title under mobile media queries: {nowrap_violations}"
    )


def test_tier5_card_ai_and_task_microcards_fit_mobile():
    """R4: Floating cards (.card-ai, .card-task) in style.css must define responsive mobile reflow rules."""
    css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
    mobile_blocks = _extract_media_blocks(css, max_width_threshold=768)
    assert len(mobile_blocks) > 0, "style.css must define mobile media queries (<= 768px) for floating cards"

    card_ai_decls = []
    card_task_decls = []
    for query, body, _ in mobile_blocks:
        card_ai_decls.extend([(query, d) for d in _extract_rule_declarations(body, r'\.card-ai')])
        card_task_decls.extend([(query, d) for d in _extract_rule_declarations(body, r'\.card-task')])

    assert len(card_ai_decls) > 0, "style.css must define mobile overrides for .card-ai under @media (max-width <= 768px)"
    assert len(card_task_decls) > 0, "style.css must define mobile overrides for .card-task under @media (max-width <= 768px)"

    for query, decl in card_ai_decls + card_task_decls:
        has_scale = bool(re.search(r'transform:\s*scale\(\s*0?\.[0-9]+\s*\)', decl))
        has_reflow = any(prop in decl for prop in ['display: none', 'position: relative', 'position: static', 'max-width', 'width: 100%'])
        assert has_scale or has_reflow, (
            f"Under {query}, floating card must define scaling (transform: scale(<1.0>)) or reflow, got: {decl}"
        )
        rigid_width = re.search(r'(?:min-)?width:\s*([4-9]\d\d+px)', decl)
        assert rigid_width is None, f"Floating card cannot have rigid width > 375px on mobile: {decl}"

    hidden_secondary = any(
        re.search(r'\.(?:card-schedule|card-streak)[^{]*\{[^}]*display:\s*none', body)
        for _, body, _ in mobile_blocks
    )
    assert hidden_secondary, "Secondary micro-cards (.card-schedule, .card-streak) must be hidden on mobile viewports"


def test_tier5_flashcard_scene_no_rigid_min_width_overflow():
    """R4: flashcard/flashcard.css must not impose rigid min-width > 375px on mobile viewports."""
    css = (BASE_DIR / 'flashcard/flashcard.css').read_text(encoding='utf-8')
    mobile_blocks = _extract_media_blocks(css, max_width_threshold=768)
    assert len(mobile_blocks) > 0, "flashcard/flashcard.css must contain mobile media queries"

    violations = []
    for query, body, _ in mobile_blocks:
        for m in re.finditer(r'([^{]+)\{([^}]+)\}', body):
            sel, decl = m.group(1).strip(), m.group(2).strip()
            mw_match = re.search(r'\bmin-width:\s*([4-9]\d\d+px|[1-9]\d{3,}px)', decl, re.IGNORECASE)
            if mw_match:
                violations.append((query.strip(), sel, mw_match.group(1)))

    assert len(violations) == 0, f"Found rigid min-widths > 375px in mobile flashcards css: {violations}"


def test_tier5_schedule_container_no_rigid_min_width_overflow():
    """R4: schedule/create.css must not impose rigid min-width > 375px on mobile viewports."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    mobile_blocks = _extract_media_blocks(css, max_width_threshold=768)
    assert len(mobile_blocks) > 0, "schedule/create.css must contain mobile media queries"

    violations = []
    for query, body, _ in mobile_blocks:
        for m in re.finditer(r'([^{]+)\{([^}]+)\}', body):
            sel, decl = m.group(1).strip(), m.group(2).strip()
            mw_match = re.search(r'\bmin-width:\s*([4-9]\d\d+px|[1-9]\d{3,}px)', decl, re.IGNORECASE)
            if mw_match:
                violations.append((query.strip(), sel, mw_match.group(1)))

    assert len(violations) == 0, f"Found rigid min-widths > 375px in mobile schedule css: {violations}"


def test_tier5_career_chat_no_rigid_min_width_overflow():
    """R4: career/chat.css must not impose rigid min-width > 375px on mobile viewports."""
    css = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
    mobile_blocks = _extract_media_blocks(css, max_width_threshold=768)
    assert len(mobile_blocks) > 0, "career/chat.css must contain mobile media queries"

    violations = []
    for query, body, _ in mobile_blocks:
        for m in re.finditer(r'([^{]+)\{([^}]+)\}', body):
            sel, decl = m.group(1).strip(), m.group(2).strip()
            mw_match = re.search(r'\bmin-width:\s*([4-9]\d\d+px|[1-9]\d{3,}px)', decl, re.IGNORECASE)
            if mw_match:
                violations.append((query.strip(), sel, mw_match.group(1)))

    assert len(violations) == 0, f"Found rigid min-widths > 375px in mobile career chat css: {violations}"


def test_tier5_todo_media_query_cascade_order():
    """R4: todo/mylist.css must order media queries properly (max-width: 768px before max-width: 600px)."""
    css = (BASE_DIR / 'todo/mylist.css').read_text(encoding='utf-8')
    idx_768 = css.find('max-width: 768px')
    idx_600 = css.find('max-width: 600px')
    if idx_768 != -1 and idx_600 != -1:
        assert idx_768 < idx_600, (
            "todo/mylist.css: media query for 768px should appear BEFORE 600px so narrower styles override wider ones"
        )


@pytest.mark.parametrize('page', [
    'index.html',
    'account.html',
    'career/chat.html',
    'flashcard/flashcard.html',
    'schedule/create.html',
    'todo/mylist.html',
])
def test_tier5_navbar_structure_preserved(client, page):
    """R2: Mobile navigation items, classes, and links must remain preserved across all pages."""
    resp = client.get('/' + page)
    assert resp.status_code == 200
    html = resp.data.decode('utf-8')

    if page != 'account.html':
        assert 'class="navigation"' in html or 'class="nav-container"' in html, (
            f"Page {page} must preserve navigation container class"
        )
        assert '/flashcard/flashcard.html' in html, f"Page {page} must retain flashcards navigation link"
    else:
        assert 'class="account-topbar"' in html or 'account-brand' in html, (
            "account.html must preserve account topbar structure"
        )


def test_tier5_overflow_x_guard_in_shared_css():
    """R4: shared.css must guard body against horizontal overflow with overflow-x: hidden."""
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    assert re.search(r'body[^{]*\{[^}]*overflow-x:\s*hidden', css) is not None, (
        "shared.css must enforce overflow-x: hidden on body to prevent horizontal scrolling on 375px"
    )
