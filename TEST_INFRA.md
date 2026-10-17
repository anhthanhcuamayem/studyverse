# TEST_INFRA.md — Mobile Viewport & Testing Infrastructure Specification

**Project**: Studyverse Mobile Viewport & iOS Safari Optimization  
**Device Target**: iPhone 11 Pro (375x812 pt, Notch: ~44px, Home Indicator: ~34px, iOS Safari)  
**Author**: worker_t1_harden (Test Hardening Specialist)  
**Date**: 2026-10-13  
**Status**: HARDENED ARCHITECTURE ACTIVE  

---

## 1. Overview & Testing Philosophy

The Studyverse mobile viewport testing infrastructure provides fast (<15s), deterministic, and comprehensive verification of mobile responsive behaviors, iOS safe area geometries, dynamic viewport units, and Safari form interactions.

Because the production runtime environment operates without heavy browser driver binaries (such as `geckodriver` or `chromium-driver`), the test suite adopts an **opaque-box pure-Python DOM and CSS verification architecture**. By combining the Flask test client (`flask_app.test_client()`) with custom zero-dependency brace-balanced CSS parser helpers (`_extract_media_blocks`, `_extract_rule_declarations`, `_get_rule_declaration`, `_parse_font_size_px`, `_is_font_size_ge_16`, `_get_effective_mobile_font_size`, `assert_viewport_fallback_order`), the test suite asserts against both served HTTP payloads and underlying static stylesheet rules with 100% reproducibility across all environments.

---

## 2. Target Profile & Interface Specifications

### Target Device Profile: iPhone 11 Pro
- **Screen Dimensions**: 375 pt width × 812 pt height (3x Retina display)
- **Top Safe Area Inset**: ~44 pt (hardware camera notch and system status bar)
- **Bottom Safe Area Inset**: ~34 pt (iOS system Home Indicator bar)
- **Browser Engine**: Apple WebKit / iOS Mobile Safari
- **Auto-Zoom Trigger**: Text inputs, selects, or textareas with computed `font-size < 16px` trigger automatic viewport zooming upon tap/focus, breaking UI alignment.

### Interface Contracts Under Verification
1. **HTML Viewport Meta Contract (R1)**:
   - `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` across all 7 core pages.
2. **Safe Area Insets Contract (R1)**:
   - Fixed top navbar uses `env(safe-area-inset-top, 0px)` (or standard `env(safe-area-inset-top)`).
   - Fixed bottom toolbars and `.sv-guest-notice` use `env(safe-area-inset-bottom, 0px)`.
   - Content containers (`.main-content`, `.main-career`, `.main-schedule`, `.project-wrapper`, `.fc-main`) offset top padding to account for safe area navbar height.
3. **Dynamic Viewport Height Contract (R1)**:
   - Full-height components declare `100dvh` preceded by `100vh` fallback in CSS declaration order.
4. **Form Input Auto-Zoom Prevention Contract (R3)**:
   - Mobile viewports (<= 768px) declare `font-size >= 16px` (or `1rem`) for all interactive inputs (`input`, `select`, `textarea`).
   - Dynamic JavaScript (`todo/mylist.js`) and HTML templates (`todo/mylist.html`) must not inject inline styles with `font-size < 16px`.
5. **Horizontal Boundary & Reflow Contract (R2 & R4)**:
   - Zero horizontal overflow on 375px viewport (`overflow-x: hidden` guard).
   - Homepage `.hero-title` does not retain `white-space: nowrap !important` on mobile.
   - Floating micro-cards (`.card-ai`, `.card-task`) reflow and scale within 375px.
   - Preserves all navigation elements (`.navigation`, `/flashcard/flashcard.html`, `data-i18n="nav.flashcard"`, `fa-layer-group`).

---

## 3. Test Suite Architecture & Balanced-Brace CSS Parsing

The test suite is located at `tests/test_mobile_viewport.py` and contains 76 test cases structured into five distinct tiers.

### Zero-Dependency CSS Parsing Architecture
To avoid the defects of single-level regex matching (which prematurely terminate at the first closing brace inside nested `@media` blocks), the suite implements:
1. `_extract_media_blocks(css, max_width_threshold)`: Tracks nested brace depth (`{ ... }`), handling CSS comments (`/* ... */`) and string quotes (`"..."`, `'...'`). Accurately isolates interior rules of all mobile media queries.
2. `_extract_rule_declarations(css_text, selector_pattern)`: Extracts declaration bodies for target selectors across single and comma-separated selector lists.
3. `_get_effective_mobile_font_size(css, selector_pattern, max_width_limit)`: Evaluates mobile media query overrides first, then falls back to base rules, preventing facade passes.
4. `assert_viewport_fallback_order(css, selector)`: Enforces that `100vh` strictly precedes `100dvh` in declaration order, preventing cascade override bugs.

### Tier Classification:
- **Tier 1: Viewport Meta Tag & Geometry (R1)** — 27 Test Cases (27 Passing)
- **Tier 2: Safe Area CSS Insets (R1)** — 15 Test Cases (15 Passing)
- **Tier 3: Dynamic Viewport Units (100dvh) (R1)** — 10 Test Cases (10 Passing)
- **Tier 4: Mobile Form Input Zoom Prevention (R3)** — 11 Test Cases (2 Passing, 9 Failing / Red Baseline)
- **Tier 5 / Boundary: Responsive Reflow & 375px Boundary (R2 & R4)** — 13 Test Cases (10 Passing, 3 Failing / Red Baseline)

---

## 4. Test Execution & Tooling

### Test Environment
- Python: 3.12.3
- Pytest: 9.1.1
- Framework: Flask 3.1.3 Test Client
- Configuration: `pytest.ini` (`testpaths = tests`, `python_files = test_*.py`)

### Execution Commands

1. **Run Mobile Viewport Test Suite**:
   ```bash
   .venv/bin/pytest tests/test_mobile_viewport.py
   ```

2. **Run Existing Baseline Test Suites**:
   ```bash
   .venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py
   ```

3. **Run Complete Project Test Suite**:
   ```bash
   .venv/bin/pytest
   ```

---

## 5. Anti-Cheat & Forensic Verification Standard

Every test case in `tests/test_mobile_viewport.py` adheres to the strict **Teamwork Anti-Cheat and Integrity Protocol**:
- **Zero Facade Fallbacks**: No file-wide string existence fallbacks (`or '16px' in css`, `or 'font-size: 16px' in css`, `assert '16px' in css`).
- **Dynamic Red-to-Green Progression**: Tests legitimately fail on unoptimized code and immediately turn green once corresponding worker milestones (M3 & M4) are implemented.
- **Specific Error Messages**: Assertions output explicit messages specifying the offending selector, current sub-16px font size, or rigid min-width value.
