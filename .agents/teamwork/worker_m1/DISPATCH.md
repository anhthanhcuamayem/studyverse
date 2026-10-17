# Dispatch for Worker M1: Viewport & Safe Area Foundations

**Role**: Worker (HTML & CSS Safe Area Implementation)
**Working Directory**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1/
**Authoritative Request**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md
**Project Document**: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md
**Explorer Survey Reports**:
- Explorer 1 (HTML): `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_1/handoff.md`
- Explorer 2 (CSS): `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_2/handoff.md`

## Objectives
1. **Viewport Meta Tags**:
   Update `<meta name="viewport" ...>` in all 7 HTML files to include `viewport-fit=cover`:
   - `index.html`
   - `account.html`
   - `career/chat.html`
   - `flashcard/flashcard.html`
   - `schedule/create.html`
   - `todo/mylist.html`
   - `config-preview.html`
   Format: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` (preserve `user-scalable=yes` where present).

2. **Top Safe Area (Notch ~44px)**:
   - `shared.css`: Update `.navbar` under mobile media queries to add `padding-top: env(safe-area-inset-top, 0px); min-height: calc(56px + env(safe-area-inset-top, 0px));`.
   - `account.css`: Update `.account-topbar` and `.account-shell` to include `padding-top: env(safe-area-inset-top, 0px);`.
   - Update main content containers across all pages to account for safe area header height:
     - `style.css` (`.main-content`): `padding-top: calc(76px + env(safe-area-inset-top, 0px));`
     - `career/chat.css` (`.main-career`): `padding-top: calc(76px + env(safe-area-inset-top, 0px));`
     - `schedule/create.css` (`.main-schedule`): `padding-top: calc(76px + env(safe-area-inset-top, 0px));`
     - `todo/mylist.css` (`.project-wrapper`): `margin-top: calc(76px + env(safe-area-inset-top, 0px));`
     - `flashcard/flashcard.css` (`.fc-main`): `padding-top: calc(76px + env(safe-area-inset-top, 0px));`

3. **Bottom Safe Area (Home Indicator ~34px)**:
   - `shared.css`: `.sv-guest-notice { bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }`
   - `account.css`: `.account-footer { padding-bottom: env(safe-area-inset-bottom, 0px); }`
   - `career/chat.css`: Ensure `.chat-input-area` respects `env(safe-area-inset-bottom, 0px)`.

4. **Dynamic Viewport Height (`100dvh`)**:
   - `account.css`: `.account-page` and `.account-shell` use `min-height: 100vh; min-height: 100dvh;`.
   - `flashcard/flashcard.css`: `min-height: 100vh; min-height: 100dvh;`.
   - `schedule/create.css`: `.main-schedule` use `min-height: 100vh; min-height: 100dvh;`.
   - `todo/mylist.css`: `.project-wrapper` use `min-height: calc(100vh - 180px); min-height: calc(100dvh - 180px);`.

5. **Verification**:
   Run `.venv/bin/pytest` to verify all 130 tests pass.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.


## 2026-10-13T05:45:23Z
[Message] timestamp=2026-10-13T05:45:23Z sender=bdce3044-e260-4522-8179-cfcdc4c408ba priority=MESSAGE_PRIORITY_HIGH
You are worker_m1 (Viewport & Safe Area Implementation Worker).
Your working directory is /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1/
You MUST read /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md and /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1/DISPATCH.md before starting work.
Refer also to /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md, /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_1/handoff.md, and /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_2/handoff.md.

Exclusively owned files for Milestone M1:
- index.html, account.html, career/chat.html, flashcard/flashcard.html, schedule/create.html, todo/mylist.html, config-preview.html
- shared.css, account.css, style.css, career/chat.css, flashcard/flashcard.css, schedule/create.css, todo/mylist.css

Tasks:
1. Viewport meta tags: Add `viewport-fit=cover` to all 7 HTML files.
2. Safe Area Top: Add `env(safe-area-inset-top)` to `.navbar` in shared.css, `.account-topbar` in account.css, and adjust content top offsets in all page stylesheets.
3. Safe Area Bottom: Add `env(safe-area-inset-bottom)` to `.sv-guest-notice`, `.account-footer`, and chat input toolbar.
4. Dynamic Viewport Heights: Add `min-height: 100dvh` (fallback 100vh) across account, flashcard, schedule, todo.
5. Run `.venv/bin/pytest` and verify that all 130 tests pass.
