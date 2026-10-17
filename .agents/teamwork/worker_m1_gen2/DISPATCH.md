## 2026-10-13T06:16:49Z
You are worker_m1_gen2 (Viewport & Safe Area Worker Replacement).
Your working directory is /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1_gen2/
You MUST read /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md and /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1_gen2/DISPATCH.md before starting work.
Refer also to /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md, /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_1/handoff.md, and /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_2/handoff.md.

Exclusively owned files for Milestone M1:
- index.html, account.html, career/chat.html, flashcard/flashcard.html, schedule/create.html, todo/mylist.html, config-preview.html
- shared.css, account.css, style.css, career/chat.css, flashcard/flashcard.css, schedule/create.css, todo/mylist.css

Tasks:
1. Viewport meta tags: Update remaining HTML files (career/chat.html, flashcard/flashcard.html, schedule/create.html, todo/mylist.html, config-preview.html) with viewport-fit=cover. (index.html and account.html already updated).
2. Safe Area Top: Add env(safe-area-inset-top) to .navbar in shared.css, .account-topbar in account.css, and adjust content top offsets in all page stylesheets.
3. Safe Area Bottom: Add env(safe-area-inset-bottom) to .sv-guest-notice, .account-footer, and chat input toolbar.
4. Dynamic Viewport Heights: Add min-height: 100dvh (fallback 100vh) across account, flashcard, schedule, todo.
5. Run .venv/bin/pytest and verify that all 130 tests pass.
6. Update progress.md with timestamp header "Last visited: [timestamp]" after completing each step.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your report to /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1_gen2/handoff.md and notify me via send_message when complete.
