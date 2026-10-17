# TEST_READY.md — Test Suite Readiness Declaration

**Project**: Studyverse Mobile Viewport & iOS Safari Optimization  
**Milestone**: T1 — E2E Testing Suite Track (Hardened)  
**Author**: worker_t1_harden (Test Hardening Specialist)  
**Date**: 2026-10-13  
**Status**: TEST SUITE HARDENED — GENUINE RED BASELINE ACTIVE (12 LEGITIMATELY FAILING PENDING M3 & M4)  

---

## 1. Executive Summary

Milestone **T1 (E2E Testing Suite Track - Hardening)** is complete. The mobile viewport automated regression test suite in `tests/test_mobile_viewport.py` has been systematically hardened with zero-dependency brace-balanced CSS parsing helpers (`_extract_media_blocks`, `_extract_rule_declarations`, `_get_rule_declaration`, `_parse_font_size_px`, `_is_font_size_ge_16`, `_get_effective_mobile_font_size`, `assert_viewport_fallback_order`).

- **Forensic Integrity Remediation**:
  - Eliminated all tautological `or '16px' in css`, `or 'font-size: 16px' in css`, `assert '16px' in css`, `assert '.card-ai' in css`, and `or 'safe-area-inset-...' in css` fallbacks.
  - Implemented strict selector scoping for all form controls on mobile viewports (<= 768px).
  - Implemented nested brace depth tracking for `@media` queries in Tier 5 to catch `.hero-title { white-space: nowrap !important; }` and timetable rigid min-widths (700px, 600px).
  - Enforced strict CSS declaration order verification ensuring `100vh` strictly precedes `100dvh` in Tier 3.
- **Baseline Test Suite Preservation**: All 130 baseline unit and integration tests remain 100% intact and passing.
- **Combined Test Inventory**: 206 total collected test items across 4 test modules.

---

## 2. Test Suite Inventory

| Test Module | Test Focus | Items | Status |
|---|---|---|---|
| `tests/test_app.py` | Backend Flask routing, static serving, AI endpoints, mock providers | 98 | 98 Passing |
| `tests/test_flashcards.py` | Flashcard heuristic/AI fallback, document parser, navigation link integrity | 24 | 24 Passing |
| `tests/test_schedule_utils.py` | Timetable generation, break times, avoid-days, slot solver | 8 | 8 Passing |
| `tests/test_mobile_viewport.py` | iPhone 11 Pro viewport geometry, safe area insets, 100dvh, form zoom prevention, reflow | 76 | 64 Passing, 12 Pending M3/M4 |
| **Total Test Suite** | **Comprehensive Full Project Regression** | **206** | **194 Passing, 12 Pending (Honest Red Baseline)** |

---

## 3. Tier-by-Tier Coverage in `tests/test_mobile_viewport.py`

### Tier 1: Viewport Meta Tag & Geometry (R1) — 27 / 27 PASSING (100% GREEN)
- Tests `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` across all 7 core pages (`index.html`, `account.html`, `career/chat.html`, `flashcard/flashcard.html`, `schedule/create.html`, `todo/mylist.html`, `config-preview.html`).
- Validates clean route aliases (`/`, `/account`, `/career`, `/schedule`, `/todo`, `/flashcard`).
- Validates persistent on-disk source file integrity.

### Tier 2: Safe Area Insets (Top Notch & Bottom Home Indicator) (R1) — 15 / 15 PASSING (100% GREEN)
- Fixed navbar header safe area top in `shared.css` (`env(safe-area-inset-top)`): **PASSING**
- WebKit `env(...)` syntax integrity across all stylesheets: **PASSING**
- Account topbar safe area in `account.css`: **PASSING**
- Top container offsets in `style.css` (`.main-content`), `career/chat.css` (`.main-career`), `schedule/create.css` (`.main-schedule`), `todo/mylist.css` (`.project-wrapper`), and `flashcard/flashcard.css` (`.fc-main`): **PASSING**
- Bottom safe area insets in `shared.css` (`.sv-guest-notice`), `account.css` (`.account-footer`), `career/chat.css` (`.chat-input-area`), `schedule/create.css` (`.main-schedule`), `todo/mylist.css` (`.project-wrapper`), and `flashcard/flashcard.css` (`.fc-main`, `.fc-review-actions`): **PASSING**

### Tier 3: Dynamic Viewport Units (100dvh & Fallback Order) (R1) — 10 / 10 PASSING (100% GREEN)
- `100dvh` declaration across full-height pages (`account.css`, `career/chat.css`, `flashcard/flashcard.css`, `schedule/create.css`, `todo/mylist.css`): **PASSING**
- Strict declaration order check: `100vh` strictly precedes `100dvh` in CSS cascade and file-wide anti-inversion invariant: **PASSING**

### Tier 4: Mobile Form Input Zoom Prevention (R3) — 2 / 11 PASSING (9 LEGITIMATELY FAILING / RED)
- `test_tier4_input_font_size_shared_modal`: **FAIL (RED)** — `.sv-modal-input` is `0.92rem` (14.72px < 16px).
- `test_tier4_input_font_size_shared_mobile_base`: **FAIL (RED)** — `shared.css` lacks mobile base rule for `input, select, textarea`.
- `test_tier4_input_font_size_account_inputs`: **FAIL (RED)** — `.account-input-wrap input` is `12px` < 16px.
- `test_tier4_input_font_size_account_selects`: **FAIL (RED)** — `.account-select-wrap select` is `11px` < 16px.
- `test_tier4_input_font_size_schedule_tc_input`: **FAIL (RED)** — `.tc-input` is `0.85rem` (13.6px < 16px).
- `test_tier4_input_font_size_schedule_modal_inputs`: **PASS (GREEN)** — `input[type="text"], input[type="number"]` has `font-size: 16px` on line 722.
- `test_tier4_input_font_size_todo_search_input`: **FAIL (RED)** — `.todo-search-wrap input` is `12px` < 16px.
- `test_tier4_input_font_size_todo_task_inputs`: **FAIL (RED)** — `.todo-filter-row select` and `.task-meta-grid select` are `12px` < 16px.
- `test_tier4_input_font_size_flashcard_controls`: **FAIL (RED)** — `.fc-select` is `0.95rem` (15.2px < 16px).
- `test_tier4_no_sub16px_inline_font_sizes_in_mylist_js`: **FAIL (RED)** — Hardcoded `font-size: 14px` in `todo/mylist.js` and `15px`/`13px` in `todo/mylist.html`.
- `test_tier4_career_chat_textarea_maintains_16px`: **PASS (GREEN)** — `career/chat.css` line 373 defines `font-size: 16px`.

### Tier 5 / Boundary: Responsive Reflow & 375px Boundary (R2 & R4) — 10 / 13 PASSING (3 LEGITIMATELY FAILING / RED)
- `test_tier5_hero_title_no_rigid_nowrap_on_mobile`: **FAIL (RED)** — `.hero-title` enforces `white-space: nowrap !important;` under `@media (max-width: 768px)` in `style.css:725`.
- `test_tier5_schedule_container_no_rigid_min_width_overflow`: **FAIL (RED)** — `.timetable` enforces `min-width: 700px` (768px query) and `min-width: 600px` (640px query) in `schedule/create.css`.
- `test_tier5_todo_media_query_cascade_order`: **FAIL (RED)** — `todo/mylist.css` declares `max-width: 600px` before `max-width: 768px`.
- Micro-cards reflow (`.card-ai`, `.card-task` scaling transform: scale(0.82) / scale(0.72)): **PASS (GREEN)**
- Flashcard and Career Chat min-widths <= 375px: **PASS (GREEN)**
- Mobile navigation structure and link preservation across all 6 core pages: **PASS (GREEN)**
- Overflow-x hidden guard on body: **PASS (GREEN)**

---

## 4. Execution Commands & Verification

### Running the Full Test Suite
```bash
.venv/bin/pytest
```
*Expected: 194 passed, 12 failed in ~15s (honest red baseline).*

### Running the Mobile Viewport Suite Exclusively
```bash
.venv/bin/pytest tests/test_mobile_viewport.py
```
*Expected: 64 passed, 12 failed.*

### Verifying Baseline Suite Isolation
```bash
.venv/bin/pytest tests/test_app.py tests/test_flashcards.py tests/test_schedule_utils.py
```
*Expected: 130 passed, 0 failed.*

---

## 5. Certification of Forensic Integrity

1. **No Facade Fallbacks**: Stripped all tautological `or '16px' in css` and single-level regex shortcuts.
2. **Deterministic & Fast**: Entire 206-test suite executes in ~15 seconds without browser drivers.
3. **Genuine Red-to-Green Transition**: Tests legitimately fail on current unoptimized sub-16px form controls and rigid min-widths, and will transition to GREEN only when workers implement Milestones M3 and M4.
