# Dispatch: Worker M2 (Responsive Header & Navigation on 375px Viewport)

- Role: Worker
- Milestone: M2
- Working Directory: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m2/
- Original User Request: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md
- Master Plan: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md
- Test Suite Status: /home/thanh/LÀM VIỆC/project/studyverse/TEST_READY.md
- Explorer Reports:
  - /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_m2_1/handoff.md
  - /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_m2_2/handoff.md
  - /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_m2_3/handoff.md

## Exclusive File Ownership
You have exclusive write access to:
- `shared.css`
- `account.css`
- `style.css`
- `career/chat.css`
- `schedule/create.css`
- `todo/mylist.css`
- `flashcard/flashcard.css`
Do NOT modify `tests/test_mobile_viewport.py`.
Do NOT modify HTML structure unless strictly necessary (all explorers confirm 0 HTML changes needed).

## Task Scope & Implementation Plan
Implement the responsive 2-row reflow for mobile navigation on `<= 480px` (including iPhone 11 Pro 375px) based on the Explorer synthesis:
1. `shared.css`:
   - Under `@media (max-width: 480px)` (and update lines 1082-1098):
     - `.navbar`: `min-height: calc(96px + env(safe-area-inset-top, 0px)); padding-top: env(safe-area-inset-top, 0px); padding-bottom: 6px;`
     - `.nav-container`: `display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; padding: 4px 12px; row-gap: 6px;`
     - `.logo`: `order: 1; font-size: 19px; white-space: nowrap; margin-right: auto; flex-shrink: 0;`
     - `.nav-streak-container`: `order: 2; margin-right: 6px;`
     - `.nav-streak-btn`: `height: 38px; padding: 0 10px; font-size: 0.85rem; gap: 5px; min-height: 38px;`
     - `.nav-account`: `order: 3; width: 38px; height: 38px; font-size: 0.95rem; margin-right: 6px; flex-shrink: 0;`
     - `.nav-settings`: `order: 4; width: 38px; height: 38px; font-size: 0.95rem; flex-shrink: 0;`
     - `.navigation`: `order: 5; width: 100%; height: 44px; border-radius: 22px; padding: 0 4px; margin-top: 2px;`
     - `.navigation ul`: `width: 100%; display: flex; justify-content: space-around; gap: 0;`
     - `.navigation ul li`: `flex: 1; width: auto; min-width: 0; height: 44px;`
     - `.navigation ul li a`: `width: 100%; height: 44px; display: flex; align-items: center; justify-content: center;`
     - `.navigation ul li a .icon`: `font-size: 1.15rem; line-height: 44px;`
     - `.indicator`: `width: 48px; height: 38px; top: 50%; margin-top: -19px; border-radius: 19px;`
   - Fix popover top positioning for notch compatibility:
     - `.sv-settings-panel`, `.sv-streak-popover`: `top: calc(74px + env(safe-area-inset-top, 0px));` on `<= 768px`, and `top: calc(106px + env(safe-area-inset-top, 0px));` on `<= 480px`.
2. Page content top offsets for 2-row header under `@media (max-width: 480px)`:
   - `style.css`: `.main-content { padding-top: calc(106px + env(safe-area-inset-top, 0px)); }`
   - `career/chat.css`: `.main-career { padding-top: calc(106px + env(safe-area-inset-top, 0px)); }`
   - `schedule/create.css`: `.main-schedule { padding-top: calc(106px + env(safe-area-inset-top, 0px)); }`
   - `todo/mylist.css`: `.project-wrapper { margin-top: calc(106px + env(safe-area-inset-top, 0px)); }` (and preserve safe area top)
   - `flashcard/flashcard.css`: `.fc-main { padding-top: calc(106px + env(safe-area-inset-top, 0px)); }`
3. Tap target improvements:
   - `account.css`: `.account-back-link` (`display: inline-flex; align-items: center; min-height: 44px; padding: 8px 12px;`)
   - `career/chat.css`: `.btn-reset` (`min-height: 44px; display: inline-flex; align-items: center; justify-content: center;`)
4. Verify:
   - Run tests: `.venv/bin/pytest tests/test_mobile_viewport.py -k "navbar or safe_area"`
   - Run baseline suite: `.venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py`
   - Verify no regressions.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-10-13T10:15:42Z
You are Worker M2 (Responsive Header & Navigation on 375px Viewport).
Your working directory is /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m2/
Read your dispatch file at /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m2/DISPATCH.md
Read the authoritative user request at /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md
Read the master plan at /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md
Read the explorer reports at:
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_m2_1/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_m2_2/handoff.md
- /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_m2_3/handoff.md

Implement the responsive 2-row reflow for mobile navigation on <= 480px / 375px in shared.css, update popover notch safe-area tops, adjust subpage top offsets under <= 480px, and improve secondary tap targets in account.css and career/chat.css as detailed in DISPATCH.md.
