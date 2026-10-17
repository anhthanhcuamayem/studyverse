# CSS Architecture & Mobile Styling Survey Report

## 1. Observation

### 1.1 Project Stylesheet Architecture & Cascade Order
Every core HTML page loads Google Fonts `Inter`, FontAwesome icons, `shared.css` first, followed by its page-specific stylesheet:
1. `index.html` (lines 11-12): links `/shared.css` and `/style.css`.
2. `account.html` (lines 12-13): links `/shared.css` and `/account.css`.
3. `career/chat.html` (lines 11-12): links `/shared.css` and `/career/chat.css`.
4. `flashcard/flashcard.html` (lines 11-12): links `/shared.css` and `flashcard.css`.
5. `schedule/create.html` (lines 11-12): links `/shared.css` and `create.css?v=20260926-2`.
6. `todo/mylist.html` (lines 11-13): links `/shared.css`, `mylist.css`, and Flatpickr `dark.css`.

Total stylesheets surveyed: 7 files (`shared.css`, `style.css`, `account.css`, `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css`).

---

### 1.2 Viewport Meta Tags & Safe Area Inset Support
- **Viewport Meta Tags**:
  - `account.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
  - `career/chat.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
  - `flashcard/flashcard.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">`
  - `index.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
  - `schedule/create.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">`
  - `todo/mylist.html:5`: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
  - **Direct observation**: `viewport-fit=cover` is absent from all 6 HTML documents.

- **Safe Area Insets (`env(safe-area-inset-top)` / `env(safe-area-inset-bottom)`)**:
  - `env(safe-area-inset-top)`: **0 occurrences** across all CSS files in the repository.
  - `env(safe-area-inset-bottom)`: only **3 occurrences** across the entire repository:
    1. `career/chat.css:367`: `.chat-input-area { padding: 12px 12px calc(12px + env(safe-area-inset-bottom)); }`
    2. `schedule/create.css:759`: `.main-schedule { padding-bottom: calc(20px + env(safe-area-inset-bottom)); }`
    3. `todo/mylist.css:739`: `main { padding-bottom: env(safe-area-inset-bottom); }`
  - Fixed elements lacking top safe area padding:
    - `shared.css:142-156` / `shared.css:1040`: `.navbar` (`position: fixed; top: 0; left: 0; height: 64px;` at mobile). No `padding-top: env(safe-area-inset-top)`.
    - `account.css:20-25`: `.account-topbar` (`min-height: 82px;` desktop, `72px` mobile). No `padding-top: env(safe-area-inset-top)`.
  - Fixed content top offsets:
    - `career/chat.css:352`: `.main-career { padding-top: 100px; }`
    - `schedule/create.css:628`: `.main-schedule { padding-top: 100px; }`
    - `style.css:714`: `.main-content { padding-top: 100px; }`
    - `flashcard/flashcard.css:11`: `.fc-main { padding-top: 90px; }`
    - `todo/mylist.css:677`: `.project-wrapper { margin-top: 100px; }`
    - None of these include `calc(... + env(safe-area-inset-top))`.
  - Floating/fixed bottom elements lacking bottom safe area padding:
    - `shared.css:1121-1125`: `.sv-guest-notice { position: fixed; left: 20px; bottom: 20px; }`
    - `account.css:855`: `.account-footer { min-height: 48px; }`
    - `flashcard/flashcard.css:749`: `.fc-review-actions`

---

### 1.3 Media Queries & Breakpoint Architecture
Catalog of media queries across all 7 stylesheets:
| Stylesheet | Media Queries Found (Line Numbers) | Observations |
|---|---|---|
| `shared.css` | `max-width: 1024px` (1019), `900px` (733, 1025), `768px` (312, 742, 1035), `520px` (1205), `480px` (1008, 1074), `400px` (1081), `330px` (1092), `print` (1103, 1214) | Irregular order (480px appears at 1008 before 1024px at 1019). Breakpoint for 375px is subsumed under `max-width: 400px`. |
| `account.css` | `max-width: 920px` (861), `720px` (868), `420px` (882), `prefers-reduced-motion` (893) | Completely non-standard breakpoints (920px, 720px, 420px). Missing standard 768px, 480px, 375px. |
| `career/chat.css` | `max-width: 768px` (351) | Single mobile breakpoint at 768px. No 480px or 375px rules. |
| `flashcard/flashcard.css` | `max-width: 992px` (1378), `768px` (1387), `480px` (1411) | Standard breakpoints, but lacks 375px refinement. |
| `schedule/create.css` | `max-width: 1024px` (613), `900px` (622), `768px` (626), `640px` (732, 1338), `print` (1362) | Cuts off at 640px; no 480px or 375px rules. |
| `style.css` | `max-width: 768px` (712), `480px` (777) | Covers 768px and 480px; lacks 375px refinement. |
| `todo/mylist.css` | `max-width: 600px` (623), `768px` (674) | **Inverted cascade order**: `600px` is declared at line 623 before `768px` at line 674. |

---

### 1.4 Form Controls & iOS Safari Auto-Zoom Audit (Font-Size < 16px)
iOS Safari triggers automatic zooming when focusing form controls (`input`, `select`, `textarea`) with computed `font-size < 16px`.
Observed font-size declarations:
1. **`account.css`**:
   - Line 192: `.account-input-wrap input` -> `font-size: 12px;` (No mobile override).
   - Line 242: `.account-select-wrap select` -> `font-size: 11px;` (No mobile override).
2. **`shared.css`**:
   - Line 937: `.sv-modal-input` -> `font-size: 0.92rem;` (14.72px at 16px root font).
3. **`flashcard/flashcard.css`**:
   - Line 97: `.fc-select, .fc-input, .fc-textarea` -> `font-size: 0.95rem;` (15.2px).
   - Line 1178: `.fc-preview-input` -> `font-size: 0.92rem;` (14.72px).
   - Line 1228: `.fc-search-box input` -> inherits default browser / 15.2px.
   - No mobile media query exists in `flashcard.css` to bump inputs to 16px.
4. **`todo/mylist.css` & `todo/mylist.js`**:
   - `mylist.css:442`: `.todo-search-wrap input` -> `font-size: 12px;`
   - `mylist.css:446`: `.todo-filter-row select` -> `font-size: 12px;`
   - `mylist.css:488`: `.task-meta-grid select, .task-meta-grid input, .task-schedule-field select` -> `font-size: 12px;`
   - `mylist.css:720-725`: Under `@media (max-width: 768px)`:
     `#taskNameInput, #taskDeadlineInput, #editTaskName, #editTaskDate { font-size: 16px; }`
     - **Defects**:
       - `#taskSearchInput` remains 12px.
       - `#taskEstimateInput` remains 12px.
       - `#taskStatusFilter`, `#taskPriorityFilter`, `#taskPriorityInput`, `#taskRepeatInput`, `#taskScheduleInput` remain 12px.
       - Dynamic edit inputs generated in `mylist.js:966` use `id="editTaskName-${task.id}"` and `id="editTaskDate-${task.id}"` with inline `style="... font-size: 14px; ..."` on `editTaskDate`, completely bypassing `#editTaskName, #editTaskDate`.
5. **`schedule/create.css` & `schedule/create.js`**:
   - `create.css:181`: `input[type="text"], input[type="number"]` -> `font-size: 0.9rem;` (14.4px).
   - `create.css:719-721`: Under `@media (max-width: 768px)`:
     `input[type="text"], input[type="number"] { font-size: 16px; }`
   - `create.css:1260`: `.tc-input` (`input[type="time"]` in time config modal) -> `font-size: 0.85rem;` (13.6px). It is not targeted by line 720.
   - `create.css:919`: `.tc-lesson-duration` -> `font: inherit;` (inherits `0.72rem` = 11.52px from `.tc-number-wrap`).
6. **`career/chat.css`**:
   - `chat.css:189`: `.chat-input-area textarea` -> `font-size: 0.9rem;` (14.4px).
   - `chat.css:369`: Under `@media (max-width: 768px)`: `.chat-input-area textarea { font-size: 16px; }` (Properly handled).

---

### 1.5 Viewport Height Units Audit (`100vh` vs `100dvh` vs `100svh`)
- `account.css:2-3, 13-14`:
  ```css
  min-height: 100vh;
  min-height: 100svh;
  ```
  Uses `100svh` (small viewport height) rather than dynamic `100dvh`.
- `career/chat.css:21-22, 355-356`:
  ```css
  height: calc(100vh - 132px);
  height: calc(100dvh - 132px);
  min-height: 420px;
  ```
  `100dvh` is used with `100vh` fallback; however, `min-height: 420px` at mobile creates an overflow risk when virtual keyboard opens.
- `flashcard/flashcard.css:13, 1440`:
  `.fc-main { min-height: 100vh; }` without `100dvh` fallback or modern unit.
- `schedule/create.css:11, 567`:
  `.main-schedule { min-height: 100vh; }` (no dvh).
  `.subject-picker { max-height: calc(100vh - 24px); }` (no dvh).
  `.time-config-modal` (lines 781-782) properly defines `max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px);`.
- `shared.css:394-395, 709-710, 737-738, 747-748`:
  `.sv-streak-popover` and `.sv-settings-panel` properly use `100vh` fallback followed by `100dvh`.
- `todo/mylist.css:25`:
  `.project-wrapper { min-height: calc(100vh - 180px); }` (no dvh).

---

### 1.6 Horizontal Overflow Risks on 375px Viewport
1. **Navbar Item Collision on 375px (`shared.css:1081-1089`)**:
   - Available width in `.nav-container` at 375px: `375px - 16px padding = 359px`.
   - Element widths:
     - `.logo`: ~85px.
     - `.navigation`: 5 items * 36px + 4 gaps (2px each = 8px) + 6px padding = 194px.
     - Injected `.nav-streak-btn`: ~48-52px.
     - Injected `.nav-account`: 32px.
     - Injected `.nav-settings`: 32px.
     - Total unconstrained width: `85 + 194 + 50 + 32 + 32 = 393px`.
     - Result: `393px > 359px`. Because `.nav-container` has `display: flex; justify-content: space-between;` and no wrapping, controls collide or overflow screen boundaries.
2. **Homepage Hero Title Overflow (`style.css:721-724`)**:
   - `style.css:723`:
     ```css
     .hero-title {
         font-size: 22px !important;
         white-space: nowrap !important;
     }
     ```
   - In Vietnamese ("A simple list to manage everything" / "Một nơi gọn gàng cho mọi mục tiêu"), string width exceeds 380px at 22px font size, forcing horizontal overflow beyond 375px.
3. **Floating Cards Collision (`style.css:797-805`)**:
   - `.card-ai` (`top: -16px; left: 0; transform: scale(0.72)`) and `.card-task` (`top: -16px; right: 0; transform: scale(0.72)`) pinned to opposite screen edges inside 375px container collide with the center illustration image (`.img-large`).
4. **Flashcard Fixed Minimum Widths (`flashcard/flashcard.css:113, 1217`)**:
   - `.fc-select { min-width: 180px; }`
   - `.fc-search-box { min-width: 260px; }`
   - In `.fc-list-head`, `.fc-search-box` + `.fc-list-actions` side by side exceeds 375px unless forced to 100% width.
5. **Schedule Timetable Width (`schedule/create.css:754`)**:
   - `.timetable { min-width: 600px; }`. Handled via `.timetable-container { overflow-x: auto; }`, but dependent on container padding remaining within bounds.
6. **Todo Layout Cascade Order (`todo/mylist.css:623-674`)**:
   - `@media (max-width: 600px)` declared at line 623 before `@media (max-width: 768px)` at line 674.

---

## 2. Logic Chain

1. **Premise 1 (Viewport & Safe Area)**:
   - iOS Safari only enables `env(safe-area-inset-*)` values when `<meta name="viewport">` includes `viewport-fit=cover`.
   - Observation 1.2 shows that none of the 6 HTML pages specify `viewport-fit=cover`.
   - Therefore, currently on iPhone 11 Pro, `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` evaluate to `0px`, causing letterboxing or zero offset.
   - When `viewport-fit=cover` is added, Observation 1.2 shows that `.navbar` (mobile height 64px) and `.account-topbar` have zero top safe-area padding. The notch (~44px) will cover 68% of the 64px navigation bar, clipping the logo and buttons.
   - Furthermore, page content containers (`.main-career`, `.main-schedule`, `.main-content`, `.project-wrapper`, `.fc-main`) offset navbar height using hardcoded `padding-top: 100px` (or `90px`). Once `.navbar` expands to `calc(64px + env(safe-area-inset-top)) = ~108px`, top content will be partially concealed behind the navbar unless page padding is updated to `calc(100px + env(safe-area-inset-top))`.

2. **Premise 2 (iOS Safari Input Auto-Zoom)**:
   - iOS Safari triggers page zoom whenever an input element with computed `font-size < 16px` receives focus.
   - Observation 1.4 confirms that `account.css` defines input font size as `12px` and select as `11px`, `flashcard.css` uses `0.95rem` (15.2px) and `0.92rem` (14.72px), `schedule/create.css` has `input[type="time"]` at `0.85rem` (13.6px), `todo/mylist.css` has search/filter/metadata selects at `12px`, and `shared.css` has modal input at `0.92rem` (14.72px).
   - In `todo/mylist.css`, line 720 attempted a fix for `#taskNameInput, #taskDeadlineInput, #editTaskName, #editTaskDate`, but Observation 1.4 shows it left out all `<select>` dropdowns, `#taskSearchInput`, `#taskEstimateInput`, and failed to match dynamic IDs (`editTaskName-${task.id}`) which also contain inline `font-size: 14px;` in `mylist.js:972`.
   - Therefore, tapping on virtually any input or select in Account, Flashcard, Schedule (time config), or Todo will trigger disruptive iOS Safari page zooming on iPhone 11 Pro.

3. **Premise 3 (375px Horizontal Overflow Elimination)**:
   - Observation 1.6 demonstrates that at 375px width, available content width inside standard padding (16px total) is 359px.
   - In `style.css:723`, `.hero-title` has `white-space: nowrap !important;`. The title text width (~390px) exceeds 359px, violating Requirement R4 and forcing horizontal scroll.
   - In `shared.css:1081`, `.nav-container` holds 5 distinct items (Logo + 5-tab Navigation pill + Streak button + Account avatar + Settings gear) whose unconstrained cumulative width is ~393px, exceeding 359px. Without adaptive hiding, shrinking, or overflow management at 375px, the header overflows or wraps awkwardly.
   - In `flashcard.css`, `.fc-select` and `.fc-search-box` enforce `min-width: 180px` and `min-width: 260px`, colliding in multi-column flex rows.

4. **Premise 4 (Viewport Dynamic Heights)**:
   - Dynamic mobile browser elements (Safari top URL pill and bottom toolbar) collapse during scrolling. `100vh` uses maximum height (causing bottom content clipping when bars are visible), while `100svh` uses minimum height (leaving gaps when bars collapse).
   - `account.css:3, 14` uses `min-height: 100svh;` which does not stretch to full screen when bars collapse.
   - Full-height screens (`career/chat.html`, modal overlays) must standardize on `100dvh` with a `100vh` fallback.
   - In `career/chat.css:357`, mobile `.chat-card` has `min-height: 420px;`. When the iOS virtual keyboard appears (~300px), viewport shrinks below 420px, forcing the input area out of view.

---

## 3. Caveats
1. **Viewport Meta Tag Prerequisites**: Testing safe area CSS in browser devtools requires emulating iOS Safari with `viewport-fit=cover`. Without the meta tag change in HTML, safe area CSS rules will evaluate to 0px.
2. **Third-party Flatpickr CSS**: `todo/mylist.html` loads `https://npmcdn.com/flatpickr/dist/themes/dark.css`. Flatpickr popup inputs/dropdowns are controlled by the external stylesheet unless scoped custom CSS is applied.
3. **Dynamic Script Injections**: Elements like `.nav-streak-container`, `.nav-settings`, `.nav-account` are injected dynamically by `shared.js:823` into `.nav-container`. CSS rules must accommodate both initial and injected DOM structures.

---

## 4. Conclusion & Actionable Recommendations

Studyverse has a clean two-layer CSS architecture (`shared.css` + page stylesheet), but requires systematic remediation across 4 specific dimensions to satisfy the iPhone 11 Pro (375x812) / iOS Safari requirements:

### Summary of Required Changes:
1. **Safe Area & Viewport Geometry (R1)**:
   - Add `viewport-fit=cover` to all 6 HTML `<meta name="viewport">` tags.
   - In `shared.css:1040` (`@media (max-width: 768px)`):
     - Update `.navbar`: `padding-top: env(safe-area-inset-top); height: calc(64px + env(safe-area-inset-top));`.
     - Update all page top padding offsets (`.main-content`, `.main-career`, `.main-schedule`, `.project-wrapper`, `.fc-main`): `calc(100px + env(safe-area-inset-top))` (or `calc(90px + ...)`).
   - In `account.css`:
     - Update `.account-shell`: `padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);`.
     - Replace `100svh` with `100dvh` (with `100vh` fallback).
   - In `shared.css`: Update `.sv-guest-notice`: `bottom: calc(20px + env(safe-area-inset-bottom));`.
   - In `career/chat.css:357`: Adjust `.chat-card` `min-height` so it can shrink gracefully when the mobile keyboard opens.

2. **Responsive Header on 375px Viewport (R2)**:
   - In `shared.css:1081` (`@media (max-width: 400px)`):
     - Optimize `.nav-container`: gap reduction, tighten navigation pill (`padding: 0 2px`, li `width: 33px`).
     - Tighten or compact streak widget (`.nav-streak-btn { padding: 0 4px; }`), account, and settings buttons (`28px x 28px`), or allow flex shrinking to ensure `totalWidth <= 355px`.

3. **Form Input Zoom Prevention (R3)**:
   - In `shared.css`: Add a global mobile rule under `@media (max-width: 768px)`:
     ```css
     input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
     select,
     textarea,
     .sv-modal-input {
         font-size: 16px !important;
     }
     ```
   - In `account.css`, `flashcard.css`, `schedule/create.css`, `todo/mylist.css`: Ensure page-specific rules (`.account-input-wrap input`, `.account-select-wrap select`, `.fc-select`, `.fc-input`, `.tc-input`, `.todo-filter-row select`, `#taskSearchInput`, `.task-meta-grid select`) declare `font-size: 16px` on mobile (<= 768px).
   - In `todo/mylist.js:972`: Remove hardcoded inline `style="font-size: 14px;"` on dynamic date input.

4. **Horizontal Scroll & Collision Elimination (R4)**:
   - In `style.css:721`: Change `.hero-title` under mobile from `white-space: nowrap !important;` to `white-space: normal !important; text-wrap: balance;`.
   - In `style.css:797-805`: Reflow floating cards (`.card-ai`, `.card-task`) or hide/stack cleanly on <= 375px so they do not collide with center art.
   - In `flashcard.css:1411`: Ensure `.fc-select` and `.fc-search-box` reset `min-width: 0; width: 100%;` on <= 480px.
   - In `todo/mylist.css`: Correct media query declaration order (`max-width: 768px` before `max-width: 600px`).

---

## 5. Verification Method

1. **Automated Regression Suite**:
   Run the project test suite to verify zero breakages:
   ```bash
   .venv/bin/pytest
   ```
   *Expected outcome: 130 tests pass.*

2. **Headless Chrome / Playwright 375x812 Viewport Verification**:
   Inspect computed properties across all pages at 375x812 viewport:
   - Verify `document.documentElement.scrollWidth <= 375` (zero horizontal overflow).
   - Verify `window.getComputedStyle(element).fontSize >= "16px"` on all `<input>`, `<select>`, `<textarea>`.
   - Verify navbar height and page container padding include `env(safe-area-inset-top)`.

3. **Invalidation Conditions**:
   The findings herein would be invalidated if:
   - A global reset already forces `font-size >= 16px` (confirmed NOT present; reset in `shared.css:118` only sets margin/padding/box-sizing/font-family).
   - Pages use alternative responsive techniques like CSS zoom/transform on viewport root (confirmed NOT present).
