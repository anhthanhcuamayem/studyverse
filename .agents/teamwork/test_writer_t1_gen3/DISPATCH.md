# Dispatch for Test Writer (Generation 3, Milestone T1 Hardening)

**Role**: Test Writer (E2E Test Suite Hardening & Integrity Remediation)
**Working Directory**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/test_writer_t1_gen3/
**Authoritative Request**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md
**Project Document**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md
**Remediation Explorer Reports**:
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_1/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_2/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_3/handoff.md
**Auditor Evidence**:
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/auditor_t1_1/handoff.md

## Scope & Write Ownership
You exclusively own:
- `tests/test_mobile_viewport.py`
- `TEST_INFRA.md`
- `TEST_READY.md`

## Objectives
Implement the complete test hardening and remediation plan designed by the 3 Audit Remediation Explorers:
1. **Incorporate Zero-Dependency CSS Parsing Helpers**:
   Add the brace-balanced CSS helpers into `tests/test_mobile_viewport.py`:
   - `_extract_media_blocks(css, max_width_threshold=768)`
   - `_extract_rule_declarations(block, selector)`
   - `_parse_font_size_px(val, root_px=16)`
   - `_is_font_size_ge_16(val)`
2. **Remove ALL Tautological `or` Fallback Clauses**:
   - In Tier 2: Strip `or 'safe-area-inset-top' in css`, `or 'safe-area-inset-bottom' in css`. Assert specific selectors.
   - In Tier 3: Replace `assert '100vh' in css and '100dvh' in css` with strict order verification ensuring `100vh` strictly precedes `100dvh` in declaration blocks and that no inverted declarations exist.
   - In Tier 4: Completely remove `or '16px' in css`, `or 'font-size: 16px' in css`, and `or '1rem' in css`. Strictly check the actual form selectors (`.account-input-wrap input`, `.account-select-wrap select`, `.tc-input`, `.fc-select`, `.fc-input`, `.fc-textarea`, `.todo-search-wrap input`, `.todo-filter-row select`, etc.) and ensure they have `font-size >= 16px` on mobile. Ensure tests genuinely FAIL (RED) on active sub-16px inputs.
3. **Fix Tier 5 Media Query Regex and Reflow Checks**:
   - Replace single-level `\{[^}]*\.hero-title` regex with brace-balanced media block checking to properly catch `white-space: nowrap !important;` on `.hero-title` inside `@media (max-width: 768px)` in `style.css`.
   - Replace vacuous `assert '.card-ai' in css and '.card-task' in css` with genuine mobile scaling (`transform: scale(...)` < 1.0) and positioning bounds.
   - Check rigid min-widths (600px, 700px) across `@media (max-width: 768px)` and `@media (max-width: 640px)` in `schedule/create.css`.
4. **Update `TEST_READY.md`**:
   Reflect the honest, genuine pass/fail state of the test suite (showing tests in Tiers 4 and 5 legitimately failing pending Milestones M2, M3, and M4).
5. **Verify**:
   Run `.venv/bin/pytest tests/test_mobile_viewport.py` and `.venv/bin/pytest`. Verify 130 baseline tests pass.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion
Write your report to `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/test_writer_t1_gen3/handoff.md` and notify parent via `send_message`.
