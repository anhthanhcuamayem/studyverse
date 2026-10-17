# Original User Request

## 2026-10-13T05:32:02Z

Optimize the full Studyverse web application UI and UX for iPhone 11 Pro (375x812 viewport, Notch, Home Indicator) and iOS Safari mobile browsers across all core pages (Home, Account, Flashcards, Schedule, Todo, AI Chat).

Working directory: /home/thanh/LÀM VIỆC/project/studyverse
Integrity mode: development

## Requirements

### R1. Safe Area & Viewport Geometry
All core pages and fixed elements must respect iPhone 11 Pro display geometry (safe area top notch ~44px and bottom home indicator ~34px) with `viewport-fit=cover` and dynamic viewport units (`100dvh`), preventing content clipping and gesture interference.

### R2. Responsive Header & Navigation on 375px Viewport
The top navigation and action icons must cleanly fit on screens 375px wide without horizontal overflow, text clipping, or uncomfortably small tap targets.

### R3. iOS Safari Form Input Zoom Prevention
All text inputs, selects, and textareas across all pages must maintain at least 16px font-size on mobile viewports to prevent Safari from automatically zooming into the page on focus.

### R4. Horizontal Scroll & Content Collision Elimination
All page content, hero titles, buttons, and floating cards must reflow naturally within 375px without forcing horizontal scrolling or overlapping.

## Verification Resources
- Existing test suite runnable via `.venv/bin/pytest` covering core app and flashcards.
- HTML and CSS source files in the working directory: `index.html`, `account.html`, `account.css`, `shared.css`, `style.css`, `career/`, `flashcard/`, `schedule/`, `todo/`.

## Acceptance Criteria

### Safe Area & Viewport
- [ ] Viewport meta tags in all core HTML pages include `viewport-fit=cover`.
- [ ] Fixed header bars and bottom toolbars include safe area padding (`env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`).
- [ ] Full-height layouts utilize dynamic viewport height (`100dvh`) with fallbacks.

### Navigation & Layout
- [ ] At 375px width, the header bar displays all navigation items cleanly without clipping or wrapping awkwardly.
- [ ] Hero titles and floating cards reflow without overflowing the 375px boundary (`scrollWidth <= clientWidth`).

### Forms & Interactions
- [ ] On mobile viewports (<= 768px), all `input`, `select`, and `textarea` elements have computed `font-size >= 16px`.

### Regression
- [ ] All existing automated tests run and pass via `.venv/bin/pytest`.
