# Hardening & Remediation Handoff Report: Milestone T1 Test Suite

**Agent**: worker_t1_harden (Test Hardening Specialist)  
**Parent Orchestrator**: `bdce3044-e260-4522-8179-cfcdc4c408ba`  
**Date**: 2026-10-13  
**Working Directory**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_t1_harden/`  
**Exclusively Owned Artifacts**:
- `tests/test_mobile_viewport.py`
- `TEST_READY.md`
- `TEST_INFRA.md`

---

## 1. Observation

Direct empirical observations from `tests/test_mobile_viewport.py`, stylesheets, application code, test execution, and audit reports:

### 1.1 Remediation of Tautological 'or' Fallbacks & Facades
1. **Tier 2 (Safe Area Insets)**:
   - In `test_tier2_safe_area_top_shared_navbar`, stripped `or 'safe-area-inset-top' in css`. Scoped assertion to `_extract_rule_declarations(css, r'\.navbar')`.
   - In `test_tier2_safe_area_top_navbar_height`, verified `.navbar` computes `min-height` or `padding-top` with `env(safe-area-inset-top)`.
   - In `test_tier2_safe_area_bottom_shared_guest_notice`, stripped `or 'safe-area-inset-bottom' in css`. Scoped assertion to `_extract_rule_declarations(css, r'\.sv-guest-notice')`.
   - In page container tests, scoped top and bottom safe area checks directly to target selectors (`.account-topbar`, `.main-content`, `.main-career`, `.main-schedule`, `.project-wrapper`, `.fc-main`, `.account-footer`, `.chat-input-area`, `.fc-review-actions`).

2. **Tier 3 (Dynamic Viewport Height & Fallback Order)**:
   - Replaced substring checks (`assert '100vh' in css and '100dvh' in css`) with `assert_viewport_fallback_order(css, selector)`.
   - Verified that within each full-height container rule (`.account-page`, `.main-career`, `.fc-main`, `.main-schedule`, `.project-wrapper`), `100vh` strictly precedes `100dvh` in declaration sequence.
   - Enforced a file-wide anti-inversion invariant verifying that nowhere in the stylesheet does `100dvh` precede `100vh` within a rule block.

3. **Tier 4 (Mobile Form Input Zoom Prevention)**:
   - Completely stripped all global substring fallbacks (`or '16px' in css`, `or 'font-size: 16px' in css`, `assert '16px' in css`).
   - Integrated zero-dependency helper functions:
     - `_extract_media_blocks(css, max_width_threshold)`
     - `_extract_rule_declarations(css_text, selector_pattern)`
     - `_get_rule_declaration(css_block, selector_pattern, prop)`
     - `_parse_font_size_px(val)`
     - `_is_font_size_ge_16(val)`
     - `_get_effective_mobile_font_size(css, selector_pattern, max_width_limit)`
   - Scoped every test to its designated selector (`.sv-modal-input`, `.account-input-wrap input`, `.account-select-wrap select`, `.tc-input`, `.todo-search-wrap input`, `.todo-filter-row select`, `.task-meta-grid select`, `.fc-select`, `.fc-input`, `.fc-textarea`, `.fc-preview-input`).

4. **Tier 5 (Responsive Reflow & Boundary Integrity)**:
   - Replaced fragile single-level regex with nested brace matching via `_extract_media_blocks(css, max_width_threshold=768)`.
   - In `test_tier5_hero_title_no_rigid_nowrap_on_mobile`, now scans all rules inside mobile `@media` blocks. It caught line 725 in `style.css` (`.hero-title { font-size: 22px !important; white-space: nowrap !important; }`), which previously slipped past `[^}]*`.
   - In `test_tier5_schedule_container_no_rigid_min_width_overflow`, scans all media queries (`768px`, `640px`) and caught line 712 (`.timetable { min-width: 700px; }`) and line 756 (`.timetable { min-width: 600px; }`).
   - In `test_tier5_card_ai_and_task_microcards_fit_mobile`, replaced bare class name check (`assert '.card-ai' in css and '.card-task' in css`) with verification of mobile scaling overrides (`transform: scale(...)`), reflow properties, absence of rigid widths > 375px, and hiding of secondary cards (`.card-schedule`, `.card-streak`).

### 1.2 Test Execution Results on Hardened Suite
Running `.venv/bin/pytest tests/test_mobile_viewport.py`:
```
FAILED tests/test_mobile_viewport.py::test_tier4_input_font_size_shared_modal - AssertionError: .sv-modal-input font-size must be >= 16px (or >= 1rem) on mobile viewports, got '0.92rem'
FAILED tests/test_mobile_viewport.py::test_tier4_input_font_size_shared_mobile_base - AssertionError: shared.css must define a mobile media query rule (<= 768px) ensuring input, select, textarea have font-size >= 16px
FAILED tests/test_mobile_viewport.py::test_tier4_input_font_size_account_inputs - AssertionError: account.css inputs must have font-size >= 16px on mobile viewports (<= 768px), got '12px'
FAILED tests/test_mobile_viewport.py::test_tier4_input_font_size_account_selects - AssertionError: account.css selects must have font-size >= 16px on mobile viewports (<= 768px), got '11px'
FAILED tests/test_mobile_viewport.py::test_tier4_input_font_size_schedule_tc_input - AssertionError: schedule/create.css .tc-input must have font-size >= 16px (or >= 1rem) on mobile, got '0.85rem'
FAILED tests/test_mobile_viewport.py::test_tier4_input_font_size_todo_search_input - AssertionError: todo/mylist.css search input must have font-size >= 16px on mobile, got '12px'
FAILED tests/test_mobile_viewport.py::test_tier4_input_font_size_todo_task_inputs - AssertionError: todo/mylist.css filter selects must have font-size >= 16px on mobile, got '12px'
FAILED tests/test_mobile_viewport.py::test_tier4_input_font_size_flashcard_controls - AssertionError: flashcard.css .fc-select must have font-size >= 16px (or >= 1rem) on mobile, got '0.95rem'
FAILED tests/test_mobile_viewport.py::test_tier4_no_sub16px_inline_font_sizes_in_mylist_js - AssertionError: todo/mylist.js must not inject inputs with inline font-size < 16px: found ['14px']
FAILED tests/test_mobile_viewport.py::test_tier5_hero_title_no_rigid_nowrap_on_mobile - AssertionError: style.css enforces white-space: nowrap on .hero-title under mobile media queries: [('(max-width: 768px)', 'font-size: 22px !important;\n white-space: nowrap !important;')]
FAILED tests/test_mobile_viewport.py::test_tier5_schedule_container_no_rigid_min_width_overflow - AssertionError: Found rigid min-widths > 375px in mobile schedule css: [('(max-width: 768px)', '.timetable', '700px'), ('(max-width: 640px)', '.timetable', '600px')]
FAILED tests/test_mobile_viewport.py::test_tier5_todo_media_query_cascade_order - AssertionError: todo/mylist.css: media query for 768px should appear BEFORE 600px so narrower styles override wider ones
=========================== 12 failed, 64 passed in 7.92s ===========================
```

### 1.3 Baseline Test Suite Execution
Running `.venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py`:
```
=========================== 130 passed in 8.66s ===========================
```

---

## 2. Logic Chain

1. **Premise 1 (Integrity & Anti-Cheat Standard)**: Under development mode integrity mandates, tests must not mask bugs with tautological fallbacks or defective regex matchers. Unoptimized code must produce failing (RED) assertions.
2. **Premise 2 (Empirical Defect Tracing in Previous Suite)**:
   - In the previous test suite, 74 of 76 tests passed even though Milestones M2, M3, and M4 had not yet been implemented.
   - Tracing showed that `assert 'font-size: 16px' in css or ...` short-circuited on unrelated rules like `.stat-value` or `.logo`.
   - Single-level regexes `\{[^}]*\.hero-title` terminated at preceding sibling rules like `.main-content`, failing to reach `.hero-title` or `.timetable`.
3. **Premise 3 (Effect of Hardened Balanced-Brace Parsers)**:
   - Replacing single-level regexes with depth-tracking brace parsers (`_extract_media_blocks`) parses all rules inside nested `@media` queries regardless of order or sibling count.
   - Binding font-size assertions directly to targeted selectors eliminates tautological bypasses.
4. **Premise 4 (Empirical Red Signal Verification)**:
   - Running the hardened suite against the current codebase yields exactly 64 passing tests and 12 failing tests.
   - The 12 failing tests correspond precisely to:
     - 9 form zoom tests for sub-16px styles (`account.css` 12px/11px, `create.css` 0.85rem, `mylist.css` 12px, `flashcard.css` 0.95rem, `shared.css` 0.92rem, `mylist.js` 14px) -> Milestone M3 scope.
     - 3 reflow and cascade tests (`style.css` line 725 nowrap, `create.css` 700px/600px timetable min-widths, `mylist.css` 600px before 768px cascade) -> Milestone M4 scope.
5. **Conclusion**: The test suite now provides an authentic, honest RED baseline that accurately exposes every remaining defect and will transition to GREEN dynamically as workers implement Milestones M3 and M4.

---

## 3. Caveats

- **Driverless Constraint**: In accordance with project architecture, all assertions are pure Python (Flask test client + CSS parser helpers) without requiring external browser binaries (Playwright/Puppeteer).
- **Milestone Scope Isolation**: This agent exclusively owns and modifies test infrastructure and documentation (`tests/test_mobile_viewport.py`, `TEST_READY.md`, `TEST_INFRA.md`). No application source stylesheets or templates were modified; their remediation is reserved for worker agents in Milestones M3 and M4.

---

## 4. Conclusion

The test suite in `tests/test_mobile_viewport.py` is fully hardened, free of facades and tautologies, and compliant with all Forensic Integrity mandates. `TEST_READY.md` and `TEST_INFRA.md` honestly document the 64 PASS / 12 FAIL breakdown. The authentic red baseline is ready for worker agents to implement Milestones M3 and M4.

---

## 5. Verification Method

### 5.1 Verification Commands
1. **Execute Mobile Viewport Suite**:
   ```bash
   .venv/bin/pytest tests/test_mobile_viewport.py
   ```
   *Expected Result: 12 failed, 64 passed in ~8s.*
   *Verify that all 12 failures are authentic, informative assertion errors on sub-16px fonts, nowrap, and min-widths.*

2. **Execute Baseline Regression Suite**:
   ```bash
   .venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py
   ```
   *Expected Result: 130 passed in ~9s.*

3. **Verify Absence of Tautological 'or' Fallbacks in Test File**:
   ```bash
   grep -n "or '16px' in css" tests/test_mobile_viewport.py
   grep -n "or 'font-size: 16px' in css" tests/test_mobile_viewport.py
   grep -n "or 'safe-area-inset" tests/test_mobile_viewport.py
   ```
   *Expected Result: Zero matches.*

4. **Verify Detection of Hero Title Nowrap in style.css**:
   ```bash
   .venv/bin/pytest tests/test_mobile_viewport.py -k test_tier5_hero_title_no_rigid_nowrap_on_mobile
   ```
   *Expected Result: FAILED (AssertionError: style.css enforces white-space: nowrap on .hero-title under mobile media queries).*

5. **Verify Detection of Schedule Timetable Min-Width**:
   ```bash
   .venv/bin/pytest tests/test_mobile_viewport.py -k test_tier5_schedule_container_no_rigid_min_width_overflow
   ```
   *Expected Result: FAILED (AssertionError: Found rigid min-widths > 375px in mobile schedule css: [('(max-width: 768px)', '.timetable', '700px'), ('(max-width: 640px)', '.timetable', '600px')]).*

### 5.2 Invalidation Conditions
- If any test function in `tests/test_mobile_viewport.py` employs `or '16px' in css` or `or 'font-size: 16px' in css`.
- If `test_tier5_hero_title_no_rigid_nowrap_on_mobile` or `test_tier5_schedule_container_no_rigid_min_width_overflow` falsely passes while unoptimized styles remain in `style.css` and `schedule/create.css`.
- If `tests/test_app.py`, `tests/test_flashcards.py`, or `tests/test_schedule_utils.py` experience any regressions.
