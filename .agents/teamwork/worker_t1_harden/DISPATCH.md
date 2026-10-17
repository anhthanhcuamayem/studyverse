# Dispatch for Worker (Milestone T1 Test Hardening)

**Role**: Worker (Test Hardening Specialist)
**Working Directory**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_t1_harden/
**Authoritative Request**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md
**Project Document**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md
**Auditor Report**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/auditor_t1_1/handoff.md
**Remediation Blueprints**:
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_1/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_2/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_3/handoff.md

## Scope & Write Ownership
You exclusively own:
- `tests/test_mobile_viewport.py`
- `TEST_READY.md`
- `TEST_INFRA.md`

## Objectives
1. Implement the hardened oracles and brace-balanced CSS parser helpers into `tests/test_mobile_viewport.py` directly from the blueprints in `explorer_t1_fix_1`, `explorer_t1_fix_2`, and `explorer_t1_fix_3`:
   - Add zero-dependency brace-balanced parser functions: `_extract_media_blocks`, `_extract_rule_declarations`, `_is_font_size_ge_16`, `_parse_font_size_px`.
   - Remove all tautological `or '16px' in css`, `or 'font-size: 16px' in css`, `or 'safe-area-inset-top' in css` fallback branches across Tiers 2 and 4.
   - Tier 3: Replace substring `and` with strict declaration order checks ensuring `100vh` strictly precedes `100dvh` in the declaration sequence.
   - Tier 4: Rewrite all 11 form input test functions to strictly verify target selectors (`.account-input-wrap input`, `.account-select-wrap select`, `.tc-input`, `.fc-select`, `.fc-input`, `.todo-search-wrap input`, etc.). These MUST legitimately FAIL (RED) on active sub-16px styles pending Milestone M3.
   - Tier 5: Fix regex to properly extract `@media (max-width: 768px)` block and check `white-space: nowrap !important;` on `.hero-title` (which MUST legitimately FAIL pending Milestone M4). Check rigid min-widths (600px, 700px) and genuine micro-card scaling.
2. Update `TEST_READY.md` to reflect honest test status (showing Tier 1 & 2 passing, and pending M3/M4 tests legitimately failing).
3. Run `.venv/bin/pytest tests/test_mobile_viewport.py` and `.venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py`.
4. Keep `progress.md` updated with timestamp header.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your report to `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_t1_harden/handoff.md` and notify parent via `send_message`.

## 2026-10-13T09:37:15Z
You are worker_t1_harden (Test Hardening Specialist).
Your working directory is /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_t1_harden/
You MUST read:
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_t1_harden/DISPATCH.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/auditor_t1_1/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_1/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_2/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_t1_fix_3/handoff.md

Exclusively owned files:
- tests/test_mobile_viewport.py
- TEST_READY.md
- TEST_INFRA.md

Tasks:
1. Update tests/test_mobile_viewport.py using the exact blueprints and code provided by the 3 remediation explorers:
   - Add zero-dependency brace-balanced parser functions (_extract_media_blocks, _extract_rule_declarations, _is_font_size_ge_16).
   - Strip all tautological 'or' fallback clauses across Tiers 2, 3, and 4.
   - Strictly verify target selectors for font-size >= 16px on mobile (these must fail genuinely on current sub-16px inputs).
   - Replace single-level regex with nested brace matching in Tier 5 to catch 'white-space: nowrap !important' on .hero-title and rigid min-widths.
2. Update TEST_READY.md with honest pass/fail counts.
3. Run .venv/bin/pytest tests/test_mobile_viewport.py and .venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py.
4. Update progress.md with timestamp header "Last visited: [timestamp]" after each step.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your report to /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_t1_harden/handoff.md and notify me via send_message when complete.
