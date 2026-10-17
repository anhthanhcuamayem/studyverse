# BRIEFING — 2026-10-13T05:46:00Z

## Mission
Implement Milestone M1: Viewport & Safe Area Foundations across all 7 HTML files and core stylesheets (`shared.css`, `account.css`, `style.css`, `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css`), and verify with test suite.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1/
- Original parent: bdce3044-e260-4522-8179-cfcdc4c408ba
- Milestone: M1 (Viewport & Safe Area Foundations)

## 🔒 Key Constraints
- Exclusively owned files for Milestone M1:
  - HTML: `index.html`, `account.html`, `career/chat.html`, `flashcard/flashcard.html`, `schedule/create.html`, `todo/mylist.html`, `config-preview.html`
  - CSS: `shared.css`, `account.css`, `style.css`, `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css`
- Follow Interface Contracts in PROJECT.md:
  - `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` (preserve `user-scalable=yes` where present)
  - CSS safe area variables syntax: `env(safe-area-inset-top, 0px)` and `env(safe-area-inset-bottom, 0px)`
  - Fixed navbar height calculation: `min-height: calc(56px + env(safe-area-inset-top, 0px));`
  - Page container top padding: `calc(76px + env(safe-area-inset-top, 0px));`
- Mandatory Integrity: No cheating, no hardcoded test assertions or fake results.
- Run `.venv/bin/pytest` and verify all 130 tests pass.

## Current Parent
- Conversation ID: bdce3044-e260-4522-8179-cfcdc4c408ba
- Updated: 2026-10-13T05:46:00Z

## Task Summary
- **What to build**: 
  1. Add `viewport-fit=cover` to all 7 HTML files.
  2. Safe area top: Add `env(safe-area-inset-top, 0px)` to `.navbar` in `shared.css`, `.account-topbar` and `.account-shell` in `account.css`, and adjust page top offsets (`.main-content`, `.main-career`, `.main-schedule`, `.project-wrapper`, `.fc-main`).
  3. Safe area bottom: Add `env(safe-area-inset-bottom, 0px)` to `.sv-guest-notice`, `.account-footer`, and chat input toolbar.
  4. Dynamic viewport height: Standardize on `100dvh` (with `100vh` fallback) across `account.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css`.
  5. Run pytest and verify 130 tests pass.
- **Success criteria**: All 7 HTML files have viewport-fit=cover, CSS files implement safe area insets and dvh units, 100% test pass on `.venv/bin/pytest`.
- **Interface contracts**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md`
- **Code layout**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/PROJECT.md § Code Layout`

## Key Decisions Made
- [TBD]

## Artifact Index
- `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1/progress.md` — Progress tracker and heartbeat
- `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/worker_m1/handoff.md` — Final handoff report

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: None

## Quality Status
- **Build/test result**: Baseline 130 tests passing (from survey)
- **Lint status**: 0 outstanding
- **Tests added/modified**: None
