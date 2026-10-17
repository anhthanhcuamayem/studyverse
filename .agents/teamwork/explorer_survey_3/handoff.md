# Survey Report: Test Suite & Tooling Verification for Mobile Viewport Optimization

**Explorer**: explorer_survey_3 (Test Suite Explorer)  
**Date**: 2026-10-13  
**Working Directory**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_3/`  
**Reference Request**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md`

---

## 1. Observation

### 1.1 Test Configuration & Structure
- **Pytest Configuration** (`pytest.ini`):
  ```ini
  [pytest]
  testpaths = tests
  python_files = test_*.py
  addopts = -q
  ```
- **Conftest** (`conftest.py`):
  ```python
  ROOT = Path(__file__).resolve().parent
  if str(ROOT) not in sys.path:
      sys.path.insert(0, str(ROOT))
  ```
- **Existing Test Files** in `tests/`:
  - `tests/test_app.py`: 1,213 lines, 98 test items covering static file serving (`PUBLIC_FILES`), route aliases (`/account`, `/career`, etc.), 404 security checks, health check, AI providers configuration and probing, AI endpoints validation/mocking, schedule optimization, and career stream SSE.
  - `tests/test_flashcards.py`: 299 lines, 24 test items covering document parsers (txt, md, json, csv, docx, pdf), heuristic flashcard generation, prompt formatting, AI fallback logic, and navbar DOM element integrity across 5 pages (`index.html`, `todo/mylist.html`, `schedule/create.html`, `career/chat.html`, `flashcard/flashcard.html`).
  - `tests/test_schedule_utils.py`: 76 lines, 8 test items covering time parsing/formatting, slot generation, breaks, preferences, and avoid-days timetable logic.

### 1.2 Baseline Execution State
Executed via `run_command`: `.venv/bin/pytest -v` (Cwd: `/home/thanh/LÀM VIỆC/project/studyverse`).
Output:
```text
============================= test session starts ==============================
platform linux -- Python 3.12.3, pytest-9.1.1, pluggy-1.6.0
rootdir: /home/thanh/LÀM VIỆC/project/studyverse
configfile: pytest.ini
testpaths: tests
plugins: anyio-4.15.1
collected 130 items

tests/test_app.py ...................................................... [ 41%]
............................................                             [ 75%]
tests/test_flashcards.py ........................                        [ 93%]
tests/test_schedule_utils.py ........                                    [100%]

============================= 130 passed in 24.41s =============================
```
- **Result**: Baseline is 100% clean (130 passed, 0 failures, 0 errors, 0 warnings).

### 1.3 Installed Tooling & Environment Inventory
Command: `.venv/bin/pip list`
Installed packages:
- `pytest` 9.1.1
- `Flask` 3.1.3
- `Werkzeug` 3.1.8
- `Jinja2` 3.1.6
- `MarkupSafe` 3.0.3
- `gunicorn` 26.2.0
- `openai` 3.8.0
- `pypdf` 6.20.0
- `requests` 2.34.2
- `pydantic` 2.13.5
- `python-dotenv` 1.2.3
- `anyio` 4.15.1
- `pluggy` 1.6.0

**Packages NOT Installed in `.venv`**:
- `playwright`: Not installed
- `selenium`: Not installed
- `beautifulsoup4`: Not installed
- `cssutils` / `tinycss2`: Not installed

**System-Level Binaries**:
- `/usr/bin/firefox`: Present
- `/usr/bin/node` (v18+) & `/usr/bin/npm`: Present
- `geckodriver`: NOT installed (`which geckodriver` returned nothing)
- `chromium` / `google-chrome-stable`: NOT installed
- `playwright` / `puppeteer` CLI: NOT installed
- `package.json` / `node_modules`: None in project root (pure Python + static web project)

### 1.4 Current Viewport Meta Tags & CSS Form/Safe Area Status
Direct examination of codebase revealed:
1. **Viewport Meta Tags** across all core HTML files:
   - `account.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
   - `career/chat.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
   - `config-preview.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
   - `flashcard/flashcard.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">`
   - `index.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
   - `schedule/create.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">`
   - `todo/mylist.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
   -> **Zero pages contain `viewport-fit=cover`** currently.

2. **Safe Area CSS Rules**:
   - `shared.css`: `.navbar` (line 142, 1040) is `position: fixed; top: 0; left: 0;` without `env(safe-area-inset-top)`.
   - `account.css`: `.account-topbar` (line 20, 870) has no `env(safe-area-inset-top)`.
   - Bottom insets: only partially applied in `career/chat.css:367` (`chat-input-area`), `schedule/create.css:759`, and `todo/mylist.css:739`.
   - `flashcard/flashcard.css`, `style.css`, `account.css`: **Zero occurrences of `safe-area-inset`**.

3. **Input Font Sizes on Mobile**:
   - `account.css:192`: `.account-input-wrap input { ... font-size: 12px; }` (< 16px)
   - `account.css:242`: `.account-select-wrap select { ... font-size: 11px; }` (< 16px)
   - `schedule/create.css:1260`: `.tc-input { ... font-size: 0.85rem; }` (~13.6px < 16px)
   - `todo/mylist.css:442`: `.todo-search-wrap input { ... font-size: 12px; }` (< 16px)
   - `flashcard/flashcard.css:97`: `.fc-select, .fc-input, .fc-textarea { font-size: 0.95rem; }` (~15.2px < 16px)
   - `shared.css:937`: `.sv-modal-input { ... font-size: 0.92rem; }` (~14.72px < 16px)
   -> Triggers iOS Safari auto-zoom on input focus.

---

## 2. Logic Chain

1. **Test Runner Integration**:
   - Pytest is configured in `pytest.ini` with `testpaths = tests` and `python_files = test_*.py`.
   - Therefore, any new test module named `tests/test_mobile_viewport.py` will be automatically discovered and executed by `.venv/bin/pytest` with zero configuration changes.

2. **Feasibility of Headless Browser vs. Pure-Python Testing**:
   - *Headless Browser (Playwright / Selenium)*: While `/usr/bin/firefox` exists on the host machine, `geckodriver` is missing, `selenium` and `playwright` are not installed in `.venv`, and `chromium` is not present. Adding browser automation would require system-level binary installations, heavy pip packages, network downloads for browser binaries, and slow execution times (>15s startup). Furthermore, it would violate the lightweight environment constraints.
   - *Pure-Python Static & DOM/CSS Testing*: The existing suite already sets a precedent in `tests/test_flashcards.py:274-288` by loading HTML via `flask_app.test_client()` and verifying DOM attributes, classes, and strings. Python's built-in `html.parser` (standard library), regex engine, and Flask test client provide 100% of the functionality required to verify:
     - HTML Viewport meta tags (`viewport-fit=cover`, `width=device-width`, `initial-scale=1.0`) across all 6 core pages.
     - CSS safe area inset declarations (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`) on headers, toolbars, and shells.
     - CSS dynamic viewport units (`100dvh`) on full-height components.
     - Mobile font-size rules (ensuring inputs have `font-size: 16px` or `>= 16px` under mobile media queries/base form styles).
   - *Execution Speed & Determinism*: Pure-Python tests execute in <50ms, are 100% deterministic (no rendering race conditions), and run identically in any development or CI environment without GPU/X11/Wayland dependencies.

3. **Baseline Preservation**:
   - All 130 baseline tests currently pass cleanly in 24.41s. Adding a dedicated mobile viewport test suite will increase test count while maintaining 100% green status once frontend changes are applied.

---

## 3. Caveats

1. **Static vs. Runtime Computed Layout**:
   - Pure-Python regex/DOM verification validates that the correct HTML meta tags, CSS media queries, safe-area rules, and font-size declarations are present in the served assets. It does not measure the actual pixel bounding box or computed DOM layout rendered by Apple WebKit engine on physical hardware.
2. **Third-Party CDN Assets**:
   - FontAwesome (`all.min.css`) and Google Fonts (`Inter`) are loaded via CDN and not parsed or intercepted during test execution.

---

## 4. Conclusion

1. **Baseline State**: The test environment is completely healthy: `.venv/bin/pytest` passes all 130 tests across 3 modules.
2. **Recommended Testing Strategy**:
   - Create a dedicated regression test file: `tests/test_mobile_viewport.py`.
   - Implement automated checks for:
     1. `test_viewport_meta_tags_cover_all_core_pages`: Asserts `viewport-fit=cover`, `width=device-width`, and `initial-scale=1` in `<meta name="viewport">` across all 6 core pages (`index.html`, `account.html`, `career/chat.html`, `flashcard/flashcard.html`, `schedule/create.html`, `todo/mylist.html`).
     2. `test_safe_area_insets_in_css`: Asserts `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` in `shared.css`, `account.css`, `career/chat.css`, `schedule/create.css`, and `todo/mylist.css`.
     3. `test_dynamic_viewport_height_dvh`: Asserts `100dvh` usage with fallbacks in full-height views.
     4. `test_mobile_form_inputs_prevent_safari_zoom`: Asserts that `input`, `select`, and `textarea` elements have `font-size: 16px` (or `>= 16px`) in mobile media queries (`@media (max-width: 768px)` or mobile responsive blocks).
     5. `test_navigation_bar_mobile_integrity`: Asserts navigation structure and absence of conflicting fixed widths exceeding 375px.

### Proposed Implementation Template for `tests/test_mobile_viewport.py`:
```python
"""Automated regression tests for iPhone 11 Pro / iOS Safari mobile viewport compliance:
- Viewport meta tag with viewport-fit=cover across all core pages
- Safe area padding (env(safe-area-inset-top), env(safe-area-inset-bottom))
- Dynamic viewport height (100dvh)
- Mobile form input font-size >= 16px (iOS Safari auto-zoom prevention)
"""
import re
from pathlib import Path
import pytest
from app import app as flask_app

CORE_PAGES = [
    'index.html',
    'account.html',
    'career/chat.html',
    'flashcard/flashcard.html',
    'schedule/create.html',
    'todo/mylist.html',
]

CORE_CSS_FILES = [
    'shared.css',
    'style.css',
    'account.css',
    'career/chat.css',
    'flashcard/flashcard.css',
    'schedule/create.css',
    'todo/mylist.css',
]

BASE_DIR = Path(__file__).resolve().parent.parent


@pytest.fixture
def client():
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as test_client:
        yield test_client


@pytest.mark.parametrize('page', CORE_PAGES)
def test_viewport_meta_tag_includes_viewport_fit_cover(client, page):
    """R1: All core pages must include viewport-fit=cover to support iPhone 11 Pro notch/safe area."""
    resp = client.get('/' + page)
    assert resp.status_code == 200, f"Page {page} must be accessible"
    html = resp.data.decode('utf-8')
    
    meta_match = re.search(r'<meta\s+name=["\']viewport["\']\s+content=["\']([^"\']+)["\']', html, re.IGNORECASE)
    assert meta_match is not None, f"Page {page} must contain a viewport meta tag"
    
    content = meta_match.group(1).lower()
    assert 'width=device-width' in content, f"Page {page} viewport must include width=device-width"
    assert 'viewport-fit=cover' in content, f"Page {page} viewport must include viewport-fit=cover"


def test_safe_area_insets_in_shared_navbar():
    """R1: Fixed navbar in shared.css must incorporate safe-area-inset-top."""
    css_content = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    assert 'safe-area-inset-top' in css_content, "shared.css must reference safe-area-inset-top for header"


def test_safe_area_insets_in_account_topbar():
    """R1: Account topbar in account.css must incorporate safe-area-inset-top."""
    css_content = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    assert 'safe-area-inset-top' in css_content, "account.css must reference safe-area-inset-top"


def test_chat_input_area_safe_area_bottom():
    """R1: Bottom input toolbar in chat.css must have safe-area-inset-bottom."""
    css_content = (BASE_DIR / 'career/chat.css').read_text(encoding='utf-8')
    assert 'safe-area-inset-bottom' in css_content


def test_mobile_input_font_size_prevention_of_safari_zoom():
    """R3: All mobile inputs, selects, and textareas must maintain font-size >= 16px."""
    # Verify shared or page stylesheets enforce font-size >= 16px on mobile viewports
    css_content = (BASE_DIR / 'shared.css').read_text(encoding='utf-8')
    # Check that mobile input rule or general input rule enforces 16px
    assert re.search(r'(input|select|textarea)[^{]*\{[^}]*font-size:\s*16px', css_content) or \
           re.search(r'@media[^{]*max-width:\s*768px[^{]*\{[^}]*(input|select|textarea)[^{]*\{[^}]*font-size:\s*16px', css_content), \
           "shared.css should contain mobile rule ensuring inputs have font-size >= 16px"
```

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Run full baseline test suite**:
   ```bash
   .venv/bin/pytest
   ```
   *Expected result*: 130 passed in ~24s.
2. **Inspect package inventory**:
   ```bash
   .venv/bin/pip list
   ```
   *Expected result*: Matches inventory in Section 1.3.
3. **Verify absence of `viewport-fit=cover` in current HTML files**:
   ```bash
   grep -rn "viewport-fit=cover" *.html career/*.html flashcard/*.html schedule/*.html todo/*.html || echo "None found"
   ```
   *Expected result*: "None found" (confirms existing gap).
4. **Verify absence of `safe-area-inset-top` in shared navbar**:
   ```bash
   grep -rn "safe-area-inset-top" shared.css || echo "None found"
   ```
   *Expected result*: "None found" (confirms existing gap).

### 5.2 Invalidation Conditions
- Any changes to `.venv` installing playwright/selenium would invalidate the recommendation of pure-Python static tests.
- Baseline test failures on untouched branches would invalidate Section 1.2.
