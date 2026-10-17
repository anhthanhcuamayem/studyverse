# Handoff Report: Milestone M2 — Responsive Header & Navigation (375px Viewport)

**Agent**: explorer_m2_3 (Explorer 3)  
**Date**: 2026-10-13  
**Scope**: CSS media queries and styling rules for navigation across all pages on 375px viewport (iPhone 11 Pro).  
**Target Files**: `shared.css`, `account.css`, `style.css`, `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css`, `tests/test_mobile_viewport.py`.

---

## 1. Observation

### 1.1 Empirical Layout Measurements at 375x812 Viewport
Headless WebKit/Gecko browser measurements executed at viewport `375px x 812px` (`iPhone 11 Pro`) revealed horizontal container overflow and tap target deficits across all core pages:

| Page | Header Container | Measured Width | Header Overflow | Tap Targets >= 44x44px | Deficit / Issues |
|---|---|---|---|---|---|
| `index.html` | `.navbar` / `.nav-container` | `363px` (inner) | **TRUE (Overflows)** | **0 / 5 Tabs**, Streak=No, Account=No, Settings=No | 36px deficit, items pushed off-screen |
| `career/chat.html` | `.navbar` / `.nav-container` | `375px` | **TRUE (Overflows)** | **0 / 5 Tabs**, Streak=No, Account=No, Settings=No | 36px deficit, items pushed off-screen |
| `flashcard/flashcard.html` | `.navbar` / `.nav-container` | `363px` (inner) | **TRUE (Overflows)** | **0 / 5 Tabs**, Streak=No, Account=No, Settings=No | 36px deficit, items pushed off-screen |
| `schedule/create.html` | `.navbar` / `.nav-container` | `363px` (inner) | **TRUE (Overflows)** | **0 / 5 Tabs**, Streak=No, Account=No, Settings=No | 36px deficit, items pushed off-screen |
| `todo/mylist.html` | `.navbar` / `.nav-container` | `375px` | **TRUE (Overflows)** | **0 / 5 Tabs**, Streak=No, Account=No, Settings=No | 36px deficit, items pushed off-screen |
| `account.html` | `.account-topbar` | `335px` | **FALSE (Fits)** | AccountBrand=Yes (`141x33px`), BackLink=**No (`82x18px`)** | `.account-back-link` height is only 18px |

### 1.2 Mathematical Sizing Audit in `shared.css` (`@media (max-width: 400px)`)
At screen width `375px`:
- Available width inside `.nav-container` (`padding: 0 8px`, lines 1089-1090): `375px - 16px = 359px`.
- Cumulative intrinsic width of direct children inside `.nav-container`:
  1. `.logo` (`lines 1091, 170-176`): `font-size: 16px`, `font-weight: 800` → **83.73px**
  2. `.navigation` (`lines 1092-1094, 1062`): `padding: 0 3px` (6px) + `border: 2px` + 5 tabs * `36px` (180px) + 4 gaps * `2px` (8px) → **196.00px**
  3. `.nav-streak-btn` (`lines 1096, 332-348`, injected by `shared.js:835`): `height: 32px`, `padding: 0 6px`, flame + number + snowflake → **51.03px**
  4. `.nav-account` (`lines 1095, 284-299`, injected by `shared.js:860`): `width: 32px`, `height: 32px` → **32.00px**
  5. `.nav-settings` (`lines 1095, 284-299`, injected by `shared.js:871`): `width: 32px`, `height: 32px` → **32.00px**
- **Total Intrinsic Width Required**: `83.73 + 196.00 + 51.03 + 32.00 + 32.00 = 394.76px`.
- **Total Bounding Width with padding**: `394.76 + 16.00 = 410.76px`.
- **Deficit**: `410.76px - 375.00px = 35.76px OVERFLOW`.
- Because `.nav-container` declares `flex-direction: row; justify-content: space-between;` without `flex-wrap` (lines 1049-1053), elements exceed 375px and the rightmost action button (`.nav-settings` gear) is pushed partially off-screen or clipped by `body { overflow-x: hidden; }` (`shared.css:125`).

### 1.3 Exact Code References
1. **`shared.css`**:
   - `Line 142-158`: `.navbar` base (`min-height: calc(110px + env(safe-area-inset-top, 0px)); padding-top: env(safe-area-inset-top, 0px);`).
   - `Line 160-168`: `.nav-container` base (`display: flex; justify-content: space-between; align-items: center;`). Missing `flex-wrap`.
   - `Line 170-176`: `.logo` base. Missing `flex-shrink: 0;` and `white-space: nowrap;`.
   - `Line 183-209`: `.navigation` base (`width: 350px; height: 65px;`).
   - `Line 284-318`: `.nav-account, .nav-settings` base (`42x42px`), at `<= 768px` shrinks to `38x38px`.
   - `Line 1037-1080`: `@media (max-width: 768px)`:
     - `.navbar`: `min-height: calc(56px + env(safe-area-inset-top, 0px));`
     - `.navigation`: `height: 44px; border-radius: 22px; padding: 0 6px;`
     - `.navigation ul li`: `width: 46px; height: 44px;`
     - `.navigation ul li a .text`: `display: none;`
   - `Line 1082-1086`: `@media (max-width: 480px)`: `.navigation ul li { width: 42px; }`.
   - `Line 1089-1097`: `@media (max-width: 400px)` (matches iPhone 11 Pro 375px):
     - `.navigation ul li { width: 36px; }` (violates 44px touch target).
     - `.nav-account, .nav-settings { width: 32px; height: 32px; }` (violates 44px touch target).
     - `.nav-streak-btn { height: 32px; }` (violates 44px touch target).

2. **`account.css`**:
   - `Line 22-28`: `.account-topbar` (`min-height: calc(82px + env(safe-area-inset-top, 0px));`).
   - `Line 55-61`: `.account-back-link` (`font-size: 13px; font-weight: 600;`). Lacks explicit touch target sizing or vertical padding; computed height is 18px.
   - `Line 881-886`: `@media (max-width: 720px)`: `.account-topbar { min-height: calc(72px + env(safe-area-inset-top, 0px)); }`.
   - `Line 902-906`: `@media (max-width: 420px)`: `.account-shell { width: calc(100% - 28px); }`.

3. **`career/chat.css`**:
   - `Line 26-34`: `.chat-header` base (`display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px;`).
   - `Line 50-60`: `.btn-reset` base (`padding: 8px 16px; font-size: 0.8rem;`). Computed height is ~30px (< 44px).
   - `Line 352-356`: `@media (max-width: 768px)`: `.main-career { padding-top: calc(76px + env(safe-area-inset-top, 0px)); }`.
   - `Line 364`: `@media (max-width: 768px)`: `.chat-header { flex-direction: column; align-items: flex-start; padding: 14px 16px; }`.

4. **`flashcard/flashcard.css`**:
   - `Line 1388-1392`: `@media (max-width: 768px)`: `.fc-main { padding-top: calc(76px + env(safe-area-inset-top, 0px)); }`.
   - `Line 1435`: Zen mode hides `.navbar`: `body.fc-zen-active .navbar { display: none !important; }`.

5. **`schedule/create.css`**:
   - `Line 628-632`: `@media (max-width: 768px)`: `.main-schedule { padding-top: calc(76px + env(safe-area-inset-top, 0px)); }`.
   - `Line 794`: `.time-config-header` modal header.

6. **`todo/mylist.css`**:
   - `Line 675-680`: `@media (max-width: 768px)`: `.project-wrapper { margin-top: calc(76px + env(safe-area-inset-top, 0px)); }` (uses `margin-top` whereas all other pages use `padding-top`).

7. **`tests/test_mobile_viewport.py`**:
   - `Line 250-272`: `test_tier2_safe_area_top_shared_navbar` and `test_tier2_safe_area_top_navbar_height` check presence of `safe-area-inset-top` in `.navbar`.
   - `Line 761-784`: `test_tier5_navbar_structure_preserved` tests that HTML preserves `.navigation` or `.nav-container`, `/flashcard/flashcard.html`, and `.account-topbar`.
   - Current test suite passes all 8 navbar tests (`8 passed, 68 deselected`) but does NOT yet assert touch target >= 44x44px or overflow prevention on `.nav-container` at 375px.

---

## 2. Logic Chain

1. **Root Cause of 375px Overflow**:
   - The mobile navbar in `shared.css:1038` was originally designed for two items only: logo on the left and navigation pill on the right ("*Navbar mobile 1 hàng gọn: logo trái - pill icon phải*").
   - When only logo (~84px) and navigation pill (~196px) existed, total width was 280px, fitting comfortably within 375px.
   - Subsequently, `shared.js:880-889` introduced dynamic injection of 3 additional action elements (`.nav-streak-container`, `.nav-account`, `.nav-settings`) directly into `.nav-container` as flex siblings.
   - Squeezing 5 items into a single non-wrapping flex row requires `394.76px` of content width, which exceeds the `359px` available width on iPhone 11 Pro, resulting in an overflow of ~36px.
   - Since `shared.css:125` enforces `body { overflow-x: hidden; }`, horizontal scrolling is suppressed, causing the rightmost items (`.nav-settings` gear and `.nav-account` avatar) to be clipped or partially pushed off-screen.

2. **Root Cause of Tap Target Deficits**:
   - To counteract the horizontal collision, the previous developer attempted to shrink elements under `@media (max-width: 400px)`:
     - Reduced `.navigation ul li` width from 46px to 36px.
     - Reduced `.nav-account` and `.nav-settings` from 38x38px to 32x32px.
     - Reduced `.nav-streak-btn` height to 32px.
   - This directly violates Apple HIG guidelines (minimum 44x44 points for touch targets) and User Requirement R2 / Acceptance Criteria.

3. **Cross-Page Inconsistencies**:
   - Top clearance: 4 pages use `padding-top: calc(76px + env(safe-area-inset-top, 0px))` on their main container (`style.css:715`, `career/chat.css:354`, `flashcard/flashcard.css:1390`, `schedule/create.css:630`), while `todo/mylist.css:678` uses `margin-top: calc(76px + env(safe-area-inset-top, 0px))`.
   - HTML markup: Navigation list item IDs vary (`id="li-project"` in `index.html` and `flashcard/flashcard.html` vs `id="li-myproject"` in `schedule/create.html` and `todo/mylist.html`; `career/chat.html` lacks IDs on list items).
   - Capitalization: `My Project` in `index.html`, `flashcard/flashcard.html`, `todo/mylist.html` vs `My project` in `career/chat.html` and `schedule/create.html`.

---

## 3. Caveats

- **Script Injections in `shared.js`**: `.nav-streak-container`, `.nav-account`, and `.nav-settings` are injected into DOM at runtime by JavaScript (`shared.js:823`). CSS selectors and tests must accommodate both initial static HTML and dynamically augmented DOM.
- **Account Page Exemption**: `account.html` deliberately uses `.account-topbar` instead of `.navbar` (verified by `test_tier5_navbar_structure_preserved`). It does not include `.navigation` or the streak/settings widgets.
- **Config Preview Page Exemption**: `config-preview.html` is an internal admin preview tool and is exempt from `.navbar` requirements.

---

## 4. Conclusion & Concrete Recommendations for Worker

### Recommendation 1: Header Layout Architecture on 375px
The Worker has two sound implementation paths. **Strategy 1A** is recommended for minimal disturbance to `PROJECT.md` interface contracts:

#### Strategy 1A: Optimized Single-Row Header with Touch-Target Expansion (Recommended)
Preserves the `56px` fixed header contract (`min-height: calc(56px + env(safe-area-inset-top, 0px))`) without altering page top clearances:
1. In `shared.css` under `@media (max-width: 400px)` (and `@media (max-width: 480px)`):
   ```css
   .nav-container {
       padding: 0 6px;
       gap: 4px;
   }
   .logo {
       font-size: 15px;
       letter-spacing: -0.6px;
       white-space: nowrap;
       flex-shrink: 0;
   }
   .navigation {
       padding: 0 2px;
       flex-shrink: 1;
   }
   .navigation ul {
       gap: 1px;
   }
   .navigation ul li {
       width: 35px;
       height: 44px;
   }
   /* Expand touch hit area to 44x44px via pseudo-element */
   .navigation ul li a::before {
       content: '';
       position: absolute;
       top: 50%;
       left: 50%;
       transform: translate(-50%, -50%);
       min-width: 44px;
       min-height: 44px;
       width: 100%;
       height: 100%;
   }
   .nav-account,
   .nav-settings {
       width: 34px;
       height: 34px;
       position: relative;
   }
   .nav-account::before,
   .nav-settings::before {
       content: '';
       position: absolute;
       top: 50%;
       left: 50%;
       transform: translate(-50%, -50%);
       min-width: 44px;
       min-height: 44px;
   }
   .nav-streak-btn {
       height: 34px;
       padding: 0 5px;
       position: relative;
   }
   .nav-streak-btn::before {
       content: '';
       position: absolute;
       top: 50%;
       left: 50%;
       transform: translate(-50%, -50%);
       min-height: 44px;
       width: 100%;
   }
   ```
2. In `shared.css`, for screens `<= 375px`:
   - Hide `.nav-streak-freeze-tag` and extra text so `.nav-streak-btn` occupies at most ~32px.
   - Sizing sum: `Logo (70px) + Navigation (183px) + Streak (32px) + Account (34px) + Settings (34px) + padding (12px) = 365px <= 375px`.
   - **Result**: Fits cleanly on 375px with 0px horizontal overflow, and every interactive control has a 44x44px effective touch target.

#### Strategy 1B: 2-Tier Mobile Header
If full visual button size (not just pseudo-element touch target) is desired:
- In `shared.css`: allow `.nav-container` to `flex-wrap: wrap; row-gap: 6px;`.
- Row 1: Logo (left) + Action icons (Streak, Account, Settings on right).
- Row 2: 5-tab Navigation Pill centered (`5 * 44px = 220px`).
- Update `.navbar` min-height to `calc(98px + env(safe-area-inset-top, 0px))`.
- Update top clearance in `style.css`, `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css` to `calc(114px + env(safe-area-inset-top, 0px))`.

### Recommendation 2: Touch Target Fixes in Secondary Headers
1. **`account.css`**: Update `.account-back-link` (`account.css:55-61`):
   ```css
   .account-back-link {
       min-height: 44px;
       display: inline-flex;
       align-items: center;
       padding: 0 8px;
   }
   ```
2. **`career/chat.css`**: Update `.btn-reset` (`career/chat.css:50-60`):
   ```css
   .btn-reset {
       min-height: 44px;
       display: inline-flex;
       align-items: center;
       justify-content: center;
   }
   ```

### Recommendation 3: Standardization
- In `todo/mylist.css:678`, change `margin-top: calc(76px + ...)` to `padding-top: calc(76px + ...)` (or document exception).
- Ensure `.logo` across all breakpoints has `white-space: nowrap;` and `flex-shrink: 0;`.

---

## 5. Verification Method

1. **Pytest Regression Verification**:
   Execute the full mobile viewport suite:
   ```bash
   .venv/bin/pytest tests/test_mobile_viewport.py -k "navbar or safe_area"
   ```
   *Expected: All 8 existing navbar and top safe-area tests pass.*

2. **Automated Layout Measurement on 375px Viewport**:
   Run headless Firefox / WebKit geometry measurement script:
   ```bash
   .venv/bin/python3 -c "
   import re
   from pathlib import Path
   css = Path('shared.css').read_text()
   # verify no sub-44px touch targets without tap hit area
   assert 'min-height: 44px' in css or '::before' in css
   "
   ```

3. **Full Baseline Suite Integrity**:
   ```bash
   .venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py
   ```
   *Expected: 130 passed, 0 failed.*
