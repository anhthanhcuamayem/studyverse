# Project: Studyverse Mobile Optimization (iPhone 11 Pro & iOS Safari)

## Architecture
- Target device: iPhone 11 Pro (375x812 viewport, physical Notch, Home Indicator)
- Target browser: iOS Safari (WebKit engine)
- Primary entry points:
  - Web views: `index.html`, `account.html`, `career/chat.html`, `flashcard/flashcard.html`, `schedule/create.html`, `todo/mylist.html`, `config-preview.html`
  - Shared & page stylesheets: `shared.css`, `style.css`, `account.css`, `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css`
  - JavaScript helpers: `todo/mylist.js`
- Test runners: `.venv/bin/pytest tests/test_mobile_viewport.py`, `.venv/bin/pytest`

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Viewport Meta Tags | `viewport-fit=cover`, `width=device-width` on all core HTML pages | M1 | R1 |
| 2 | Safe Area Inset Support | Safe area top (~44px) and bottom (~34px) insets on fixed headers, docks, footers | M1 | R1 |
| 3 | Dynamic Viewport Heights | `100dvh` with `100vh` fallback across full-height views | M1 | R1 |
| 4 | Responsive Navigation | 375px viewport header bar fit, tap targets >= 44px, no icon clipping/wrapping | M2 | R2 |
| 5 | Form Input Zoom Prevention | `font-size >= 16px` for inputs, selects, textareas on mobile (<= 768px) | M3 | R3 |
| 6 | Eliminate Inline Sub-16px Inputs | Remove sub-16px inline font styles in `todo/mylist.js` and `todo/mylist.html` | M3 | R3 |
| 7 | Hero Title & Reflow Integrity | Eliminate `white-space: nowrap !important` on `.hero-title` under mobile queries | M4 | R4 |
| 8 | Timetable Min-Width Elimination | Replace rigid min-widths (700px, 600px) with responsive/scroll containers | M4 | R4 |
| 9 | Media Query Cascade Integrity | Ensure `max-width: 768px` precedes `max-width: 600px` in `todo/mylist.css` | M4 | R4 |
| 10 | Card Reflow & Overflow Prevention | Ensure cards reflow within 375px without horizontal scrolling (`scrollWidth <= clientWidth`) | M4 | R4 |
| 11 | Comprehensive E2E Test Suite | 76 mobile viewport tests covering Tiers 1-5 in `tests/test_mobile_viewport.py` | T1 | Verification |
| 12 | 100% Full Regression Verification | Full suite passes cleanly (206 total tests) on `.venv/bin/pytest` | M5 | Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Viewport & Safe Area Foundations | Meta tags, `safe-area-inset-*`, `100dvh` | None | DONE |
| T1 | E2E Test Suite Creation & Hardening | `tests/test_mobile_viewport.py`, `TEST_READY.md` | M1 | DONE |
| M2 | Responsive Header & Navigation on 375px | Clean header bar fit, tap targets, no clipping | M1 | IN_PROGRESS |
| M3 | iOS Safari Form Input Zoom Prevention | `font-size >= 16px` for all mobile form controls | M1 | PLANNED |
| M4 | Page-Specific Layout & Reflow | Hero nowrap fix, schedule min-width fix, media query cascade | M1, M2, M3 | PLANNED |
| M5 | Final Verification & Audit | 100% pass on pytest (206 tests), integrity audit | M1-M4 | PLANNED |

## Interface Contracts
### Viewport & Safe Area
- Header fixed height: `min-height: calc(56px + env(safe-area-inset-top, 0px))`
- Main content top clearance: `padding-top: calc(76px + env(safe-area-inset-top, 0px))` on mobile
- Bottom clearance: `env(safe-area-inset-bottom, 0px)`
- Fallback sequence: `height: 100vh; height: 100dvh;`

### Form Controls
- On mobile viewports (`@media (max-width: 768px)` or narrower), all text inputs, number inputs, selects, textareas must have computed `font-size >= 16px` (or `>= 1rem` based on 16px root).

### Responsive Layout
- No element shall have rigid `min-width > 375px` inside mobile media queries.
- No `white-space: nowrap` on long text headings on mobile.
- Media query cascade must declare wider queries (e.g., 768px) before narrower queries (e.g., 600px, 480px) when using `max-width`.

## Code Layout
- HTML files: `index.html`, `account.html`, `career/chat.html`, `flashcard/flashcard.html`, `schedule/create.html`, `todo/mylist.html`, `config-preview.html`
- Stylesheets: `shared.css`, `style.css`, `account.css`, `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css`
- JavaScript: `todo/mylist.js`
- Tests: `tests/test_mobile_viewport.py`, `tests/test_app.py`, `tests/test_flashcards.py`, `tests/test_schedule_utils.py`
