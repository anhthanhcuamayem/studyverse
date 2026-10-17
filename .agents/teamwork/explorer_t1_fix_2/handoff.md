# Investigation & Hardening Report: Mobile Form Input Zoom Prevention & Selector Scoping (Milestone T1 Fix)

**Agent**: `explorer_t1_fix_2` (Form Input & Selector Scoping Hardening Explorer)  
**Parent Orchestrator**: `bdce3044-e260-4522-8179-cfcdc4c408ba`  
**Date**: 2026-10-13  
**Working Directory**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_2/`  
**Mission**: Analyze actual form element selectors and values across all stylesheets; formulate strict, non-tautological test assertions for `font-size >= 16px` under mobile media queries (`<= 768px`); recommend fix strategy without implementing (read-only investigation).

---

## Executive Summary

1. **Root Cause of Test Facades in Tier 4**: 10 of 11 tests in `tests/test_mobile_viewport.py` (Tier 4) passed on the unoptimized codebase because of tautological trailing `or` clauses (`or '16px' in css`, `or 'font-size: 16px' in css`), unconstrained substring searches (`assert '16px' in css`), and non-nested regex patterns that failed to inspect multi-rule `@media` blocks.
2. **Actual Codebase Vulnerability Inventory**: Every core interactive page except `career/chat.html` contains form controls with font sizes between `11px` and `15.2px` (sub-16px), which will trigger automatic viewport zoom on iOS Safari:
   - `account.css`: Inputs are `12px` (`.account-input-wrap input:195`) and selects are `11px` (`.account-select-wrap select:245`) with ZERO mobile overrides.
   - `flashcard/flashcard.css`: Controls are `0.95rem` / 15.2px (`.fc-select, .fc-input, .fc-textarea:98`) and `0.92rem` / 14.72px (`.fc-preview-input:1179`) with ZERO mobile overrides.
   - `schedule/create.css`: Time inputs are `0.85rem` / 13.6px (`.tc-input:1262`) with ZERO mobile overrides.
   - `todo/mylist.css`: Search input is `12px` (`.todo-search-wrap input:443`), filter select is `12px` (`line 399`), and task meta inputs/selects are `12px` (`line 489`).
   - `todo/mylist.html`: Critical cascade bug — `#taskNameInput` (line 138) has inline `style="... font-size: 15px; ..."` and `#taskDeadlineInput` (line 142) has inline `style="... font-size: 13px; ..."`, which mathematically override the stylesheet's `#taskNameInput { font-size: 16px; }` rule!
   - `todo/mylist.js`: Line 972 dynamically injects `<input ... style="... font-size: 14px; ...">`.
   - `shared.css`: Modal inputs are `0.92rem` / 14.72px (`.sv-modal-input:932`), and no mobile form base rule exists.
3. **Hardened Test Architecture**: We developed and verified a brace-balanced CSS parser helper set (`_extract_media_blocks`, `_get_rule_declaration`, `_is_font_size_ge_16`, `_get_effective_mobile_font_size`) that accurately evaluates declared and overridden font-size values under mobile media queries (`<= 768px`). In our empirical dry run on the current repository:
   - **9 tests legitimately FAIL (RED)** because unoptimized code is present.
   - **2 tests legitimately PASS (GREEN)** because `schedule/create.css:721` (`input[type="text"], input[type="number"]`) and `career/chat.css:373` (`.chat-input-area textarea`) already contain authentic 16px mobile rules.
   - **Zero tautologies remain.**

---

## 1. Observation

### 1.1 Complete Inventory of Form Element Selectors and Values Across Codebase

| File | Selector / Element | Line # | Current Declared Font-Size | Pixel Equiv | Media Query Override? | Status vs R3 |
|---|---|---|---|---|---|---|
| `shared.css` | `.sv-modal-input` | 932 | `0.92rem` | 14.72px | None | **VIOLATION (<16px)** |
| `shared.css` | `input, select, textarea` (mobile base) | — | None | Browser default | None | **VIOLATION (No mobile baseline)** |
| `account.css` | `.account-input-wrap input` | 195 | `12px` | 12px | None in `@media (max-width: 720px/420px)` | **VIOLATION (<16px)** |
| `account.css` | `.account-select-wrap select` | 245 | `11px` | 11px | None in `@media (max-width: 720px/420px)` | **VIOLATION (<16px)** |
| `flashcard/flashcard.css` | `.fc-select, .fc-input, .fc-textarea` | 98 | `0.95rem` | 15.2px | None in `@media (max-width: 768px/480px)` | **VIOLATION (<16px)** |
| `flashcard/flashcard.css` | `.fc-preview-input` | 1179 | `0.92rem` | 14.72px | None | **VIOLATION (<16px)** |
| `flashcard/flashcard.css` | `.fc-search-box input` | 1229 | Inherited from `.fc-input` | 15.2px | None | **VIOLATION (<16px)** |
| `schedule/create.css` | `.tc-input` (time slots) | 1262 | `0.85rem` | 13.6px | None in `@media (max-width: 640px:1355)` | **VIOLATION (<16px)** |
| `schedule/create.css` | `input[type="text"], input[type="number"]` | 182, 721 | Base `0.9rem` (14.4px); overridden line 722 | `16px` | In `@media (max-width: 768px)` | **COMPLIANT (>=16px)** |
| `todo/mylist.css` | `.todo-search-wrap input` | 443 | `12px` | 12px | None in `@media (max-width: 768px:675)` | **VIOLATION (<16px)** |
| `todo/mylist.css` | `.todo-filter-row select` | 399, 446 | `12px` | 12px | None in `@media (max-width: 768px:675)` | **VIOLATION (<16px)** |
| `todo/mylist.css` | `.task-meta-grid select, input` | 489 | `12px` | 12px | None in `@media (max-width: 768px:675)` | **VIOLATION (<16px)** |
| `todo/mylist.css` | `.task-subtasks-input` (textarea) | 507 | `12px` | 12px | None in `@media (max-width: 768px:675)` | **VIOLATION (<16px)** |
| `todo/mylist.css` | `#taskNameInput, #taskDeadlineInput` | 725 | `16px` in CSS | 16px | In `@media (max-width: 768px)` | **OVERRIDDEN BY INLINE HTML** |
| `todo/mylist.html` | `<input id="taskNameInput" ...>` | 138 | `style="... font-size: 15px; ..."` | 15px | Inline HTML attribute | **CRITICAL BUG (Beats CSS 16px)** |
| `todo/mylist.html` | `<input id="taskDeadlineInput" ...>` | 142 | `style="... font-size: 13px; ..."` | 13px | Inline HTML attribute | **CRITICAL BUG (Beats CSS 16px)** |
| `todo/mylist.js` | `<input id="editTaskDate-${task.id}" ...>` | 972 | `style="... font-size: 14px; ..."` | 14px | Dynamic JS string | **VIOLATION (<16px)** |
| `career/chat.css` | `.chat-input-area textarea` | 190, 373 | Base `0.9rem`; line 373: `font-size: 16px;` | 16px | In `@media (max-width: 768px)` | **COMPLIANT (>=16px)** |
| `config-preview.html` | `input, select, textarea` | 70-85 | `0.88rem`, `0.84rem`, `0.78rem` | ~13-14px | Internal `<style>` | Dev tool (Note for completeness) |

---

### 1.2 Verbatim Analysis of Current Tier 4 Test Assertions

1. **`test_tier4_input_font_size_shared_modal` (`tests/test_mobile_viewport.py:290-300`)**:
   ```python
   match = re.search(r'\.sv-modal-input[^{]*\{[^}]*font-size:\s*([^;]+);', css)
   if match:
       val = match.group(1).strip()
       assert '16px' in val or '1rem' in val or float(re.search(r'([\d.]+)', val).group(1)) >= 16 or '16px' in css
   ```
   - **Verbatim Bypass**: `or '16px' in css` short-circuits to `True` because `shared.css:1091` has `.logo { font-size: 16px; }` and line 151 has `backdrop-filter: blur(16px)`. The test passes even though `.sv-modal-input` is `0.92rem` (14.72px).
   - Furthermore, `if match:` silently passes if `match is None`.

2. **`test_tier4_input_font_size_shared_mobile_base` (`tests/test_mobile_viewport.py:302-311`)**:
   ```python
   assert re.search(r'(input|select|textarea)[^{]*\{[^}]*font-size:\s*(1[6-9]px|[2-9]\dpx|1rem)', css) or \
          re.search(r'@media[^{]*max-width:\s*768px[^{]*\{[^}]*(input|select|textarea)[^{]*\{[^}]*font-size:\s*16px', css, re.DOTALL) or \
          'font-size: 16px' in css
   ```
   - **Verbatim Bypass**: Bypassed by `'font-size: 16px' in css` matching `.logo` on line 1091.

3. **`test_tier4_input_font_size_account_inputs` & `selects` (`tests/test_mobile_viewport.py:313-328`)**:
   ```python
   assert 'font-size: 16px' in css or not re.search(r'\.account-input-wrap\s+input[^{]*\{[^}]*font-size:\s*(1[0-5]px|\dpx)', css)
   ```
   - **Verbatim Bypass**: `account.css:234` has `.stat-value { font-size: 16px; }`. The first operand `'font-size: 16px' in css` evaluates to `True`, masking `font-size: 12px;` on line 195 and `font-size: 11px;` on line 245.

4. **`test_tier4_input_font_size_schedule_tc_input` (`tests/test_mobile_viewport.py:330-337`)**:
   - **Verbatim Bypass**: `assert 'font-size: 16px' in css or ...` evaluates to `True` due to line 722 (`input[type="text"] { font-size: 16px; }`), ignoring that `.tc-input` is `0.85rem` (13.6px).

5. **`test_tier4_input_font_size_schedule_modal_inputs` (`tests/test_mobile_viewport.py:339-343`)**:
   - **Verbatim Bypass**: `assert '16px' in css`. Zero selector checks.

6. **`test_tier4_input_font_size_todo_search_input` & `todo_task_inputs` (`tests/test_mobile_viewport.py:345-357`)**:
   - **Verbatim Bypass**: `assert 'font-size: 16px' in css or ...` evaluates to `True` due to line 725, ignoring that `.todo-search-wrap input`, `.todo-filter-row select`, and `.task-meta-grid select` are `12px`.

7. **`test_tier4_input_font_size_flashcard_controls` (`tests/test_mobile_viewport.py:359-363`)**:
   - **Verbatim Bypass**: `assert '16px' in css or '1rem' in css`. Trivially matches `padding: 10px 16px;` (line 72) and `border-radius: 16px;` (line 73) in `flashcard/flashcard.css`, while form controls remain at `0.95rem` (15.2px).

8. **`test_tier4_no_sub16px_inline_font_sizes_in_mylist_js` (`tests/test_mobile_viewport.py:365-373`)**:
   - Currently the ONLY failing test in Tier 4, catching `['14px']` in `todo/mylist.js:972`.
   - Flaw: Regex only supports double quotes `style="font-size: ..."` and does not inspect `todo/mylist.html` which contains inline `15px` and `13px`.

9. **`test_tier4_career_chat_textarea_maintains_16px` (`tests/test_mobile_viewport.py:375-381`)**:
   - Passes legitimately because `career/chat.css:373` has `.chat-input-area textarea { font-size: 16px; }`.

---

## 2. Logic Chain

1. **Premise 1 (Anti-Zoom Standard R3)**: iOS Safari triggers an irreversible zoom on form focus whenever an `<input>`, `<select>`, or `<textarea>` has computed `font-size < 16px`.
2. **Premise 2 (Specificity & Cascade Conflict)**:
   - In CSS cascading rules, a class-qualified descendant selector like `.account-input-wrap input` has specificity `(0, 1, 1)`, whereas a tag selector `input` has specificity `(0, 0, 1)`.
   - Furthermore, `account.css`, `flashcard.css`, `create.css`, and `mylist.css` are loaded after `shared.css`.
   - Therefore, adding `input, select, textarea { font-size: 16px; }` in `shared.css` alone **will NOT** fix sub-16px inputs in `account.css:195` (12px), `schedule/create.css:1262` (0.85rem), or `todo/mylist.css:443` (12px). Each page's specific class selector must be scoped and overridden in its own stylesheet or have equal/higher specificity.
3. **Premise 3 (Inline Style Specificity Override)**:
   - An inline style attribute (`style="font-size: 15px;"`) has specificity `(1, 0, 0, 0)`.
   - An ID selector in a stylesheet (`#taskNameInput { font-size: 16px; }`) has specificity `(0, 1, 0, 0)`.
   - In `todo/mylist.html:138`, `<input id="taskNameInput" style="... font-size: 15px; ...">` renders at `15px` on mobile viewports despite line 725 in `todo/mylist.css` declaring `#taskNameInput { font-size: 16px; }`. The inline style must be eliminated or updated to `>= 16px`.
4. **Premise 4 (Regex Nested Brace Mechanics)**:
   - A pattern of the form `@media[^{]*\{[^}]*\.selector` terminates at the first nested closing brace `}` inside `@media`. Any rules appearing after the first nested rule are ignored.
   - To accurately parse CSS rules inside `@media (max-width: <= 768px)`, a parser must balance brace depth `{ ... }` across the entire media query block.
5. **Premise 5 (Elimination of Tautologies)**:
   - Any test assertion ending with `or '16px' in css` or `or 'font-size: 16px' in css` is mathematically tainted by non-target rules (e.g. `.logo`, `.stat-value`, `padding: 16px`).
   - Removing all global substring fallbacks and binding assertions directly to the targeted selectors guarantees falsification (red signals on unoptimized code) and prevents false certifications.

---

## 3. Caveats

1. **Driverless Test Execution**: The test suite operates without headless WebKit browser binaries (Playwright/Puppeteer), using Flask test client HTTP responses and static file parsing. The proposed Python parser accurately reflects CSS cascade order and media query overrides without needing a browser engine.
2. **Exempt Controls**: In accordance with `ORIGINAL_REQUEST.md` and standard iOS Safari behavior, non-text inputs (`checkbox`, `radio`, `range`, `color`, `file`) do not invoke the software keyboard or trigger auto-zoom and are deliberately excluded from the 16px threshold.
3. **`config-preview.html`**: This is a developer configuration preview tool rather than an end-user page. Its internal `<style>` contains inputs with `0.88rem` and `0.84rem`. While not tested in Tier 4, we document it for completeness.

---

## 4. Conclusion & Actionable Recommendations

### 4.1 Recommended Test Assertions for Test Writer (Milestone T1 Fix)

Add the following reusable CSS parser helpers to `tests/test_mobile_viewport.py`:

```python
def _extract_media_blocks(css: str, max_width_limit: int = 768) -> list[str]:
    """Extract all @media blocks with max-width <= max_width_limit, balancing nested braces."""
    blocks = []
    pattern = re.compile(r"@media[^{]*max-width:\s*(\d+)px[^{]*\{", re.IGNORECASE)
    for m in pattern.finditer(css):
        width = int(m.group(1))
        if width <= max_width_limit:
            start = m.end()
            depth = 1
            i = start
            while i < len(css) and depth > 0:
                if css[i] == '{':
                    depth += 1
                elif css[i] == '}':
                    depth -= 1
                i += 1
            blocks.append((width, css[start:i-1]))
    blocks.sort(key=lambda x: x[0], reverse=True)
    return [b[1] for b in blocks]


def _get_rule_declaration(css_block: str, selector_pattern: str, prop: str = "font-size") -> str | None:
    """Find rule matching selector_pattern in css_block and extract property declaration value."""
    m = re.search(rf"(?:^|[,\}}\s])({selector_pattern})[^{{]*\{{([^}}]+)\}}", css_block)
    if not m:
        return None
    body = m.group(2)
    decl = re.search(rf"\b{prop}\s*:\s*([^;!]+)", body, re.IGNORECASE)
    if not decl:
        return None
    return decl.group(1).strip()


def _is_font_size_ge_16(val: str | None) -> bool:
    """Check if font-size declaration is >= 16px (supports px, rem, em)."""
    if not val:
        return False
    val = val.strip().lower()
    if val.endswith('px'):
        try:
            return float(val[:-2].strip()) >= 16.0
        except ValueError:
            return False
    if val.endswith('rem') or val.endswith('em'):
        unit = 3 if val.endswith('rem') else 2
        try:
            return float(val[:-unit].strip()) >= 1.0
        except ValueError:
            return False
    return False


def _get_effective_mobile_font_size(css: str, selector_pattern: str, max_width_limit: int = 768) -> str | None:
    """Evaluate effective mobile font size: mobile query override first, then base rule."""
    media_blocks = _extract_media_blocks(css, max_width_limit)
    for block in media_blocks:
        val = _get_rule_declaration(block, selector_pattern, "font-size")
        if val is not None:
            return val
    return _get_rule_declaration(css, selector_pattern, "font-size")
```

Replace all 11 test functions in Tier 4 with the following hardened implementations:

```python
# ==============================================================================
# TIER 4: MOBILE FORM INPUT ZOOM PREVENTION (FONT-SIZE >= 16PX) (R3)
# ==============================================================================

def test_tier4_input_font_size_shared_modal():
    """R3: .sv-modal-input in shared.css must maintain font-size >= 16px on mobile viewports."""
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.sv-modal-input', max_width_limit=768)
    assert eff is not None, "shared.css must declare font-size for .sv-modal-input"
    assert _is_font_size_ge_16(eff), (
        f".sv-modal-input font-size must be >= 16px (or >= 1rem) on mobile viewports, got '{eff}'"
    )


def test_tier4_input_font_size_shared_mobile_base():
    """R3: shared.css must enforce font-size >= 16px for input, select, textarea on mobile viewports."""
    css = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    media_blocks = _extract_media_blocks(css, max_width_limit=768)
    found_rule = False
    for block in media_blocks:
        m = re.search(r'(?:^|[,\}\s])((?:input|select|textarea)[^{]*)\{([^}]+)\}', block, re.IGNORECASE)
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
    """R3: account.css select elements must maintain font-size >= 16px on mobile viewports."""
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.account-select-wrap\s+select', max_width_limit=768)
    assert eff is not None, "account.css must declare font-size for .account-select-wrap select"
    assert _is_font_size_ge_16(eff), (
        f"account.css selects must have font-size >= 16px on mobile viewports (<= 768px), got '{eff}'"
    )


def test_tier4_input_font_size_schedule_tc_input():
    """R3: schedule/create.css .tc-input must maintain font-size >= 16px on mobile viewports."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'\.tc-input', max_width_limit=768)
    assert eff is not None, "schedule/create.css must declare font-size for .tc-input"
    assert _is_font_size_ge_16(eff), (
        f"schedule/create.css .tc-input must have font-size >= 16px (or >= 1rem) on mobile, got '{eff}'"
    )


def test_tier4_input_font_size_schedule_modal_inputs():
    """R3: schedule/create.css form inputs must have font-size >= 16px on mobile viewports."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    eff = _get_effective_mobile_font_size(css, r'input\[type=[\'"]?(?:text|number)[\'"]?\]', max_width_limit=768)
    assert eff is not None, "schedule/create.css must define mobile font-size for text/number inputs"
    assert _is_font_size_ge_16(eff), (
        f"schedule/create.css text/number inputs must have font-size >= 16px on mobile, got '{eff}'"
    )


def test_tier4_input_font_size_todo_search_input():
    """R3: todo/mylist.css search input must maintain font-size >= 16px on mobile viewports."""
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
    
    for name, eff in [('.fc-select', eff_sel), ('.fc-input', eff_inp), ('.fc-textarea', eff_txt), ('.fc-preview-input', eff_prev)]:
        assert eff is not None, f"flashcard.css must declare font-size for {name}"
        assert _is_font_size_ge_16(eff), (
            f"flashcard.css {name} must have font-size >= 16px (or >= 1rem) on mobile, got '{eff}'"
        )


def test_tier4_no_sub16px_inline_font_sizes_in_mylist_js():
    """R3: todo/mylist.js and todo/mylist.html must not hardcode input font-size < 16px in inline styles."""
    js = (BASE_DIR / 'todo/mylist.js').read_text(encoding='utf-8')
    js_matches = re.findall(
        r'<(?:input|select|textarea)[^>]*style=["\'][^"\']*font-size:\s*(\d+(?:\.\d+)?(?:px|rem|em))[^"\']*["\']',
        js, re.IGNORECASE
    )
    js_violating = [m for m in js_matches if not _is_font_size_ge_16(m)]
    assert len(js_violating) == 0, (
        f"todo/mylist.js must not inject inputs with inline font-size < 16px: found {js_violating}"
    )

    html = (BASE_DIR / 'todo/mylist.html').read_text(encoding='utf-8')
    html_matches = re.findall(
        r'<(?:input|select|textarea)[^>]*style=["\'][^"\']*font-size:\s*(\d+(?:\.\d+)?(?:px|rem|em))[^"\']*["\']',
        html, re.IGNORECASE
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
```

---

### 4.2 Recommended Fix Strategy for Worker M3 (Implementation Roadmap)

When Milestone M3 is executed by the worker agent, the following targeted edits will achieve full compliance:

1. **`shared.css`**:
   - Update line 932: `.sv-modal-input { ... font-size: 1rem; ... }` (or `16px`).
   - Add inside `@media (max-width: 768px)` (line 1037):
     ```css
     input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
     select,
     textarea,
     .sv-modal-input {
         font-size: 16px;
     }
     ```
2. **`account.css`**:
   - Add inside `@media (max-width: 720px)` (line 881):
     ```css
     .account-input-wrap input,
     .account-select-wrap select {
         font-size: 16px;
     }
     ```
3. **`flashcard/flashcard.css`**:
   - Add inside `@media (max-width: 768px)` (line 1388):
     ```css
     .fc-select,
     .fc-input,
     .fc-textarea,
     .fc-preview-input,
     .fc-search-box input {
         font-size: 16px;
     }
     ```
4. **`schedule/create.css`**:
   - Add inside `@media (max-width: 768px)` (line 628) or `@media (max-width: 640px)`:
     ```css
     .tc-input {
         font-size: 16px;
     }
     ```
5. **`todo/mylist.css`**:
   - Add inside `@media (max-width: 768px)` (line 675):
     ```css
     .todo-search-wrap input,
     .todo-filter-row select,
     .task-meta-grid select,
     .task-meta-grid input,
     .task-schedule-field select,
     .task-subtasks-input {
         font-size: 16px;
     }
     ```
6. **`todo/mylist.html`**:
   - Line 138: Update `style="... font-size: 15px; ..."` to `font-size: 16px;` (or remove inline font-size to inherit from stylesheet).
   - Line 142: Update `style="... font-size: 13px; ..."` to `font-size: 16px;` (or remove inline font-size to inherit from stylesheet).
7. **`todo/mylist.js`**:
   - Line 972: Update `editTaskDate-${task.id}` inline style from `font-size: 14px;` to `font-size: 16px;`.

---

## 5. Verification Method

### 5.1 Verification of Falsification & Genuine Red Signals

To independently verify that the proposed assertions genuinely catch unoptimized code:

1. **Run the dry-run test suite**:
   ```bash
   .venv/bin/python .agents/teamwork/explorer_t1_fix_2/test_strict_tier4.py
   ```
   *Expected Output*:
   - 9 test cases report `[FAIL (RED)]` with exact reasons:
     - `test_tier4_input_font_size_shared_modal`: `0.92rem` < 16px
     - `test_tier4_input_font_size_shared_mobile_base`: missing base rule in shared.css
     - `test_tier4_input_font_size_account_inputs`: `12px` < 16px
     - `test_tier4_input_font_size_account_selects`: `11px` < 16px
     - `test_tier4_input_font_size_schedule_tc_input`: `0.85rem` < 16px
     - `test_tier4_input_font_size_todo_search_input`: `12px` < 16px
     - `test_tier4_input_font_size_todo_task_inputs`: `12px` < 16px
     - `test_tier4_input_font_size_flashcard_controls`: `0.95rem` < 16px
     - `test_tier4_no_sub16px_inline_font_sizes_in_mylist_js`: `['14px']` in mylist.js
   - 2 test cases report `[PASS]` because the code is genuinely compliant:
     - `test_tier4_input_font_size_schedule_modal_inputs` (`schedule/create.css:722` has 16px)
     - `test_tier4_career_chat_textarea_maintains_16px` (`career/chat.css:373` has 16px)

2. **Verify Sub-16px Lines in Source Files**:
   ```bash
   grep -n "font-size: 12px" account.css
   grep -n "font-size: 11px" account.css
   grep -n "font-size: 0.95rem" flashcard/flashcard.css
   grep -n "font-size: 0.85rem" schedule/create.css
   grep -n "font-size: 12px" todo/mylist.css
   grep -n "font-size: 15px" todo/mylist.html
   grep -n "font-size: 14px" todo/mylist.js
   ```

3. **Verify Baseline Test Suite Unaffected**:
   ```bash
   .venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py
   ```
   *Expected Output*: `130 passed`.

### 5.2 Invalidation Conditions
- If any test in Tier 4 passes when the selector's mobile computed font size is strictly less than 16px.
- If any test in Tier 4 uses a file-wide un-scoped string check (`or '16px' in css` or `or 'font-size: 16px' in css`).
