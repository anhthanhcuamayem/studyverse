# Adversarial Challenge Report: Mobile Viewport E2E Test Suite (`tests/test_mobile_viewport.py`)

**Agent**: `challenger_t1_2` (Empirical Challenger)  
**Parent Orchestrator**: `bdce3044-e260-4522-8179-cfcdc4c408ba`  
**Target Artifact**: `/home/thanh/LÀM VIỆC/project/studyverse/tests/test_mobile_viewport.py`  
**Verdict**: **`REQUEST_CHANGES`**  
**Overall Risk Assessment**: **CRITICAL**  

---

## 1. Observation

### 1.1 Direct Test Suite Execution
- **Command**: `.venv/bin/pytest tests/test_mobile_viewport.py -v`
- **Result**: Collected 76 items; 10 failed, 66 passed in 10.06s.
  - Failures correspond to pending implementation tasks (e.g. `test_tier4_no_sub16px_inline_font_sizes_in_mylist_js`, `test_tier5_todo_media_query_cascade_order`, missing `safe-area-inset-bottom` in account footer and flashcards, missing `100dvh` in account and flashcards).
- **Baseline Test Suite Execution**:
  - **Command**: `.venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py`
  - **Result**: 130 passed in 19.85s (clean, 0 regressions).

### 1.2 Verbatim Observations in `tests/test_mobile_viewport.py`

#### Obs 1: Tautological `or` Condition in Modal Font Size Oracle
- **File**: `tests/test_mobile_viewport.py`, lines 293–299:
  ```python
  match = re.search(r'\.sv-modal-input[^{]*\{[^}]*font-size:\s*([^;]+);', css)
  if match:
      val = match.group(1).strip()
      # Should be at least 16px or 1rem
      assert '16px' in val or '1rem' in val or float(re.search(r'([\d.]+)', val).group(1)) >= 16 or '16px' in css, (
          f".sv-modal-input font-size must be >= 16px, got '{val}'"
      )
  ```
  - **Direct observation**: If `.sv-modal-input` does not specify `font-size`, `match` is `None`, the `if` block never executes, and the test silently passes.
  - **Direct observation**: In the assert statement, the fourth clause is `or '16px' in css`. Since `shared.css` contains `16px` elsewhere (e.g. padding, border-radius, or other rules), this assertion evaluates to `True` even when `.sv-modal-input` has `font-size: 10px;`.

#### Obs 2: Unscoped and Tautological Form Input Oracles (Tier 4)
- **Lines 306–310 (`test_tier4_input_font_size_shared_mobile_base`)**:
  ```python
  assert re.search(...) or re.search(...) or 'font-size: 16px' in css
  ```
  Ends with `or 'font-size: 16px' in css`, causing it to pass if ANY rule in `shared.css` has `font-size: 16px`, ignoring whether mobile inputs actually have it.
- **Lines 317–319 (`test_tier4_input_font_size_account_inputs`) & Lines 325–327 (`test_tier4_input_font_size_account_selects`)**:
  ```python
  assert 'font-size: 16px' in css or not re.search(r'\.account-input-wrap\s+input[^{]*\{[^}]*font-size:\s*(1[0-5]px|\dpx)', css)
  ```
  If `account.css` contains `font-size: 16px` anywhere, the assertion passes unconditionally even if inputs or selects are sub-16px. Furthermore, if font-size is omitted or specified as `0.8rem`, `not re.search(...)` evaluates to `True`, giving a false pass.
- **Line 342 (`test_tier4_input_font_size_schedule_modal_inputs`)**:
  ```python
  assert '16px' in css, "schedule/create.css must enforce 16px on mobile inputs"
  ```
  Tests only that substring `'16px'` exists in `schedule/create.css`. Substring matches on `padding: 16px;` or `margin: 16px;` satisfy this assertion without inspecting any input selector.
- **Line 356 (`test_tier4_input_font_size_todo_task_inputs`)**:
  ```python
  assert 'font-size: 16px' in css, "todo/mylist.css must provide font-size: 16px for mobile inputs"
  ```
  Tests only `'font-size: 16px' in css` without scoping to task or modal inputs.
- **Line 362 (`test_tier4_input_font_size_flashcard_controls`)**:
  ```python
  assert '16px' in css or '1rem' in css, "flashcard/flashcard.css form controls must have font-size >= 16px on mobile"
  ```
  Tests only `'16px' in css or '1rem' in css`. Any CSS rule with 16px or 1rem satisfies the test, leaving `.fc-select`, `.fc-input`, and `.fc-textarea` unvalidated.
- **Lines 378–380 (`test_tier4_career_chat_textarea_maintains_16px`)**:
  ```python
  assert re.search(r'\.chat-input-area\s+textarea[^{]*\{[^}]*font-size:\s*16px', css) is not None
  ```
  Rigidly rejects valid >=16px values such as `1rem`, `1.05rem`, `18px`, or declarations with `!important`.

#### Obs 3: Fallback Order Oracle Blindness (Tier 3)
- **Lines 259, 265, 271, 277, 283 (`test_tier3_fallback_order_*`)**:
  ```python
  assert '100vh' in css and '100dvh' in css
  ```
  - **Docstring**: `"R1: <file> must include 100vh fallback preceding 100dvh for older browsers."`
  - **Direct observation**: Only asserts that both substring literals exist in the file. If `100dvh` is placed before `100vh` (`min-height: 100dvh; min-height: 100vh;`), `100vh` overrides `100dvh` in standard CSS cascade rules on iOS Safari, yet this test passes!

#### Obs 4: Tautological `or` Condition in Safe Area Inset Tests (Tier 2)
- **Lines 123–125 (`test_tier2_safe_area_top_shared_navbar`)**:
  ```python
  assert 'safe-area-inset-top' in css
  assert re.search(r'\.navbar[^{]*\{[^}]*safe-area-inset-top', css, re.DOTALL) or \
         re.search(r'safe-area-inset-top[^{}]*\.navbar', css, re.DOTALL) or \
         'safe-area-inset-top' in css
  ```
  - **Direct observation**: The second assert ends with `or 'safe-area-inset-top' in css`. Since line 122 already asserts `'safe-area-inset-top' in css`, the second assertion is a tautology (`X or Y or True == True`). If `.navbar` does not have safe-area-inset-top, the test still passes!
- **Lines 131–133 (`test_tier2_safe_area_top_navbar_height`)**:
  Ends with `or 'safe-area-inset-top' in css`.
- **Lines 175–177 (`test_tier2_safe_area_bottom_shared_guest_notice`)**:
  Ends with `or 'safe-area-inset-bottom' in css`.

#### Obs 5: Vacuous / Non-Testing Oracles in Tier 5
- **Lines 398–399 (`test_tier5_card_ai_and_task_microcards_fit_mobile`)**:
  ```python
  assert '.card-ai' in css and '.card-task' in css, "style.css must contain responsive rules for floating cards"
  ```
  - **Direct observation**: Checks only if class selectors `.card-ai` and `.card-task` exist in `style.css`. Both selectors existed in the pre-mobile desktop codebase (`True` and `True`). It does not verify responsive positioning, media queries, widths, or boundary constraints.

---

## 2. Logic Chain

1. **R3 (iOS Safari Form Input Zoom Prevention)** requires all form inputs, selects, and textareas across mobile viewports to maintain computed `font-size >= 16px`.
2. As observed in **Obs 1** and **Obs 2**, seven of the nine Tier 4 CSS tests contain tautological fallback clauses (`or '16px' in css`, `or 'font-size: 16px' in css`) or bare substring checks.
3. Therefore, an empirical mutant where inputs have `font-size: 14px;` or `font-size: 12px;` passes these tests whenever another unrelated rule contains `16px` (e.g. `body`, `margin`, or `padding`).
4. In **Obs 1**, `test_tier4_input_font_size_shared_modal` wraps its assertion inside `if match:`. If `.sv-modal-input` lacks a `font-size` declaration, `match` is `None` and the test passes with zero assertions executed.
5. In **Obs 3**, `test_tier3_fallback_order_*` claims to verify that `100vh` precedes `100dvh`. Because it only tests `'100vh' in css and '100dvh' in css`, an inverted declaration (`min-height: 100dvh; min-height: 100vh;`) passes. In CSS, the later declaration wins, meaning `100vh` overrides `100dvh` on iOS Safari, defeating the dynamic viewport requirement.
6. In **Obs 4**, the assertions in `test_tier2_safe_area_top_shared_navbar`, `test_tier2_safe_area_top_navbar_height`, and `test_tier2_safe_area_bottom_shared_guest_notice` terminate with `or 'safe-area-inset-...' in css`. These `or` expressions are mathematically tautological given prior assertions, allowing missing safe area insets on `.navbar` and `.sv-guest-notice` to pass undetected.
7. In **Obs 5**, `test_tier5_card_ai_and_task_microcards_fit_mobile` tests only string presence of class names that were already present in legacy desktop code, providing zero protection against mobile overflow.
8. Therefore, the test suite currently suffers from critical false negatives and oracle weaknesses that fail to guarantee compliance with R1, R2, R3, and R4.

---

## 3. Stress Test Results (Empirical Verification)

All stress test harnesses were executed empirically using `.venv/bin/python`:

| # | Stress Test Scenario | Expected Behavior | Actual Behavior | Result |
|---|----------------------|-------------------|-----------------|--------|
| S1 | Mutated `shared.css` with `.sv-modal-input { font-size: 14px; }` and `body { font-size: 16px; }` | Test fails (catches sub-16px zoom bug) | Test **passed** (evaluates to `True` via `or '16px' in css`) | **FAIL (False Negative)** |
| S2 | Mutated `shared.css` with `.sv-modal-input { border: 1px solid red; }` (no font-size) | Test fails (missing font-size declaration) | Test **passed** (bypasses `if match:` and exits green) | **FAIL (False Negative)** |
| S3 | Mutated `account.css` with `.account-input-wrap input { font-size: 14px; }` and `h1 { font-size: 16px; }` | Test fails (catches 14px input) | Test **passed** (evaluates to `True` via `'font-size: 16px' in css`) | **FAIL (False Negative)** |
| S4 | Mutated `schedule/create.css` with `padding: 16px;` and `.modal input { font-size: 12px; }` | Test fails (catches 12px modal input) | Test **passed** (evaluates to `True` via bare `'16px' in css`) | **FAIL (False Negative)** |
| S5 | Mutated `flashcard/flashcard.css` with `gap: 16px;` and `.fc-input { font-size: 12px; }` | Test fails (catches 12px control) | Test **passed** (evaluates to `True` via bare `'16px' in css`) | **FAIL (False Negative)** |
| S6 | Inverted fallback order: `.container { min-height: 100dvh; min-height: 100vh; }` | Test fails (100vh overrides 100dvh) | Test **passed** (`'100vh' in css and '100dvh' in css` is True) | **FAIL (False Negative)** |
| S7 | Mutated `shared.css`: `.unrelated { padding-top: env(safe-area-inset-top); }`, `.navbar` has no safe area | Test fails (.navbar missing safe area) | Test **passed** (tautological `or 'safe-area-inset-top' in css`) | **FAIL (False Negative)** |
| S8 | Mutated `style.css`: `.card-ai { width: 900px; position: absolute; }` (breaks 375px) | Test fails (breaks mobile reflow) | Test **passed** (`'.card-ai' in css` is True) | **FAIL (False Negative)** |
| S9 | Valid textarea font size: `.chat-input-area textarea { font-size: 1rem; }` | Test passes (1rem >= 16px) | Test **failed** (regex requires literal `16px`) | **FAIL (False Positive)** |
| S10 | Dynamic inline font size using single quotes: `<input style='font-size: 14px;' />` | Test fails (catches 14px inline style) | Test **passed** (regex only matches double quotes `style="..."`) | **FAIL (False Negative)** |

---

## 4. Caveats

- **Driverless Execution**: As documented in `TEST_INFRA.md`, the environment does not include a headless browser (Chromium/Playwright). The test suite correctly uses regex and AST-style parsing against HTTP responses and CSS assets. The issues identified above are not caused by the absence of a browser driver, but by structural flaws in the test assertions and regular expressions.
- **Review Scope Constraint**: Under Teamwork rules, Challenger does not edit `tests/test_mobile_viewport.py` directly. Specific remediation patches are provided below for the owning agent (`test_writer_t1_gen2`).

---

## 5. Conclusion & Actionable Recommendations

### Verdict: `REQUEST_CHANGES`

The test suite in its current state contains substantial oracle gaps, tautological pass conditions, and false negatives that allow invalid implementations (sub-16px inputs, broken dynamic viewport fallbacks, missing safe area insets on `.navbar`, and overflowing cards) to pass green.

### Required Changes for `test_writer_t1_gen2`:

1. **Remove Tautological `or` Clauses in Safe Area Inset Tests**:
   - In `test_tier2_safe_area_top_shared_navbar`, remove `or 'safe-area-inset-top' in css`. Assert that `.navbar` rule specifically declares `safe-area-inset-top`.
   - In `test_tier2_safe_area_top_navbar_height`, assert that `.navbar` height or padding calculates with `safe-area-inset-top`.
   - In `test_tier2_safe_area_bottom_shared_guest_notice`, remove `or 'safe-area-inset-bottom' in css` and assert directly on `.sv-guest-notice`.
   - Scope all page-level safe area tests to their respective container selectors (e.g. `.account-topbar`, `.main-content`, `.main-career`, `.main-schedule`, `.project-wrapper`, `.fc-main`).

2. **Fix Fallback Order Verification in Tier 3**:
   - Replace `assert '100vh' in css and '100dvh' in css` with an order check:
     ```python
     idx_vh = css.find('100vh')
     idx_dvh = css.find('100dvh')
     assert idx_vh != -1 and idx_dvh != -1 and idx_vh < idx_dvh, (
         "100vh fallback must appear BEFORE 100dvh in CSS declaration order"
     )
     ```
   - Scope both to the full-height container selector block.

3. **Harden Tier 4 Mobile Input Font Size Oracles**:
   - In `test_tier4_input_font_size_shared_modal`: Remove `if match:` and `or '16px' in css`. Explicitly assert `match is not None` and assert `float(val) >= 16` or `'16px' in val or '1rem' in val`.
   - In `test_tier4_input_font_size_account_inputs` & `selects`: Remove `or 'font-size: 16px' in css`. Verify that the input selector inside media query has `font-size >= 16px` or `1rem` and does not match `< 16px`.
   - In `test_tier4_input_font_size_schedule_modal_inputs`, `schedule_tc_input`, `todo_search_input`, `todo_task_inputs`, `flashcard_controls`: Eliminate bare `'16px' in css` assertions; test the specific selectors (`.tc-input`, `.todo-search-wrap input`, `.fc-select`, `.fc-input`, etc.).
   - In `test_tier4_career_chat_textarea_maintains_16px`: Support `1rem`, `16px`, and values > 16px (e.g. `(?:1[6-9]px|[2-9]\dpx|1rem)`).
   - In `test_tier4_no_sub16px_inline_font_sizes_in_mylist_js`: Update regex to support both single and double quotes (`style=["\'][^"\']*font-size:\s*(?:1[0-5]px|[0-9]px)`).

4. **Harden Tier 5 Microcards Reflow Oracle**:
   - Replace `assert '.card-ai' in css and '.card-task' in css` with checks verifying responsive styling within mobile media queries (e.g. `max-width`, `position: relative`, `width: 100%`, or `transform` scaling for <= 768px / 375px).

---

## 6. Verification Method

To independently verify these findings:
1. **Run Mobile Viewport Test Suite**:
   ```bash
   .venv/bin/pytest tests/test_mobile_viewport.py -v
   ```
2. **Execute Empirical Mutation Stress Harness**:
   ```bash
   .venv/bin/python -c '
   import re
   # Test S1: sub-16px input false pass
   css = "body { margin: 16px; } .sv-modal-input { font-size: 14px; }"
   match = re.search(r"\.sv-modal-input[^{]*\{[^}]*font-size:\s*([^;]+);", css)
   val = match.group(1).strip()
   res = "16px" in val or "1rem" in val or "16px" in css
   print("S1 False Pass:", res)  # Prints True (vulnerability confirmed)

   # Test S6: inverted fallback order false pass
   css_inv = ".box { min-height: 100dvh; min-height: 100vh; }"
   res_inv = "100vh" in css_inv and "100dvh" in css_inv
   print("S6 False Pass:", res_inv)  # Prints True (vulnerability confirmed)
   '
   ```
3. **Invalidation Conditions**:
   - If `tests/test_mobile_viewport.py` is updated such that S1 through S10 fail when mutated and pass when correctly implemented, this report's challenge is satisfied.
