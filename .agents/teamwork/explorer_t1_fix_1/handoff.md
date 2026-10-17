# Forensic Audit Remediation Plan: Milestone T1 Mobile Viewport Suite

**Agent**: `explorer_t1_fix_1` (Forensic Audit Remediation Explorer)  
**Parent Orchestrator**: `bdce3044-e260-4522-8179-cfcdc4c408ba`  
**Date**: 2026-10-13  
**Working Directory**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_1/`  
**Target Artifacts to Remediate**:
- `tests/test_mobile_viewport.py`
- `TEST_READY.md`
- `TEST_INFRA.md`

---

## 1. Observation

Direct empirical observations gathered from inspecting `tests/test_mobile_viewport.py`, source stylesheets, audit reports (`auditor_t1_1`, `reviewer_t1_1`, `reviewer_t1_2`, `challenger_t1_2`), and live terminal execution:

### 1.1 Empirical Verification of False Greens (Current Suite Execution)
Running `.venv/bin/pytest tests/test_mobile_viewport.py` on the current codebase produces:
```
=========================== short test summary info ============================
FAILED tests/test_mobile_viewport.py::test_tier4_no_sub16px_inline_font_sizes_in_mylist_js
FAILED tests/test_mobile_viewport.py::test_tier5_todo_media_query_cascade_order
======================== 2 failed, 74 passed in 10.29s =========================
```
Only 2 tests fail out of 76. Milestones M2 (Header & Nav), M3 (Mobile Form Zoom Prevention), and M4 (Reflow & Min-Widths) have **not** been implemented yet by worker agents. Nevertheless, 74 tests pass, masking active specification violations.

### 1.2 Exact Flaws in Tier 4: Mobile Form Input Zoom Prevention (R3)

1. **`test_tier4_input_font_size_account_inputs` (`tests/test_mobile_viewport.py:313-320`)**:
   - *Test implementation*:
     ```python
     assert 'font-size: 16px' in css or not re.search(r'\.account-input-wrap\s+input[^{]*\{[^}]*font-size:\s*(1[0-5]px|\dpx)', css), (
         "account.css inputs must not have font-size < 16px on mobile"
     )
     ```
   - *Active Code State (`account.css:195`)*:
     ```css
     .account-input-wrap input { ... font-size: 12px; ... }
     ```
   - *Bypass Mechanism*: In `account.css:228-234`, `.streak-card .stat-icon-wrap { font-size: 16px; }` and `.stat-value { font-size: 16px; }` exist. The clause `'font-size: 16px' in css` evaluates to `True`, short-circuiting the test and ignoring the 12px input.

2. **`test_tier4_input_font_size_account_selects` (`tests/test_mobile_viewport.py:322-328`)**:
   - *Active Code State (`account.css:245`)*:
     ```css
     .account-select-wrap select { ... font-size: 11px; ... }
     ```
   - *Bypass Mechanism*: Same tautological `'font-size: 16px' in css` short-circuit ignores the 11px select.

3. **`test_tier4_input_font_size_schedule_tc_input` (`tests/test_mobile_viewport.py:330-337`)**:
   - *Test implementation*:
     ```python
     assert 'font-size: 16px' in css or 'font-size: 1rem' in css or \
            not re.search(r'\.tc-input[^{]*\{[^}]*font-size:\s*0\.[78]\d*rem', css)
     ```
   - *Active Code State (`schedule/create.css:1262, 1355`)*:
     Line 1262 sets `.tc-input { font-size: 0.85rem; }` (~13.6px). Mobile `@media (max-width: 640px)` at line 1355 sets `width: 100%`, retaining 0.85rem.
   - *Bypass Mechanism*: Line 722 sets `input[type="text"], input[type="number"] { font-size: 16px; }`. This satisfies `'font-size: 16px' in css`, causing unconditional pass.

4. **`test_tier4_input_font_size_schedule_modal_inputs` (`tests/test_mobile_viewport.py:339-344`)**:
   - *Test implementation*:
     ```python
     assert '16px' in css, "schedule/create.css must enforce 16px on mobile inputs"
     ```
   - *Bypass Mechanism*: Pure facade. Checks only that literal `'16px'` exists anywhere in the 1404-line file. Zero selector or input inspection.

5. **`test_tier4_input_font_size_flashcard_controls` (`tests/test_mobile_viewport.py:359-363`)**:
   - *Test implementation*:
     ```python
     assert '16px' in css or '1rem' in css
     ```
   - *Active Code State (`flashcard/flashcard.css:98`)*:
     ```css
     .fc-select, .fc-input, .fc-textarea { font-size: 0.95rem; } /* 15.2px < 16px */
     ```
   - *Bypass Mechanism*: Passes unconditionally because lines 72-73 contain `padding: 10px 16px;` and `border-radius: 16px;`.

6. **`test_tier4_input_font_size_shared_modal` (`tests/test_mobile_viewport.py:290-300`)**:
   - *Test implementation*:
     ```python
     match = re.search(r'\.sv-modal-input[^{]*\{[^}]*font-size:\s*([^;]+);', css)
     if match:
         val = match.group(1).strip()
         assert '16px' in val or '1rem' in val or float(re.search(r'([\d.]+)', val).group(1)) >= 16 or '16px' in css
     ```
   - *Active Code State (`shared.css:939`)*:
     ```css
     .sv-modal-input { font-size: 0.92rem; } /* 14.72px < 16px */
     ```
   - *Bypass Mechanism*: If `match` is None, zero assertions execute. If matched, trailing `or '16px' in css` matches `backdrop-filter: blur(16px)` on line 151 or `.logo { font-size: 16px; }` on line 1091.

7. **`test_tier4_input_font_size_shared_mobile_base` (`tests/test_mobile_viewport.py:302-311`)**:
   - *Bypass Mechanism*: Ends with `or 'font-size: 16px' in css`, satisfied by line 1091 `.logo { font-size: 16px; }`.

8. **`test_tier4_input_font_size_todo_search_input` (`tests/test_mobile_viewport.py:345-351`)**:
   - *Active Code State (`todo/mylist.css:443`)*: `.todo-search-wrap input { font-size: 12px; }`.
   - *Bypass Mechanism*: Bypassed by `or 'font-size: 16px' in css` satisfied by line 725 `#taskNameInput, ... { font-size: 16px; }`.

9. **`test_tier4_input_font_size_todo_task_inputs` (`tests/test_mobile_viewport.py:353-357`)**:
   - *Test implementation*: `assert 'font-size: 16px' in css`. Global file substring check.

10. **`test_tier4_career_chat_textarea_maintains_16px` (`tests/test_mobile_viewport.py:375-380`)**:
    - *Test implementation*: Rigid regex requiring literal `16px`, rejecting valid values such as `1rem` or `18px`.

11. **`test_tier4_no_sub16px_inline_font_sizes_in_mylist_js` (`tests/test_mobile_viewport.py:365-373`)**:
    - *Test implementation*: Matches only double quotes `style="..."`, ignoring single quotes `style='...'`.

### 1.3 Exact Flaws in Tier 5: Responsive Reflow & Boundary Integrity (R2 & R4)

1. **`test_tier5_hero_title_no_rigid_nowrap_on_mobile` (`tests/test_mobile_viewport.py:387-394`)**:
   - *Test regex*:
     ```python
     assert not re.search(r'@media[^{]*max-width:\s*(?:768|600|480)px[^{]*\{[^}]*\.hero-title[^{]*\{[^}]*white-space:\s*nowrap\s*!important', css, re.DOTALL)
     ```
   - *Active Code State (`style.css:713-726`)*:
     ```css
     @media (max-width: 768px) {
         .main-content { padding-top: calc(76px + ...); }
         .desktop-only { display: none; }
         .hero-title {
             font-size: 22px !important;
             white-space: nowrap !important;
         }
     ```
   - *Defect Proof*: The pattern `\{[^}]*\.hero-title` halts at the first closing brace `}` (the closing brace of `.main-content`). Running Python confirmed `re.search` evaluates to `None`. `assert not None` evaluates to `True`, concealing active nowrap enforcement on mobile!

2. **`test_tier5_schedule_container_no_rigid_min_width_overflow` (`tests/test_mobile_viewport.py:409-414`)**:
   - *Test regex*: `(?:768|600|480)px[^{]*\{[^}]*min-width:\s*([4-9]\d\d+px)`.
   - *Active Code State (`schedule/create.css:712, 756`)*:
     - Line 712 (`max-width: 768px`): `.timetable { min-width: 700px; }`.
     - Line 756 (`max-width: 640px`): `.timetable { min-width: 600px; }`.
   - *Defect Proof*: Regex omits `640px` entirely, and inside 768px `[^}]*` halts at preceding rule `.timetable-legend div`. Python confirmed `rigid_min_widths` returns `[]`, masking 700px and 600px mobile overflows.

3. **`test_tier5_flashcard_scene_no_rigid_min_width_overflow` & `test_tier5_career_chat_no_rigid_min_width_overflow` (`lines 402-407, 416-421`)**:
   - Same `[^}]*` early termination regex defect.

4. **`test_tier5_card_ai_and_task_microcards_fit_mobile` (`tests/test_mobile_viewport.py:396-400`)**:
   - *Test implementation*:
     ```python
     assert '.card-ai' in css and '.card-task' in css
     ```
   - *Defect*: Both strings existed in the pre-existing desktop stylesheet. Zero assertion on mobile media queries, scaling, or positioning.

### 1.4 Exact Flaws in Tier 2 & Tier 3

1. **Tier 2 Safe Area Tautologies (`tests/test_mobile_viewport.py:118-135, 172-178`)**:
   - `test_tier2_safe_area_top_shared_navbar`, `test_tier2_safe_area_top_navbar_height`, and `test_tier2_safe_area_bottom_shared_guest_notice` terminate with `or 'safe-area-inset-top' in css` or `or 'safe-area-inset-bottom' in css`, neutralizing selector-level assertions.
   - Container offset tests (lines 136-170, 180-208) are unscoped global substring checks (`assert 'safe-area-inset-top' in css`).
2. **Tier 3 Viewport Fallback Order Blindness (`tests/test_mobile_viewport.py:256-285`)**:
   - `assert '100vh' in css and '100dvh' in css` does not verify declaration order (`100vh` must appear before `100dvh` in CSS cascade).

---

## 2. Logic Chain

1. **Premise 1 (Policy & Mission)**: Under Development Mode integrity standards, facade assertions, tautological disjunctions, and defective regexes that greenlight non-compliant code constitute an `INTEGRITY VIOLATION`. The test suite must provide authentic Red-to-Green signals: tests must FAIL when unoptimized code is present, and PASS only when compliant code is introduced.
2. **Premise 2 (Empirical Reality)**: Observations 1.2 and 1.3 prove that 11 tests across Tier 4 and Tier 5 pass unconditionally while unoptimized sub-16px inputs (11px, 12px, 0.85rem, 0.95rem), rigid mobile min-widths (700px, 600px), and mobile hero title nowrap are actively present in the codebase.
3. **Premise 3 (Root Cause Analysis)**:
   - *Root Cause A*: Broad string fallbacks (`or '16px' in css`, `or 'font-size: 16px' in css`) were introduced to tolerate styling variations, but in practice they matched unrelated rules (e.g. `.stat-value`, `.logo`, `padding`, `backdrop-filter`).
   - *Root Cause B*: Single-level regular expressions (`\{[^}]*selector`) cannot parse nested CSS structures (`@media { selector { ... } }`), because `[^}]*` terminates at the closing brace of the first sibling rule inside the media query block.
4. **Premise 4 (Remediation Constraint)**: The fix strategy must NOT recommend circumventions (such as commenting out tests, using `pytest.mark.skip`, lowering standards, or relying on mock flags). It must provide genuine, rigorous parsing logic that evaluates the actual CSS rule applied to the targeted selector.
5. **Conclusion**: The test writer agent (`test_writer_t1_gen2`) must replace all facade fallbacks and defective regexes with structured, selector-scoped CSS parsing. When this remediation is applied, the test suite will legitimately transition from 74 passes to ~58 passes and ~18 failures, providing the true, honest RED baseline required for workers M2, M3, and M4.

---

## 3. Caveats

- **Driverless Constraint**: The test environment lacks headless browser binaries (no Chromium/Playwright). The test suite must remain driverless (Flask test client + pure-Python CSS parsing). The remediation does not introduce browser drivers; it replaces fragile regular expressions with structured CSS block parsing in pure Python.
- **Worker Milestone M1 Status**: HTML viewport meta tags (`viewport-fit=cover`) and basic safe area navbar insets were already implemented by worker M1. Genuine tests for Tier 1 and M1 navbar will remain GREEN.
- **Scope Limitation**: As Explorer, this agent provides the definitive architectural fix strategy; implementation is assigned to the test writer (`test_writer_t1_gen2`).

---

## 4. Conclusion & Actionable Fix Strategy

### 4.1 Systemic Architecture: Pure-Python Balanced-Brace CSS Parser
Instead of using fragile regexes with `[^}]*`, `tests/test_mobile_viewport.py` must include three lightweight, zero-dependency helper utilities at the top of the file:

```python
def _extract_media_query_blocks(css: str, max_width_pattern: str = r'(?:768|720|640|600|480|420|400|375)') -> list[tuple[str, str]]:
    """Extract all @media blocks matching mobile max-width conditions using balanced-brace parsing.
    Returns list of (media_condition, interior_css_block).
    """
    blocks = []
    pattern = re.compile(rf'@media[^{{]*max-width:\s*{max_width_pattern}px[^{{]*\{{')
    for m in pattern.finditer(css):
        start = m.end()
        depth = 1
        pos = start
        while pos < len(css) and depth > 0:
            if css[pos] == '{':
                depth += 1
            elif css[pos] == '}':
                depth -= 1
            pos += 1
        if depth == 0:
            blocks.append((m.group(0), css[start:pos - 1]))
    return blocks


def _extract_selector_declarations(css_text: str, selector: str) -> list[str]:
    """Find all declaration blocks { ... } for a specific selector within given CSS text."""
    # Matches selector followed by '{' and captures until matching '}'
    escaped = re.escape(selector)
    pattern = re.compile(rf'(?:^|,|\}}\s*)\s*{escaped}\s*\{{([^}}]+)\}}', re.MULTILINE)
    return pattern.findall(css_text)


def _parse_font_size_px(declaration_block: str) -> float | None:
    """Extract font-size value and convert to numeric px (assuming 1rem = 16px)."""
    m = re.search(r'font-size:\s*([0-9.]+)(px|rem)', declaration_block)
    if not m:
        return None
    val, unit = float(m.group(1)), m.group(2)
    return val if unit == 'px' else val * 16.0
```

---

### 4.2 Function-by-Function Remediation Specification

#### Remediation 1: `test_tier4_input_font_size_account_inputs` (`lines 313-320`)
- **Current Defect**: `assert 'font-size: 16px' in css or not re.search(...)` passes on 12px input.
- **Remediation Specification**:
  ```python
  def test_tier4_input_font_size_account_inputs():
      """R3: account.css input fields must maintain font-size >= 16px on mobile viewports."""
      css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
      # Base input selector check:
      base_blocks = _extract_selector_declarations(css, '.account-input-wrap input')
      mobile_blocks = []
      for _, body in _extract_media_query_blocks(css):
          mobile_blocks.extend(_extract_selector_declarations(body, '.account-input-wrap input'))
          mobile_blocks.extend(_extract_selector_declarations(body, 'input'))
      
      # Must have a mobile rule with font-size >= 16px, or base font-size >= 16px without mobile override < 16px
      all_declarations = mobile_blocks if mobile_blocks else base_blocks
      assert all_declarations, "account.css must define declarations for .account-input-wrap input"
      font_sizes = [_parse_font_size_px(d) for d in all_declarations if _parse_font_size_px(d) is not None]
      assert font_sizes and min(font_sizes) >= 16.0, (
          f".account-input-wrap input must have font-size >= 16px on mobile; found {font_sizes}"
      )
  ```
- **Expected State on Current Codebase**: **FAIL / RED** (`found [12.0]`).
- **Turns GREEN when**: Worker M3 adds `.account-input-wrap input { font-size: 16px; }` in mobile query.

#### Remediation 2: `test_tier4_input_font_size_account_selects` (`lines 322-328`)
- **Current Defect**: Bypassed by `'font-size: 16px' in css` while select is 11px.
- **Remediation Specification**:
  - Extract `.account-select-wrap select` in mobile media queries (or base).
  - Assert `font-size >= 16px` (or `1rem`).
- **Expected State on Current Codebase**: **FAIL / RED** (`found [11.0]`).
- **Turns GREEN when**: Worker M3 adds `.account-select-wrap select { font-size: 16px; }` in mobile query.

#### Remediation 3: `test_tier4_input_font_size_schedule_tc_input` (`lines 330-337`)
- **Current Defect**: Bypassed by line 722 while `.tc-input` is 0.85rem (13.6px).
- **Remediation Specification**:
  - Check `.tc-input` specifically in base or mobile media query blocks.
  - Assert `min(font_sizes) >= 16.0`.
- **Expected State on Current Codebase**: **FAIL / RED** (`found [13.6]`).
- **Turns GREEN when**: Worker M3 updates `.tc-input` to `font-size: 16px` or `1rem` on mobile.

#### Remediation 4: `test_tier4_input_font_size_schedule_modal_inputs` (`lines 339-344`)
- **Current Defect**: Vacuous `assert '16px' in css`.
- **Remediation Specification**:
  - Check modal inputs: `.time-config-modal input`, `.tc-input`, and `#subjectName, #room, #teacher` in `schedule/create.css`.
  - Assert they declare `font-size >= 16px` or `1rem` under mobile viewports.
- **Expected State on Current Codebase**: **FAIL / RED**.

#### Remediation 5: `test_tier4_input_font_size_flashcard_controls` (`lines 359-363`)
- **Current Defect**: Vacuous `assert '16px' in css or '1rem' in css` while controls are 0.95rem.
- **Remediation Specification**:
  ```python
  def test_tier4_input_font_size_flashcard_controls():
      """R3: flashcard/flashcard.css .fc-select, .fc-input, .fc-textarea must maintain font-size >= 16px on mobile."""
      css = (BASE_DIR / 'flashcard/flashcard.css').read_text(encoding='utf-8')
      # Extract selectors in mobile media queries or base rule:
      fc_blocks = []
      for sel in ['.fc-select', '.fc-input', '.fc-textarea']:
          for _, body in _extract_media_query_blocks(css):
              fc_blocks.extend(_extract_selector_declarations(body, sel))
          if not fc_blocks:
              # Fallback to combined selector in base rule
              m = re.findall(r'(?:\.fc-select|\.fc-input|\.fc-textarea)[^{]*\{([^}]+)\}', css)
              fc_blocks.extend(m)
      font_sizes = [_parse_font_size_px(d) for d in fc_blocks if _parse_font_size_px(d) is not None]
      assert font_sizes and min(font_sizes) >= 16.0, (
          f"flashcard form controls must have font-size >= 16px on mobile; found {font_sizes}"
      )
  ```
- **Expected State on Current Codebase**: **FAIL / RED** (`found [15.2]`).
- **Turns GREEN when**: Worker M3 adds `font-size: 16px` (or `1rem`) override in mobile media query.

#### Remediation 6: `test_tier4_input_font_size_shared_modal` (`lines 290-300`)
- **Current Defect**: Silent skip if not matched, trailing `or '16px' in css` passes on 0.92rem.
- **Remediation Specification**:
  - Remove `if match:`, assert `.sv-modal-input` declaration block is found.
  - Parse font-size value; assert `_parse_font_size_px(d) >= 16.0`.
  - Remove `or '16px' in css`.
- **Expected State on Current Codebase**: **FAIL / RED** (`found [14.72]`).
- **Turns GREEN when**: Worker M3 updates `.sv-modal-input` to `16px` or `1rem`.

#### Remediation 7: `test_tier4_input_font_size_shared_mobile_base` (`lines 302-311`)
- **Current Defect**: Passes via `.logo { font-size: 16px; }`.
- **Remediation Specification**:
  - Remove `or 'font-size: 16px' in css`.
  - Assert that inside `shared.css`, either a mobile media query (`max-width: 768px`) or global interactive rule specifically targets `input, select, textarea` and enforces `font-size: 16px` (or `>= 16px`).
- **Expected State on Current Codebase**: **FAIL / RED**.

#### Remediation 8: `test_tier4_input_font_size_todo_search_input` (`lines 345-351`)
- **Current Defect**: Bypassed by task inputs while search input is 12px.
- **Remediation Specification**:
  - Extract `.todo-search-wrap input` in base and mobile queries.
  - Assert `_parse_font_size_px(d) >= 16.0`.
- **Expected State on Current Codebase**: **FAIL / RED** (`found [12.0]`).

#### Remediation 9: `test_tier4_input_font_size_todo_task_inputs` (`lines 353-357`)
- **Current Defect**: Bare `assert 'font-size: 16px' in css`.
- **Remediation Specification**:
  - Verify `#taskNameInput, #taskDeadlineInput, #editTaskName, #editTaskDate` specifically declare `font-size: 16px` inside mobile media query or base rule.

#### Remediation 10: `test_tier4_career_chat_textarea_maintains_16px` (`lines 375-380`)
- **Current Defect**: Overly rigid regex.
- **Remediation Specification**:
  - Allow `(?:1[6-9]px|[2-9]\dpx|1rem|1\.\d+rem)`.

#### Remediation 11: `test_tier4_no_sub16px_inline_font_sizes_in_mylist_js` (`lines 365-373`)
- **Current Defect**: Misses single quote inline styles.
- **Remediation Specification**:
  - Match `style=["\'][^"\']*font-size:\s*(1[0-5]px|\dpx)`.

---

#### Remediation 12: `test_tier5_hero_title_no_rigid_nowrap_on_mobile` (`lines 387-394`)
- **Current Defect**: `[^}]*` stops at `.main-content`, ignoring line 725 `white-space: nowrap !important;`.
- **Remediation Specification**:
  ```python
  def test_tier5_hero_title_no_rigid_nowrap_on_mobile():
      """R4: Homepage hero title in style.css must not enforce white-space: nowrap !important on mobile."""
      css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
      mobile_nowraps = []
      for cond, body in _extract_media_query_blocks(css):
          hero_blocks = _extract_selector_declarations(body, '.hero-title')
          for block in hero_blocks:
              if 'nowrap' in block:
                  mobile_nowraps.append((cond, block))
      assert len(mobile_nowraps) == 0, (
          f"style.css mobile media query must not enforce nowrap on .hero-title: found {mobile_nowraps}"
      )
  ```
- **Expected State on Current Codebase**: **FAIL / RED** (flags line 725 in `@media (max-width: 768px)`).
- **Turns GREEN when**: Worker M4 removes `white-space: nowrap !important;` from `.hero-title`.

#### Remediation 13: `test_tier5_schedule_container_no_rigid_min_width_overflow` (`lines 409-414`)
- **Current Defect**: Misses `640px` and halts at line 700, concealing 700px and 600px min-widths.
- **Remediation Specification**:
  ```python
  def test_tier5_schedule_container_no_rigid_min_width_overflow():
      """R4: schedule/create.css must not impose rigid min-width > 375px on mobile viewports."""
      css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
      rigid_overflows = []
      for cond, body in _extract_media_query_blocks(css, max_width_pattern=r'(?:768|720|640|600|480|400|375)'):
          # Find all selectors inside mobile query declaring min-width > 375px
          for sel, decl in re.findall(r'([^{]+)\{([^}]+)\}', body):
              mw_match = re.search(r'min-width:\s*([4-9]\d\d+)px', decl)
              if mw_match:
                  rigid_overflows.append((cond.strip(), sel.strip(), mw_match.group(1)))
      assert len(rigid_overflows) == 0, (
          f"Found rigid min-widths > 375px in mobile schedule css: {rigid_overflows}"
      )
  ```
- **Expected State on Current Codebase**: **FAIL / RED** (catches `.timetable { min-width: 700px; }` and `.timetable { min-width: 600px; }`).
- **Turns GREEN when**: Worker M4 replaces rigid min-widths with responsive reflow or scroll wrappers.

#### Remediation 14: `test_tier5_flashcard_scene_no_rigid_min_width_overflow` & `test_tier5_career_chat_no_rigid_min_width_overflow`
- **Remediation Specification**: Apply the same `_extract_media_query_blocks` parser to scan all rules inside mobile `@media` blocks.

#### Remediation 15: `test_tier5_card_ai_and_task_microcards_fit_mobile` (`lines 396-400`)
- **Current Defect**: Facade checking only `'.card-ai' in css`.
- **Remediation Specification**:
  ```python
  def test_tier5_card_ai_and_task_microcards_fit_mobile():
      """R4: Floating cards (.card-ai, .card-task) in style.css must define responsive mobile reflow rules."""
      css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
      ai_responsive = False
      task_responsive = False
      for _, body in _extract_media_query_blocks(css, max_width_pattern=r'(?:768|600|480)'):
          if _extract_selector_declarations(body, '.card-ai'):
              ai_responsive = True
          if _extract_selector_declarations(body, '.card-task'):
              task_responsive = True
      assert ai_responsive and task_responsive, (
          "style.css must define responsive rules (transform/scale/position) for .card-ai and .card-task in mobile media queries"
      )
  ```

---

#### Remediation 16-19: Tier 2 (Safe Area Insets)
- **Remove All Tautological Fallbacks**:
  - In `test_tier2_safe_area_top_shared_navbar`, strip trailing `or 'safe-area-inset-top' in css`. Assert `.navbar` declaration block specifically contains `safe-area-inset-top`.
  - In `test_tier2_safe_area_top_navbar_height`, assert that `.navbar` height or padding computes with `env(safe-area-inset-top)`.
  - In `test_tier2_safe_area_bottom_shared_guest_notice`, strip trailing `or 'safe-area-inset-bottom' in css`. Assert `.sv-guest-notice` specifically contains `safe-area-inset-bottom`.
- **Scope Page Container Offsets to Designated Selectors**:
  - `test_tier2_safe_area_top_offset_homepage_content`: assert `.main-content` contains `safe-area-inset-top`.
  - `test_tier2_safe_area_top_offset_career_chat`: assert `.main-career` contains `safe-area-inset-top`.
  - `test_tier2_safe_area_top_offset_schedule`: assert `.main-schedule` contains `safe-area-inset-top`.
  - `test_tier2_safe_area_top_offset_todo`: assert `.project-wrapper` contains `safe-area-inset-top`.
  - `test_tier2_safe_area_top_offset_flashcards`: assert `.fc-main` contains `safe-area-inset-top`.
  - `test_tier2_safe_area_bottom_*`: assert targeted footer/toolbar selectors contain `safe-area-inset-bottom`.

---

#### Remediation 20: Tier 3 (Dynamic Viewport Height Declaration Order)
- In `test_tier3_fallback_order_*` (5 tests, lines 256-285):
  ```python
  idx_vh = css.find('100vh')
  idx_dvh = css.find('100dvh')
  assert idx_vh != -1, "Must contain 100vh fallback"
  assert idx_dvh != -1, "Must contain 100dvh unit"
  assert idx_vh < idx_dvh, (
      "100vh fallback MUST appear before 100dvh in CSS declaration order so modern browsers use dvh"
  )
  ```

---

### 4.3 Documentation Rectification (`TEST_READY.md` & `TEST_INFRA.md`)
1. **`TEST_READY.md`**:
   - Change Status from `READY FOR MILESTONE AUDIT` to `TEST SUITE REMEDIATED — RED BASELINE ACTIVE (AWAITING WORKER IMPLEMENTATIONS M2-M4)`.
   - Update Section 2 & 3 inventories: truthfully state that Tier 4 has 1 / 11 passing (9 pending M3), Tier 5 has 10 / 13 passing (3 pending M4), and Tier 2/3 have expected pending items awaiting M1-M4 completion.
2. **`TEST_INFRA.md`**:
   - Document the balanced-brace CSS parsing architecture in Section 3 and 5.
   - Reaffirm that tests strictly reject facades and enforce authentic red-to-green transitions.

---

### 4.4 Test Lifecycle Transition Matrix

| Milestone Phase | Expected Pass Count | Expected Fail Count | Meaning |
|---|---|---|---|
| **Current Defective Suite** | 74 PASS | 2 FAIL | **FALSE GREEN (Facade Integrity Violation)** |
| **Immediately After Test Remediation (T1 Fixed)** | **~58 PASS** | **~18 FAIL** | **GENUINE RED BASELINE (All bugs exposed)** |
| After Worker M1 Finish (Safe Area Insets) | ~64 PASS | ~12 FAIL | Tier 1 100%, Tier 2 100%, Tier 3 100% |
| After Worker M2 Finish (Nav 375px) | ~66 PASS | ~10 FAIL | Tier 5 nav preservation verified |
| After Worker M3 Finish (Form 16px) | ~73 PASS | ~3 FAIL | Tier 4 100% GREEN (All inputs >= 16px) |
| After Worker M4 Finish (Reflow & Min-Width) | **76 PASS** | **0 FAIL** | **100% GENUINE AUDIT APPROVAL** |

---

## 5. Verification Method

To independently verify the validity of this remediation plan:

### 5.1 Falsification Commands (Proving Existing Facades Fail)
1. **Inspect style.css hero-title nowrap presence**:
   ```bash
   grep -n -C 3 "white-space: nowrap !important" style.css
   ```
2. **Execute Python balanced-brace check vs existing regex**:
   ```bash
   .venv/bin/python -c "
   import re, pathlib
   css = pathlib.Path('style.css').read_text()
   old_m = re.search(r'@media[^{]*max-width:\s*(?:768|600|480)px[^{]*\{[^}]*\.hero-title[^{]*\{[^}]*white-space:\s*nowrap\s*!important', css, re.DOTALL)
   print('Current test sees nowrap:', old_m is not None)  # False!
   "
   ```
3. **Inspect account.css sub-16px font sizes**:
   ```bash
   grep -n -E "font-size: 1[0-2]px" account.css
   ```
4. **Inspect schedule/create.css timetable min-widths**:
   ```bash
   grep -n -E "min-width: [67]00px" schedule/create.css
   ```

### 5.2 Verification of Remediated Suite
When `test_writer_t1_gen2` applies this plan:
1. Run `.venv/bin/pytest tests/test_mobile_viewport.py -v`.
   - **Verification Requirement**: Exactly the ~18 known unoptimized items must fail with clear, descriptive assertion errors citing the offending sub-16px font sizes, nowrap declarations, and 600px/700px min-widths.
2. Run baseline suite:
   ```bash
   .venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py
   ```
   - **Verification Requirement**: All 130 tests continue to pass 100% green.

### 5.3 Invalidation Conditions
- If any test function in `tests/test_mobile_viewport.py` continues to use `or '16px' in css`, `or 'font-size: 16px' in css`, or `or 'safe-area-inset-...' in css`.
- If any test passes while `account.css` inputs remain at 12px or `style.css` `.hero-title` retains `white-space: nowrap !important;`.
