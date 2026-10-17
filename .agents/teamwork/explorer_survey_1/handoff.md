# Survey Report: HTML & Navigation Structure for iPhone 11 Pro / iOS Safari Optimization

**Explorer**: explorer_survey_1 (HTML Navigation Explorer)  
**Date**: 2026-10-13  
**Working Directory**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/explorer_survey_1/`  
**Reference Request**: `/home/thanh/LÀM VIỆC/project/studyverse/.agents/teamwork/ORIGINAL_REQUEST.md`

---

## 1. Observation

### 1.1 Complete Inventory of HTML Pages and Routing
A comprehensive scan of the repository identified **7 HTML files** (6 core user-facing pages + 1 developer tool), mapped by Flask in `app.py`:

| HTML File Path | Page Identity / Purpose | Route in `app.py` | Route Alias |
|---|---|---|---|
| `index.html` | Homepage (Hero, AI Preview, Highlights, Features) | `/` | `/` |
| `account.html` | Account (Auth, Profile, AI Tuning, Streak Heatmap) | `/account.html` | `/account`, `/account/` |
| `flashcard/flashcard.html` | Flashcard (3D Study Scene, Quiz, File Upload, List) | `/flashcard/flashcard.html` | `/flashcard`, `/flashcard/` |
| `schedule/create.html` | Interactive Schedule (Timetable, Subject Pool, Auto-AI) | `/schedule/create.html` | `/schedule`, `/schedule/` |
| `todo/mylist.html` | Todo & Projects (Project Sidebar, Tasks, Filter Views) | `/todo/mylist.html` | `/todo`, `/todo/` |
| `career/chat.html` | AI Career Advisor (Streaming SSE Chat, Action Cards) | `/career/chat.html` | `/career`, `/career/` |
| `config-preview.html` | Dev Tool (Theme & Schedule slot live preview) | `/config-preview.html` | (Static dev file) |

All 6 core pages are defined in `app.py:250-266` within `PUBLIC_FILES` and `ROUTE_ALIASES`.

---

### 1.2 Viewport Meta Tags Inspection
Inspection of `<meta name="viewport" ...>` in all 7 HTML files revealed that **0 out of 7 files include `viewport-fit=cover`**:

- `index.html:5`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```
- `account.html:5`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```
- `flashcard/flashcard.html:5`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  ```
- `schedule/create.html:5`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  ```
- `todo/mylist.html:5`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```
- `career/chat.html:5`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```
- `config-preview.html:5`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```

---

### 1.3 Header Bar & Navigation DOM Structure
#### A. Core 5-Page Standard Header (`index.html`, `flashcard.html`, `schedule/create.html`, `todo/mylist.html`, `career/chat.html`)
The static HTML in all 5 pages contains:
```html
<header class="navbar">
    <div class="nav-container">
        <a href="/" class="logo">Study<span>verse</span></a>
        <nav class="navigation">
            <ul>
                <li class="list" id="li-home" data-index="0">
                    <a href="/index.html">
                        <span class="icon"><i class="fa-solid fa-house"></i></span>
                        <span class="text" data-i18n="nav.home">Home</span>
                    </a>
                </li>
                <li class="list" id="li-project" data-index="1">
                    <a href="/todo/mylist.html">
                        <span class="icon"><i class="fa-solid fa-list-check"></i></span>
                        <span class="text" data-i18n="nav.project">My Project</span>
                    </a>
                </li>
                <li class="list" id="li-schedule" data-index="2">
                    <a href="/schedule/create.html">
                        <span class="icon"><i class="fa-regular fa-calendar"></i></span>
                        <span class="text" data-i18n="nav.schedule">Schedule</span>
                    </a>
                </li>
                <li class="list" id="li-career" data-index="3">
                    <a href="/career/chat.html">
                        <span class="icon"><i class="fa-regular fa-comment-dots"></i></span>
                        <span class="text" data-i18n="nav.career">AI Career</span>
                    </a>
                </li>
                <li class="list" id="li-flashcard" data-index="4">
                    <a href="/flashcard/flashcard.html">
                        <span class="icon"><i class="fa-solid fa-layer-group"></i></span>
                        <span class="text" data-i18n="nav.flashcard">Flashcard</span>
                    </a>
                </li>
                <div class="indicator"></div>
            </ul>
        </nav>
    </div>
</header>
```

#### B. Dynamic Header Elements Injected at Runtime (`shared.js:823-889`)
When `shared.js` initializes (`initSettingsUI()`), it appends 3 additional interactive widgets into `.nav-container`:
1. `.nav-streak-container` (`#navStreakContainer` with `#navStreakBtn` and `#svStreakPopover`)
2. `.nav-account` (`<a class="nav-account" href="/account.html">`)
3. `.nav-settings` (`<button class="nav-settings">`)

#### C. Account Page Header (`account.html:17-23`)
`account.html` has a unique minimalist header:
```html
<header class="account-topbar">
    <a class="account-brand" href="/" aria-label="Studyverse">
        <span class="account-brand-mark"><i class="fa-solid fa-graduation-cap"></i></span>
        <span>Study<span class="account-brand-accent">verse</span></span>
    </a>
    <a class="account-back-link" href="/" data-i18n="account.backHome">Về trang chủ</a>
</header>
```

---

### 1.4 Detailed 375px Geometry & Collision Measurements

#### A. Header Bar Overflow on 375px (`shared.css:1080-1089`)
In `shared.css`:
```css
@media (max-width: 400px) {
    .nav-container { padding: 0 8px; }
    .logo { font-size: 16px; }
    .navigation { padding: 0 3px; }
    .navigation ul li { width: 36px; }
    .indicator { width: 32px; }
    .nav-account, .nav-settings { width: 32px; height: 32px; font-size: 0.85rem; }
    .nav-streak-btn { height: 32px; padding: 0 6px; font-size: 0.75rem; gap: 4px; }
}
```
Available inner width at 375px viewport = `375px - (2 * 8px) = 359px`.  
Total widths of flex items placed on this single row without wrapping:
- `.logo`: ~80px ("Studyverse" at 16px font-weight 800)
- `.navigation` (5 items): `5 * 36px = 180px` + padding `2 * 3px = 6px` + `gap: 2px * 4 = 8px` = **194px**
- `.nav-streak-btn`: padding 12px + flame icon 16px + count 14px + freeze tag 10px = **~52px**
- `.nav-account`: **32px**
- `.nav-settings`: **32px**

Sum: `80 + 194 + 52 + 32 + 32 = 390px`.  
`390px > 359px` (Exceeds available width by **31px**).  
Because `.nav-container` has `display: flex; justify-content: space-between; align-items: center;` without `flex-wrap`, this forces children to collide, shrink below comfortable tap target sizes, or cause horizontal scrolling.

#### B. Notch Clipping (Safe Area Top = 44px)
In `shared.css`:
```css
.navbar {
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    height: 110px;
    ...
}
@media (max-width: 768px) {
    .navbar { height: 64px; align-items: center; padding-bottom: 0; }
}
```
- `.navbar` has **zero** `padding-top: env(safe-area-inset-top)`.
- On iPhone 11 Pro in portrait, the top notch extends down **44px**.
- In a 64px navbar, vertical center is at **y = 32px**, which falls directly behind the physical hardware notch and iOS status bar indicators (clock, cellular, battery).
- On `account.html:870`, `.account-topbar` has `min-height: 72px` and similarly lacks `padding-top: env(safe-area-inset-top)`.

#### C. Page Top Offset vs. Fixed Navbar
Current top padding for main content containers when mobile navbar is fixed:
- `style.css:714`: `.main-content { padding-top: 100px; }`
- `career/chat.css:352`: `.main-career { padding-top: 100px; }`
- `schedule/create.css:628`: `.main-schedule { padding-top: 100px; }`
- `todo/mylist.css:677`: `.project-wrapper { margin-top: 100px; }`
- `flashcard/flashcard.css:11`: `.fc-main { padding-top: 90px; }`
When safe area top padding (`~44px`) is added to `.navbar` (making total height `64px + 44px = 108px`), existing `90px-100px` offsets will cause page content tops to be partially obscured behind the navbar.

#### D. Home Indicator Clipping (Safe Area Bottom = 34px)
Fixed / bottom-attached elements:
- `account.html`: `.account-footer` (`account.css:879`) has no `padding-bottom: env(safe-area-inset-bottom)`. Footer text collides directly with the iOS Home Indicator line.
- `career/chat.html`: `.chat-input-area` (`career/chat.css:367`) has `padding: 12px 12px calc(12px + env(safe-area-inset-bottom));`, but this evaluates to `12px` because `viewport-fit=cover` is missing in the HTML `<meta name="viewport">`.
- `flashcard/flashcard.html`: `.fc-review-actions` (`flashcard.css:1415-1422`) and `.fc-nav-controls` sit close to bottom without safe area margin.
- `todo/mylist.html`: `main` has `padding-bottom: env(safe-area-inset-bottom);` (`todo/mylist.css:739`), but evaluates to `0px` without `viewport-fit=cover`.

---

### 1.5 Horizontal Overflow & Floating Element Collision (`index.html`)

#### A. Hero Title `nowrap` Overflow (`style.css:721-724`)
```css
@media (max-width: 768px) {
    .hero-title {
        font-size: 22px !important;
        white-space: nowrap !important;
    }
}
.white-text {
    white-space: nowrap;
    ...
}
.blue-text {
    white-space: nowrap;
    ...
}
```
- In Vietnamese (the default language), `home.hero1` (`shared.js:312`) translates to:  
  `"Một danh sách đơn giản để"` (26 characters).
- At `font-size: 22px` with `font-weight: 800`, this line renders at **~325px width**.
- Combined with `.hero { padding: 0 5%; }` (38px total) and `.hero-title { padding: 0 20px; }` (40px total), the required width is `325 + 38 + 40 = 403px`.
- Because of `white-space: nowrap !important;`, the text cannot wrap onto multiple lines, directly causing `scrollWidth (403px) > clientWidth (375px)`.

#### B. Floating Micro-Cards Collision (`style.css:736-748`, `style.css:797-805`)
- In desktop: 4 micro-cards (`card-ai`, `card-task`, `card-schedule`, `card-streak`).
- At `<=768px`: `card-schedule` and `card-streak` are hidden (`display: none;`).
- At `<=480px`:
  - `.card-ai`: `left: 0; top: -16px; transform: scale(0.72);`
  - `.card-task`: `right: 0; top: -16px; transform: scale(0.72);`
- Unscaled card width is ~185px. At `scale(0.72)`, each card takes ~133px.
- In a 335px wrapper (375px viewport minus 20px container padding), two cards positioned at `top: -16px` leave only `335 - 266 = 69px` clearance between them. Any longer translated text or larger font size causes overlapping collisions in the center of the illustration.

---

### 1.6 Full-Height Layout Containers
Inventory of viewport height units across full-height pages:

| Page / Component | CSS Selector | File & Line | Current Height Unit | Issue / Requirement |
|---|---|---|---|---|
| Account Page | `.account-page` | `account.css:2-3` | `min-height: 100vh; min-height: 100svh;` | Missing `100dvh` (uses `svh` which locks to smallest viewport, leaving gaps when Safari toolbar minimizes) |
| Account Shell | `.account-shell` | `account.css:13-14` | `min-height: 100vh; min-height: 100svh;` | Missing `100dvh` |
| Career Chat Card | `.chat-card` | `career/chat.css:21-22, 355-356` | `height: calc(100vh - 132px); height: calc(100dvh - 132px);` | Already has `100dvh`, but offset must adjust for safe area top |
| Todo Wrapper | `.project-wrapper` | `todo/mylist.css:25` | `min-height: calc(100vh - 180px);` | Missing `calc(100dvh - 180px)` |
| Flashcard Zen | `body.fc-zen-active .fc-main` | `flashcard/flashcard.css:1440` | `min-height: 100vh;` | Missing `100dvh` |
| Schedule Page | `.main-schedule` | `schedule/create.css:11` | `min-height: 100vh;` | Missing `100dvh` |

---

### 1.7 Form Inputs, Selects & Textareas with Font-Size < 16px
On iOS Safari, any form element with computed `font-size < 16px` triggers an automatic zoom-in upon focus, disorienting the user and clipping surrounding content.

| File Path & Line | CSS Selector | Elements Affected | Current Font-Size | Required |
|---|---|---|---|---|
| `account.css:192` | `.account-input-wrap input` | `#profileDisplayName`, `#profileDailyGoal`, `#profileInterests`, `#authEmail`, `#authPassword`, `#authPasswordConfirm` | `12px` | `16px` |
| `account.css:242` | `.account-select-wrap select` | `#profileAiCalling`, `#profileAiStyle`, `#profileAiFocus` | `11px` | `16px` |
| `todo/mylist.css:398, 442` | `.todo-search-wrap input`, `.todo-filter-row select` | `#taskSearchInput`, `#taskStatusFilter`, `#taskPriorityFilter` | `12px` | `16px` |
| `todo/mylist.css:488` | `.task-meta-grid select, input`, `.task-schedule-field select` | `#taskPriorityInput`, `#taskEstimateInput`, `#taskRepeatInput`, `#taskScheduleInput` | `12px` | `16px` |
| `flashcard/flashcard.css:97` | `.fc-select, .fc-input, .fc-textarea` | `#fcDeckSelect`, `#fcTargetDeckName`, `#fcNumCardsSelect`, `#fcStyleSelect`, `#fcSearchInput`, `#fcFilterStatus`, `#fcTextInput`, `#fcEditFront`, `#fcEditBack`, `#fcEditHint`, `#fcDeckNameInput` | `0.95rem` (~15.2px) | `16px` |
| `shared.css:937` | `.sv-modal-input` | Deck rename prompt, project creation prompt (`svPrompt`) | `0.92rem` (~14.7px) | `16px` |

---

### 1.8 Existing Test Suite Baseline & Navbar Test Constraints
1. Execution of `.venv/bin/pytest`:
   - **130 passed in 14.17s** (100% green baseline).
2. Critical navbar DOM integrity check in `tests/test_flashcards.py:274-287`:
   - Asserts that all 5 core pages (`index.html`, `todo/mylist.html`, `schedule/create.html`, `career/chat.html`, `flashcard/flashcard.html`) contain:
     - `class="navigation"`
     - `/flashcard/flashcard.html`
     - `data-i18n="nav.flashcard"`
     - `fa-layer-group`
   - Any refactoring of the navigation on mobile MUST retain these classes, links, data attributes, and icon classes.

---

## 2. Logic Chain

1. **Premise 1 (R1 - Viewport meta tags)**:
   - iOS WebKit only enables safe area geometry and passes non-zero values for `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` when `viewport-fit=cover` is declared in `<meta name="viewport">`.
   - Observation 1.2 confirmed that all 7 HTML files currently have `content="width=device-width, initial-scale=1.0"`.
   - *Therefore*: Until `viewport-fit=cover` is added to all core HTML files, any CSS using `env(safe-area-inset-*)` resolves to `0px`, causing letterboxing and notch/indicator clipping on iPhone 11 Pro.

2. **Premise 2 (R1 & R2 - Notch & Header)**:
   - The iPhone 11 Pro portrait viewport is 375x812 pt with a 44px top notch.
   - Observation 1.4.B showed `.navbar` is fixed at `top: 0` with height 64px and zero `padding-top: env(safe-area-inset-top)`.
   - *Therefore*: The top 44px of the navbar sits behind the hardware notch and iOS status bar, placing nav items (centered at y=32px) directly underneath the notch. Applying `padding-top: env(safe-area-inset-top)` and adjusting total navbar height to `calc(64px + env(safe-area-inset-top))` is strictly required.

3. **Premise 3 (R2 - 375px Nav Width & Action Icons)**:
   - Observation 1.4.A measured that the single-row navbar container requires at least 390px to render Logo (80px), 5 nav items (194px), Streak button (52px), Account button (32px), and Settings button (32px).
   - The available container width at 375px is 359px (375px - 16px padding).
   - *Therefore*: On 375px mobile screens, keeping all 5 tabs and all 3 action icons on the same top header row causes immediate horizontal overflow and tap target squishing.
   - *Architectural Recommendation*: 
     - Move the 5 primary page navigation items (`.navigation`) into a **fixed bottom mobile tab bar** (`position: fixed; bottom: 0; left: 0; right: 0; padding-bottom: env(safe-area-inset-bottom); background: var(--navbar-bg); backdrop-filter: blur(16px); z-index: 1000;`) on mobile screens (`<= 768px`).
     - This perfectly conforms to iOS Human Interface Guidelines (standard iOS Tab Bar), gives each of the 5 tabs a generous ~75px wide tap target with bottom safe area support, keeps the existing DOM structure intact to satisfy `tests/test_flashcards.py`, and leaves the top navbar with only `[ Logo ]` on the left and `[ Streak ] [ Account ] [ Settings ]` on the right (taking only ~200px of the 359px available width).

4. **Premise 4 (R3 - iOS Safari Input Zoom)**:
   - Safari on iOS automatically zooms in when focusing any text input, select, or textarea with computed `font-size < 16px`.
   - Observation 1.7 identified inputs and selects with font sizes as low as `11px` and `12px` across `account.css`, `todo/mylist.css`, `flashcard/flashcard.css`, and `shared.css`.
   - *Therefore*: A targeted rule in each stylesheet plus a global mobile fallback in `shared.css` (`@media (max-width: 768px) { input, select, textarea { font-size: 16px; } }`) must be implemented to prevent auto-zooming.

5. **Premise 5 (R4 - Horizontal Scroll on 375px)**:
   - Observation 1.5.A proved that `.hero-title` in `style.css:722` has `white-space: nowrap !important;` which causes the Vietnamese title "Một danh sách đơn giản để" to render at ~325px + padding = 403px > 375px.
   - Observation 1.5.B proved that floating micro-cards in `.illustration-wrapper` risk colliding or clipping when both cards sit at `top: -16px`.
   - Observation 1.4.D proved that `.fc-study-topbar` contains 8 buttons (360px) without `flex-wrap`.
   - *Therefore*: Removing `nowrap !important` on `.hero-title`, adding `flex-wrap: wrap` to `.fc-study-topbar`, and adjusting card positions are necessary to guarantee `scrollWidth <= clientWidth` (375px).

---

## 3. Caveats

1. **Orientation**: The investigation focused primarily on iPhone 11 Pro portrait mode (375x812 pt). In landscape mode (812x375 pt), safe area insets shift to the left/right (`env(safe-area-inset-left)` and `env(safe-area-inset-right)` ~44px). The viewport meta tag `viewport-fit=cover` supports landscape mode, but horizontal padding will rely on container bounds.
2. **Dynamic Script Injections**: `icons.js` replaces `<i>` tags with `<svg>` elements on `DOMContentLoaded`. Test assertions checking `fa-layer-group` rely on static HTML response strings before JS execution, which remains compatible.
3. **No Headless iOS Device in Linux Environment**: Linux CI environment does not have native Safari WebKit or iOS Simulator. Safe area behaviors must be verified via Playwright/Firefox viewport emulation and static code/AST assertions.

---

## 4. Conclusion & Actionable Proposals

### Summary of Core Findings
1. **Viewport Meta Tags**: All 7 HTML files currently lack `viewport-fit=cover`.
2. **Header Bar on 375px**: Top navbar contains 5 page tabs + 3 action widgets + logo in one row, requiring 390px in a 359px container. It also lacks notch safe area padding (`env(safe-area-inset-top)`).
3. **Form Inputs**: 6 input/select categories across Account, Todo, Flashcard, and Modals have font-sizes between 11px and 15.2px, causing iOS Safari auto-zoom.
4. **Hero Title & Floating Cards**: `style.css:722` enforces `white-space: nowrap !important;` on `.hero-title`, forcing horizontal overflow past 375px in Vietnamese.
5. **Full-Height Containers**: `account.css` uses `100svh` and `100vh` instead of `100dvh`. `todo/mylist.css` uses `calc(100vh - 180px)`.

### Concrete Proposed Code Changes

#### 1. Update Viewport Meta Tags in all 7 HTML files
Add `viewport-fit=cover` to `<meta name="viewport" ...>`:
```html
<!-- Before -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- After -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```
Target files:
- `index.html` (line 5)
- `account.html` (line 5)
- `career/chat.html` (line 5)
- `flashcard/flashcard.html` (line 5)
- `schedule/create.html` (line 5)
- `todo/mylist.html` (line 5)
- `config-preview.html` (line 5)

#### 2. Responsive Header & Mobile Bottom Navigation Bar in `shared.css`
In `shared.css:1035-1073` (`@media (max-width: 768px)`):
- Add `padding-top: env(safe-area-inset-top, 0px)` to `.navbar`.
- Transform `.navigation` into a fixed bottom navigation bar:
```css
@media (max-width: 768px) {
    .navbar {
        height: auto;
        min-height: calc(56px + env(safe-area-inset-top, 0px));
        padding-top: env(safe-area-inset-top, 0px);
        padding-bottom: 6px;
        align-items: center;
    }

    .nav-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 16px;
    }

    /* Đưa thanh điều hướng 5 tab xuống đáy màn hình dạng iOS Tab Bar */
    .navigation {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        height: calc(54px + env(safe-area-inset-bottom, 0px));
        padding: 4px 8px env(safe-area-inset-bottom, 0px);
        border-radius: 0;
        border-left: none;
        border-right: none;
        border-bottom: none;
        border-top: 1px solid var(--border-soft);
        background: var(--navbar-bg);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        z-index: 1000;
        display: flex;
        justify-content: space-around;
    }

    .navigation ul {
        width: 100%;
        display: flex;
        justify-content: space-around;
        gap: 0;
    }

    .navigation ul li {
        flex: 1;
        max-width: 72px;
        height: 48px;
    }

    .navigation ul li a .icon {
        font-size: 1.15rem;
        line-height: 48px;
    }

    /* Indicator trượt bên trong bottom tab bar */
    .indicator {
        width: 44px;
        height: 38px;
        top: 50%;
        margin-top: -19px;
        border-width: 3px;
        border-radius: 19px;
    }
}
```

#### 3. Adjust Content Offsets for Top Navbar and Bottom Tab Bar
Update sub-pages to have:
- `padding-top: calc(72px + env(safe-area-inset-top, 0px))`
- `padding-bottom: calc(70px + env(safe-area-inset-bottom, 0px))`
Affecting:
- `style.css` (`.main-content`)
- `career/chat.css` (`.main-career`)
- `schedule/create.css` (`.main-schedule`)
- `todo/mylist.css` (`.project-wrapper`)
- `flashcard/flashcard.css` (`.fc-main`)
- `account.css` (`.account-topbar`, `.account-shell`, `.account-footer`)

#### 4. Eliminate Horizontal Scroll in `style.css`
In `style.css:721-724`:
```css
/* Before */
.hero-title {
    font-size: 22px !important;
    white-space: nowrap !important;
}

/* After */
.hero-title {
    font-size: clamp(20px, 6vw, 24px) !important;
    white-space: normal !important;
    text-wrap: balance;
    word-break: break-word;
}
.white-text,
.blue-text {
    white-space: normal !important;
}
```

#### 5. Enforce 16px Minimum Font-Size on Mobile Form Controls
In `shared.css:1035`:
```css
@media (max-width: 768px) {
    input, select, textarea {
        font-size: 16px !important;
    }
}
```
Plus clean targeted updates to `account.css:192, 242`, `todo/mylist.css:398, 442, 488`, `flashcard/flashcard.css:97`, and `shared.css:937`.

#### 6. Dynamic Viewport Heights (`100dvh`)
- Update `account.css:2, 13` to include `min-height: 100dvh;`.
- Update `todo/mylist.css:25` to include `min-height: calc(100dvh - 180px);`.
- Update `flashcard/flashcard.css:1440` to include `min-height: 100dvh;`.
- Update `schedule/create.css:11` to include `min-height: 100dvh;`.

---

## 5. Verification Method

1. **Automated Test Suite Regression**:
   ```bash
   .venv/bin/pytest
   ```
   Must pass 100% (all 130 tests including `test_navbar_contains_flashcard_tab_on_all_pages`).

2. **Verify HTML Viewport Tags**:
   ```bash
   grep -H "viewport-fit=cover" index.html account.html career/chat.html flashcard/flashcard.html schedule/create.html todo/mylist.html
   ```
   Each core HTML file must match.

3. **Verify 16px Minimum Mobile Font Sizes**:
   Check computed CSS for `input`, `select`, `textarea` in `@media (max-width: 768px)`:
   ```bash
   grep -rn "16px" account.css todo/mylist.css flashcard/flashcard.css shared.css
   ```

4. **Verify Dynamic Viewport Units (`100dvh`)**:
   ```bash
   grep -rn "100dvh" account.css career/chat.css flashcard/flashcard.css schedule/create.css todo/mylist.css
   ```

5. **Invalidation Conditions**:
   - Any test failure in `.venv/bin/pytest`.
   - Any HTML page missing `viewport-fit=cover`.
   - Any mobile input with `font-size < 16px`.
   - Any page having `scrollWidth > clientWidth` at 375px width.
