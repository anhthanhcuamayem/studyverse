# Handoff Report: Media Query Parsing & Fallback Order Hardening Investigation

**Agent**: `explorer_t1_fix_3` (Media Query Parsing & Fallback Order Hardening Explorer)  
**Parent Orchestrator**: `bdce3044-e260-4522-8179-cfcdc4c408ba`  
**Date**: 2026-10-13  
**Working Directory**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_3/`  
**Target Files Analyzed**:
- `tests/test_mobile_viewport.py`
- `style.css`
- `schedule/create.css`
- `flashcard/flashcard.css`
- `career/chat.css`
- `todo/mylist.css`
- `account.css`
- `index.html`

---

## 1. Observation

Direct empirical observations from `tests/test_mobile_viewport.py`, stylesheets, audit reports (`auditor_t1_1`, `reviewer_t1_1`, `reviewer_t1_2`, `challenger_t1_2`), and runtime execution:

### 1.1 Defective Regex Pattern Matching on Nested `@media` Blocks
In `tests/test_mobile_viewport.py:387-394`:
```python
def test_tier5_hero_title_no_rigid_nowrap_on_mobile():
    """R4: Homepage hero title in style.css must not enforce white-space: nowrap !important on mobile."""
    css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
    assert not re.search(r'@media[^{]*max-width:\s*(?:768|600|480)px[^{]*\{[^}]*\.hero-title[^{]*\{[^}]*white-space:\s*nowrap\s*!important', css, re.DOTALL), (
        "style.css mobile media query must not force white-space: nowrap !important on .hero-title"
    )
```
- **Observed Application State (`style.css:713-726`)**:
  ```css
  @media (max-width: 768px) {
      .main-content {
          padding-top: calc(76px + env(safe-area-inset-top, 0px));
          padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
      }

      .desktop-only {
          display: none;
      }

      .hero-title {
          font-size: 22px !important;
          white-space: nowrap !important;
      }
  ```
- **Mechanism of Failure**: The regex pattern contains `\{[^}]*\.hero-title`. The negated character class `[^}]*` matches up to the first closing brace `}` inside the `@media` block, which terminates at line 717 (`.main-content { ... }`). Because `.hero-title` is preceded by `.main-content` and `.desktop-only`, `re.search(...)` returns `None`. Consequently, `assert not None` evaluates to `True`, producing a false green pass while `white-space: nowrap !important;` remains actively enforced on `.hero-title`.

### 1.2 Omitted Mobile Breakpoints and Truncated Media Queries in Min-Width Checks
In `tests/test_mobile_viewport.py:409-414`:
```python
def test_tier5_schedule_container_no_rigid_min_width_overflow():
    """R4: schedule/create.css must not impose rigid min-width > 375px on mobile viewports."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    rigid_min_widths = re.findall(r'@media[^{]*max-width:\s*(?:768|600|480)px[^{]*\{[^}]*min-width:\s*([4-9]\d\d+px)', css, re.DOTALL)
    assert len(rigid_min_widths) == 0, f"Found rigid min-widths > 375px in mobile schedule css: {rigid_min_widths}"
```
- **Observed Application State (`schedule/create.css:710-758`)**:
  - Line 712 inside `@media (max-width: 768px)`: `.timetable { min-width: 700px; }`.
  - Line 756 inside `@media (max-width: 640px)`: `.timetable { min-width: 600px; }`.
- **Mechanism of Failure**:
  1. The regex alternator `(?:768|600|480)px` completely ignores `640px`.
  2. Inside the 768px block, `[^}]*` halts at `.timetable-legend div { font-size: 0.75rem; }`, failing to reach `.timetable`. As a result, `rigid_min_widths` returns `[]`, falsely reporting zero violations.

### 1.3 Viewport Fallback Order Blindness (Tier 3)
In `tests/test_mobile_viewport.py:256-285`:
```python
def test_tier3_fallback_order_account_css():
    """R1: account.css must include 100vh fallback preceding 100dvh for older browsers."""
    css = (BASE_DIR / 'account.css').read_text(encoding='utf-8')
    assert '100vh' in css and '100dvh' in css, "account.css must provide 100vh fallback alongside 100dvh"
```
Identical checks exist for `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, and `todo/mylist.css`.
- **Mechanism of Failure**: The assertion checks only that literal substrings `'100vh'` and `'100dvh'` exist somewhere in the file.
- **CSS Cascade Vulnerability**: In CSS cascade rules, the later declaration wins. If a worker writes:
  ```css
  .container {
      min-height: 100dvh;
      min-height: 100vh;
  }
  ```
  Both older and modern browsers evaluate `100vh`, overriding `100dvh` and defeating the dynamic viewport requirement. The test suite passes this inverted sequence unconditionally.
- Furthermore, bare substring checks do not verify that `100vh` and `100dvh` belong to the same selector or property.

### 1.4 Facade Check on Floating Micro-Cards (`.card-ai` and `.card-task`)
In `tests/test_mobile_viewport.py:396-400`:
```python
def test_tier5_card_ai_and_task_microcards_fit_mobile():
    """R4: Floating cards (.card-ai, .card-task) in style.css must reflow cleanly without exceeding 375px."""
    css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
    assert '.card-ai' in css and '.card-task' in css, "style.css must contain responsive rules for floating cards"
```
- **Observed Application State (`style.css:450, 458, 738, 745, 799, 804`)**:
  `.card-ai` and `.card-task` existed in pre-mobile desktop styling (lines 450, 458).
- **Mechanism of Failure**: The test only asserts that class strings exist in `style.css`. It executes zero checks on responsive media queries, scaling, width, position, or boundary reflow.

---

## 2. Logic Chain

1. **Premise 1 (CSS Grammar and Nesting Constraints)**:
   - CSS `@media` rules are nested block-level structures (`@media ... { rule1 { ... } rule2 { ... } }`).
   - Standard Python regex `re` does not support recursive pattern matching (`(?R)`).
   - Negated character classes (`[^}]*`) stop matching at the very first closing brace `}`, rendering single-regex multi-rule matching structurally invalid.
2. **Premise 2 (Cascade Semantics for Viewport Fallbacks)**:
   - To provide backward compatibility for older browsers without breaking modern dynamic viewport units (`100dvh`), `100vh` must be declared immediately prior to `100dvh` for the same property (`min-height` or `height`) inside the same rule block.
   - Checking global file substring existence (`'100vh' in css and '100dvh' in css`) cannot detect inverted declaration order (`100dvh` before `100vh`) or disjointed rules.
3. **Premise 3 (Specification Requirements for Reflow & 375px Boundary)**:
   - `ORIGINAL_REQUEST.md` (R4) and `PROJECT.md` (Features 10 & 11) mandate that `.hero-title` does not force `white-space: nowrap !important;` on mobile, and floating cards `.card-ai` and `.card-task` must reflow/scale on mobile viewports (<= 768px / 375px) without overflowing.
   - Merely asserting string presence of `.card-ai` or using broken regex on `.hero-title` masks unresolved bugs in Milestone M4.
4. **Conclusion**:
   - The test suite requires:
     a) A robust, pure-Python media block extraction function (`extract_media_blocks`) utilizing balanced brace depth tracking that parses across all nested rules, strings, and comments.
     b) A selector-scoped and file-level declaration order assertion verifying that `100vh` strictly precedes `100dvh` in target containers.
     c) Strict reflow assertions for `.card-ai` and `.card-task` verifying responsive scaling, positioning overrides, and absence of rigid overflow.
     d) Strict reflow assertions for `.hero-title` verifying absence of `white-space: nowrap` across all mobile media queries.

---

## 3. Caveats

- **Driverless Static Analysis Environment**: The testing suite operates via Flask test client and static CSS AST/regex parsing without a headless browser binary (WebKit/Playwright). The proposed functions must therefore rely entirely on Python standard library (`re`, `pathlib`).
- **Milestone State Dependency**: Applying these hardened assertions immediately will cause tests for Milestone M4 (hero title nowrap, schedule timetable min-width) to fail (RED). This is intentional and required: the tests must remain RED until workers implement M4.
- **No Direct Implementation**: As an Explorer agent, this report provides architectural specifications, design algorithms, and concrete code proposals. No source or test files outside `.agents/teamwork/explorer_t1_fix_3/` were modified.

---

## 4. Conclusion & Proposed Remediation Strategy

We recommend the test writer agent (`test_writer_t1_gen2`) adopt the following three-part hardening strategy in `tests/test_mobile_viewport.py`:

### 4.1 Solution 1: Robust Media Query Block Extractor (`extract_media_blocks`)

Implement a balanced-brace parser at the top of `tests/test_mobile_viewport.py` that handles nested rules, CSS comments (`/* ... */`), and quotes (`"..."`, `'...'`):

```python
def extract_media_blocks(css: str, max_width_threshold: int | None = None) -> list[tuple[str, str, int | None]]:
    """Extract all @media blocks from CSS with full nested brace depth tracking.
    
    Returns a list of tuples: (query_condition, block_body, max_width_px).
    If max_width_threshold is specified, returns only media blocks where max-width <= max_width_threshold.
    """
    results = []
    pattern = re.compile(r'@media\s*([^{]+)\{')
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
                        mw_match = re.search(r'max-width:\s*(\d+)px', query)
                        mw_val = int(mw_match.group(1)) if mw_match else None
                        if max_width_threshold is None or (mw_val is not None and mw_val <= max_width_threshold):
                            results.append((query, body, mw_val))
                        pos = i + 1
                        break
            i += 1
        else:
            pos = start
    return results


def extract_rule_declarations(css_text: str, selector_pattern: str) -> list[str]:
    """Extract rule declaration bodies {...} for a given selector pattern within CSS text."""
    pattern = re.compile(r'(?:^|[\s,;{}])(' + selector_pattern + r')\s*\{([^}]+)\}', re.MULTILINE)
    return [m.group(2).strip() for m in pattern.finditer(css_text)]
```

### 4.2 Solution 2: Hardened Fallback Declaration Order Checks (Tier 3)

Replace the global substring presence checks with rule-scoped declaration order verification and a global anti-inversion invariant:

```python
def assert_viewport_fallback_order(css: str, selector: str) -> None:
    """Assert that 100vh strictly precedes 100dvh within selector's rule block, and no inverted order exists."""
    # 1. Selector-scoped check
    m = re.search(re.escape(selector) + r'\s*\{([^}]+)\}', css)
    assert m is not None, f"Selector '{selector}' not found in stylesheet"
    block = m.group(1)
    
    vh_matches = list(re.finditer(r'(?:min-)?height:\s*[^;]*100vh[^;]*;', block))
    dvh_matches = list(re.finditer(r'(?:min-)?height:\s*[^;]*100dvh[^;]*;', block))
    
    assert len(vh_matches) > 0, f"Selector '{selector}' must declare a 100vh fallback"
    assert len(dvh_matches) > 0, f"Selector '{selector}' must declare a 100dvh value"
    
    first_vh = vh_matches[0].start()
    first_dvh = dvh_matches[0].start()
    assert first_vh < first_dvh, (
        f"Selector '{selector}': 100vh fallback must appear BEFORE 100dvh in CSS declaration order"
    )
    
    # 2. File-wide anti-inversion invariant (no 100dvh preceding 100vh within any rule)
    inverted = re.search(
        r'(?:min-)?height:\s*[^;]*100dvh[^;]*;[^{}]*?(?:min-)?height:\s*[^;]*100vh[^;]*;',
        css,
        re.MULTILINE
    )
    assert inverted is None, (
        f"Found inverted viewport height fallback in file: 100dvh appears before 100vh: '{inverted.group(0) if inverted else ''}'"
    )
```

**Implementation in Tier 3 test functions**:
- `test_tier3_fallback_order_account_css`: `assert_viewport_fallback_order(css, '.account-page')`
- `test_tier3_fallback_order_career_chat_css`: `assert_viewport_fallback_order(css, '.main-career')`
- `test_tier3_fallback_order_flashcard_css`: `assert_viewport_fallback_order(css, '.fc-main')`
- `test_tier3_fallback_order_schedule_css`: `assert_viewport_fallback_order(css, '.main-schedule')`
- `test_tier3_fallback_order_todo_css`: `assert_viewport_fallback_order(css, '.project-wrapper')`

### 4.3 Solution 3: Hardened Reflow Assertions for Floating Cards and Hero Title (Tier 5)

#### 4.3.1 Hero Title Nowrap Removal:
```python
def test_tier5_hero_title_no_rigid_nowrap_on_mobile():
    """R4: Homepage hero title in style.css must not enforce white-space: nowrap !important on mobile."""
    css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
    mobile_blocks = extract_media_blocks(css, max_width_threshold=768)
    assert len(mobile_blocks) > 0, "style.css must contain mobile media queries (<= 768px)"
    
    nowrap_violations = []
    for query, body, _ in mobile_blocks:
        for decl in extract_rule_declarations(body, r'\.hero-title'):
            if re.search(r'white-space:\s*nowrap', decl):
                nowrap_violations.append((query, decl))
                
    assert len(nowrap_violations) == 0, (
        f"style.css enforces white-space: nowrap on .hero-title under mobile media queries: {nowrap_violations}"
    )
```

#### 4.3.2 Floating Micro-Cards Reflow & Scaling:
```python
def test_tier5_card_ai_and_task_microcards_fit_mobile():
    """R4: Floating cards (.card-ai, .card-task) in style.css must reflow cleanly without exceeding 375px."""
    css = (BASE_DIR / 'style.css').read_text(encoding='utf-8')
    mobile_blocks = extract_media_blocks(css, max_width_threshold=768)
    assert len(mobile_blocks) > 0, "style.css must define mobile media queries (<= 768px) for floating cards"
    
    # 1. Verify responsive rules exist for .card-ai and .card-task inside mobile media queries
    card_ai_decls = []
    card_task_decls = []
    for query, body, _ in mobile_blocks:
        card_ai_decls.extend([(query, d) for d in extract_rule_declarations(body, r'\.card-ai')])
        card_task_decls.extend([(query, d) for d in extract_rule_declarations(body, r'\.card-task')])
        
    assert len(card_ai_decls) > 0, "style.css must define mobile overrides for .card-ai under @media (max-width <= 768px)"
    assert len(card_task_decls) > 0, "style.css must define mobile overrides for .card-task under @media (max-width <= 768px)"
    
    # 2. Verify responsive scaling or reflow properties (scale factor < 1.0 or reflow)
    for query, decl in card_ai_decls + card_task_decls:
        has_scale = bool(re.search(r'transform:\s*scale\(\s*0?\.[0-9]+\s*\)', decl))
        has_reflow = any(prop in decl for prop in ['display: none', 'position: relative', 'position: static', 'max-width', 'width: 100%'])
        assert has_scale or has_reflow, (
            f"Under {query}, floating card must define scaling (transform: scale(<1.0>)) or reflow, got: {decl}"
        )
        
        # 3. Viewport boundary safety: no rigid width > 375px
        rigid_width = re.search(r'(?:min-)?width:\s*([4-9]\d\d+px)', decl)
        assert rigid_width is None, f"Floating card cannot have rigid width > 375px on mobile: {decl}"
        
    # 4. Clutter prevention: verify secondary cards (.card-schedule, .card-streak) are hidden on mobile
    hidden_secondary = any(
        re.search(r'\.(?:card-schedule|card-streak)[^{]*\{[^}]*display:\s*none', body)
        for _, body, _ in mobile_blocks
    )
    assert hidden_secondary, "Secondary micro-cards (.card-schedule, .card-streak) must be hidden on mobile viewports"
```

#### 4.3.3 Timetable Rigid Min-Width Detection:
```python
def test_tier5_schedule_container_no_rigid_min_width_overflow():
    """R4: schedule/create.css must not impose rigid min-width > 375px on mobile viewports."""
    css = (BASE_DIR / 'schedule/create.css').read_text(encoding='utf-8')
    mobile_blocks = extract_media_blocks(css, max_width_threshold=768)
    
    violations = []
    for query, body, _ in mobile_blocks:
        mw_matches = re.findall(r'min-width:\s*([4-9]\d\d+px)', body)
        if mw_matches:
            violations.append((query, mw_matches))
            
    assert len(violations) == 0, f"Found rigid min-widths > 375px in mobile schedule css: {violations}"
```

---

## 5. Verification Method

### 5.1 Verification Commands

1. **Verify `extract_media_blocks` correctly identifies `.hero-title` nowrap in `style.css:725`**:
   ```bash
   python3 -c "
   from pathlib import Path
   import re
   css = Path('style.css').read_text()
   # Use nested brace extractor
   pattern = re.compile(r'@media\s*([^{]+)\{')
   m = pattern.search(css)
   start = m.end()
   depth = 1
   i = start
   while i < len(css) and depth > 0:
       if css[i] == '{': depth += 1
       elif css[i] == '}':
           depth -= 1
           if depth == 0: body = css[start:i]; break
       i += 1
   assert '.hero-title' in body
   assert 'white-space: nowrap !important;' in body
   print('Verified: Nested brace extractor correctly detects nowrap on line 725')
   "
   ```

2. **Verify `schedule/create.css` 600px/700px min-widths are detected**:
   ```bash
   python3 -c "
   from pathlib import Path
   import re
   css = Path('schedule/create.css').read_text()
   # Search within 768px and 640px blocks
   mws = re.findall(r'min-width:\s*([67]00px)', css)
   assert len(mws) >= 2, f'Found {mws}'
   print('Verified: 700px and 600px rigid min-widths present in schedule/create.css')
   "
   ```

3. **Verify fallback declaration order in container rules**:
   ```bash
   python3 -c "
   from pathlib import Path
   import re
   for fn, sel in [
       ('account.css', '.account-page'),
       ('career/chat.css', '.main-career'),
       ('flashcard/flashcard.css', '.fc-main'),
       ('schedule/create.css', '.main-schedule'),
       ('todo/mylist.css', '.project-wrapper')
   ]:
       css = Path(fn).read_text()
       m = re.search(re.escape(sel) + r'\s*\{([^}]+)\}', css)
       block = m.group(1)
       assert block.find('100vh') < block.find('100dvh'), f'Inverted order in {sel}'
   print('Verified: All 5 container rules have 100vh preceding 100dvh')
   "
   ```

### 5.2 Invalidation Conditions
- If `tests/test_mobile_viewport.py` is updated with these recommendations, and:
  - Falsely green tests on `hero-title` nowrap and `schedule` timetable min-width turn genuinely RED until M4 is implemented.
  - Fallback order assertions correctly fail if `100dvh` is inverted before `100vh`.
  - Floating card test fails on mutant S8 (`.card-ai { width: 900px; }`) and verifies mobile scaling.
