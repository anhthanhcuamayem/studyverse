# Dispatch for Test Writer (Milestone T1: E2E Test Suite Creation)

**Role**: Test Writer (E2E Test Suite Creator)
**Working Directory**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/test_writer_t1/
**Authoritative Request**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md
**Project Document**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md
**Explorer 3 Survey Report**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_3/handoff.md

## Scope & Write Ownership
You exclusively own:
- `tests/test_mobile_viewport.py`
- `TEST_INFRA.md` (at project root `/home/thanh/LÀM VIỆC/project/studyverse/TEST_INFRA.md` or `.agents/teamwork/`)
- `TEST_READY.md` (at project root `/home/thanh/LÀM VIỆC/project/studyverse/TEST_READY.md`)

## Objectives
1. Implement a comprehensive 4-tier opaque-box E2E test suite in `tests/test_mobile_viewport.py` using Python's standard library and Flask test client:
   - **Tier 1 (Feature Coverage)**: Verify each core page (`index.html`, `account.html`, `career/chat.html`, `flashcard/flashcard.html`, `schedule/create.html`, `todo/mylist.html`) has `viewport-fit=cover`, safe area declarations in CSS, `100dvh` units, and mobile form inputs with `font-size >= 16px`. (>= 20 test cases).
   - **Tier 2 (Boundary & Corner Cases)**: Edge cases, e.g. empty inputs, selects with various options, modal inputs, time config inputs, search inputs, extreme viewport widths (375px boundary). (>= 20 test cases).
   - **Tier 3 (Cross-Feature Combinations)**: Interaction between navigation bars and safe areas, hero title wrapping and container bounds, form inputs inside modals and page containers. (>= 5 test cases).
   - **Tier 4 (Real-World Application Scenarios)**: Real user flows on iPhone 11 Pro: opening homepage hero, navigating to flashcards/todo/schedule, focusing inputs without triggering zoom, checking full height in mobile Safari. (>= 5 test cases).
   - Minimum threshold: >= 50 test cases total!
2. Create `TEST_INFRA.md` following the template in `PROJECT.md`.
3. Create `TEST_READY.md` summarizing the test runner command (`.venv/bin/pytest tests/test_mobile_viewport.py`) and coverage table.
4. Run `.venv/bin/pytest` to ensure all existing 130 tests continue to pass and note which new mobile viewport tests currently fail pending implementation.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Completion
Write your report to `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/test_writer_t1/handoff.md` and notify parent via `send_message`.

## 2026-10-13T05:45:23Z
You are test_writer_t1 (E2E Test Writer).
Your working directory is /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/test_writer_t1/
You MUST read /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md and /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/test_writer_t1/DISPATCH.md before starting work.
Refer also to /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md and /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_3/handoff.md.

Exclusively owned files:
- tests/test_mobile_viewport.py
- TEST_INFRA.md
- TEST_READY.md

Deliverables:
1. Implement tests/test_mobile_viewport.py covering Tiers 1-4 (>= 50 test cases) verifying:
   - Viewport meta tags with viewport-fit=cover across all core pages
   - Safe area CSS insets in headers, footers, toolbars
   - 100dvh dynamic viewport heights
   - Mobile form inputs font-size >= 16px to prevent iOS Safari auto-zoom
   - Reflow & no horizontal overflow on 375px
2. Write TEST_INFRA.md and TEST_READY.md.
3. Run .venv/bin/pytest and report baseline & new test execution status.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your report to /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/test_writer_t1/handoff.md and notify me via send_message when complete.
