# Handoff Report: Frontend JS/HTML/CSS & Security Audit

**Agent:** `teamwork_explorer_audit_3`  
**Date:** 2026-11-03  
**Status:** Hard Handoff (Investigation & Reporting Complete)  
**Parent Conversation ID:** `acf5f9ab-bd8b-4b61-952e-4171dbd6a324`  
**Detailed Report Path:** `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\explorer_audit_3\audit_frontend_security.md`

---

## 1. Observation

Direct code observations and verbatim test failures recorded during the investigation:

1. **Pytest Test Suite Execution Result:**
   Command: `.venv\Scripts\pytest -v`
   Result: `18 failed, 162 passed in 1.60s`
   Key verbatim errors:
   - `TypeError: fake_request_ai() got an unexpected keyword argument 'has_image'` at `tests/test_app.py:151, 170, 189, 510, 1113`
   - `AssertionError: style.css enforces white-space: nowrap on .hero-title under mobile media queries: [('(max-width: 768px)', 'font-size: 22px !important;\n white-space: nowrap !important;')]` at `tests/test_mobile_viewport.py:605`
   - `AssertionError: Found rigid min-widths > 375px in mobile schedule css: [('(max-width: 768px)', '.timetable', '700px'), ('(max-width: 640px)', '.timetable', '600px')]` at `tests/test_mobile_viewport.py:655`
   - `AssertionError: todo/mylist.css: media query for 768px should appear BEFORE 600px so narrower styles override wider ones. assert 13504 < 12577` at `tests/test_mobile_viewport.py:681`
   - Sub-16px font-size assertions failed on `.sv-modal-input` (0.92rem), `.account-input-wrap input` (12px), `.account-select-wrap select` (11px), `.tc-input` (0.85rem), `#taskNameInput`, and inline input styles (`todo/mylist.html:133` font-size: 15px, `todo/mylist.html:137` font-size: 13px, `todo/mylist.js:990` font-size: 14px).

2. **Todo Module (`todo/mylist.html`, `todo/mylist.js`, `todo/mylist.css`):**
   - In `todo/mylist.js:643, 660, 984, 1027`, `task.id` is interpolated into HTML attributes without escaping (`data-task-id="${task.id}"`, `id="editTaskName-${task.id}"`). In `importTodoData()`, imported JSON objects are passed into `saveProjects()` without sanitizing `task.id`.
   - In `todo/mylist.js:901, 913`, modal edit logic queries `document.querySelector('#modalOverlay h2')` and `document.querySelector('.modal-buttons')`. However, `todo/mylist.html:181, 192` contains `<h3 data-i18n="todo.newProjectTitle">` and `<div class="modal-footer">`.
   - In `todo/mylist.html:71, 76`, pencil icons `.btn-edit-name` and `.btn-edit-deadline` have `style="... display: none;"` hardcoded, and `todo/mylist.js` never reveals them nor attaches click listeners to them.
   - In `todo/mylist.js:86-93`, `saveProjects()` calls `localStorage.setItem` without a `try...catch` block.

3. **Schedule Module (`schedule/create.html`, `schedule/create.js`, `schedule/create.css`):**
   - In `schedule/create.js:785`:
     ```javascript
     <button class="btn-remove-subject" title="' + svT('sched.removeSubject') + '">✕</button>
     ```
     is written inside a backtick template literal (`` ` ``). The verbatim literal string `'+ svT('sched.removeSubject') + '` appears in the rendered DOM title attribute.
   - In `schedule/create.css:712, 756`, `.timetable` has `min-width: 700px;` at `(max-width: 768px)` and `min-width: 600px;` at `(max-width: 640px)`.
   - In `schedule/create.js:447, 629, 1056`, `subj.color` is inserted into `style="background: ${color}33..."` without sanitization.
   - In `schedule/create.js:1655-1665`, `clearAll()` does not reset `this.slots`, `this.lessonDuration`, or `this.lockLessonDuration` in memory.

4. **AI Career Module (`career/chat.html`, `career/chat.js`, `app.py`):**
   - In `career/chat.js:28-30`, `svInlineMarkdown()` uses regex `/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g` and embeds `$2` into `<a href="$2"...>`. Because `raw` was escaped earlier, `"` became `&quot;`. The regex captures URLs containing `&quot;`, and when inserted into `innerHTML`, the browser HTML parser resolves `&quot;` to `"`, breaking out of the `href` attribute into new event handlers.
   - In `app.py:765-790`, user-controlled fields (`displayName`, `dailyGoal`, `interests`, `aiCalling`, `aiStyle`, `aiFocus`) from `user_profile` are interpolated directly into the system prompt string without framing tags or sanitization.
   - In `career/chat.html:21, 27, 33`, list items in `.navigation` lack `id="li-home"`, `id="li-myproject"`, `id="li-schedule"`.

5. **Account Module (`account.html`, `account.css`, `auth.js`, `app.py`, `mailer.py`):**
   - In `app.py:510, 531`, `redirect_to = (data.get('redirectTo') or '').strip() or default_redirect` allows arbitrary external URLs. In `mailer.py:129-130`, `redirect_to` is passed to Supabase Admin `generate_link` without domain validation.
   - In `account.html:120-130, 143-172`, elements `#freezeCount`, `#streakFreezePill`, `#accountCalendarSection`, `#calPrevMonthBtn`, `#calNextMonthBtn`, `#calCurrentMonthLabel`, `#calendarDaysGrid`, `#calMonthStudyDays`, `#calMonthFrozenDays`, `#calMonthRate` are declared, but `auth.js` has zero code referencing or rendering them.
   - In `account.html:76`, avatar is `<div class="account-avatar" id="accountAvatar">S</div>`. There is no file input, no upload event listener, and no Supabase Storage interaction.
   - Logged-in users have no password change form in `signedInPanel`.
   - In `account.css:199, 249`, `.account-input-wrap input` has `font-size: 12px;` and `.account-select-wrap select` has `font-size: 11px;`.

6. **Shared Assets & Navigation:**
   - In `style.css:725`, `.hero-title` has `white-space: nowrap !important;` under `@media (max-width: 768px)`.
   - `admin.html` exists with size 0 bytes.
   - No flashcard remnants, orphaned endpoints, or broken imports remain in application code.

---

## 2. Logic Chain

1. **Stored XSS via Import JSON (SEC-01):**
   Observation: `normalizeTask()` retains unescaped `task.id` from user input; `renderTasks()` interpolates `task.id` directly into DOM attributes (`data-task-id="${task.id}"`).
   Logic: If an imported JSON task has `id: "\"><img src=x onerror=alert(1)>"`, the unescaped quote closes the attribute and injects arbitrary HTML/JS into the DOM upon render.

2. **Stored XSS via Markdown Link (SEC-02):**
   Observation: `svRenderMarkdown()` converts `"` to `&quot;`, and `svInlineMarkdown()` uses regex `(https?:\/\/[^\s)]+)` to inject `$2` into `<a href="$2">`.
   Logic: If a URL contains `&quot;`, the regex matches it. When the resulting string is set to `contentDiv.innerHTML`, HTML entity decoding inside attribute values converts `&quot;` to `"`, closing `href` and parsing injected attributes like `onclick=...`.

3. **Open Redirect / Account Takeover (SEC-03):**
   Observation: `app.py` passes `data.get('redirectTo')` without origin check to `mailer.generate_supabase_link()`.
   Logic: An attacker can request a reset link for any email with `redirectTo=https://evil.com/reset`. Supabase Admin creates a valid reset link with the attacker's redirect URL. The recipient gets an email from Studyverse; clicking it redirects to `evil.com#access_token=...`, exposing the bearer token.

4. **DOM Crash on Project Edit (BUG-01):**
   Observation: `mylist.js` looks for `#modalOverlay h2` and `.modal-buttons`. `mylist.html` has `<h3 data-i18n="todo.newProjectTitle">` and `<div class="modal-footer">`.
   Logic: Calling `.innerText` or `.prepend()` on `null` immediately throws a `TypeError`, halting execution.

5. **Template Literal Tooltip Bug (BUG-02):**
   Observation: In `schedule/create.js:785`, `title="' + svT('sched.removeSubject') + '"` is inside backticks.
   Logic: JavaScript only evaluates `${...}` inside template literals. Plain `+` string concatenation inside backticks remains verbatim characters, displaying literal code in the user tooltip.

6. **Mobile Viewport Failures (RESP-01 to RESP-04):**
   Observation: `style.css` enforces `white-space: nowrap !important` on `.hero-title`; `schedule/create.css` enforces `min-width: 600px/700px` on `.timetable`; multiple CSS files declare input font sizes between 11px and 15px; `todo/mylist.css` places 600px query before 768px query.
   Logic: iPhone 11 Pro viewport is 375px wide. Rigid widths > 375px or non-wrapping text force horizontal scrolling (breaking reflow). Font sizes < 16px trigger iOS Safari viewport auto-zoom on input focus. Inverted media query order causes 768px styles to override 600px styles on <= 600px screens.

---

## 3. Caveats

- **Scope Boundary:** This audit was strictly read-only; no application source code files were edited or patched.
- **Resend Live Delivery:** Testing real SMTP/Resend email delivery requires valid credentials (`RESEND_API_KEY`), which were not provided in the local dev environment (causing `test_mailer_config` to fail as expected).
- **Node.js Environment:** The local Python test environment lacks `node` in its system PATH, causing `test_shared_js_streak_and_helpers_execution` to fail with `FileNotFoundError`.

---

## 4. Conclusion

The Studyverse frontend application is functionally rich with extensive offline/storage scoping, but contains **2 Critical vulnerabilities** (Stored XSS in Todo JSON import and AI Career Markdown link parser), **6 High-severity issues** (Open redirect token leakage, modal DOM crash, rigid mobile overflow, prompt injection, and AI request signature mismatch), and **12 Medium/Low bugs** (orphan UI calendar, missing in-app password change, sub-16px input zoom, CSS cascade regression, and template syntax bugs).

No Flashcard remnants or broken imports exist in source code.

All issues have been cataloged with line numbers, root cause analyses, and concrete step-by-step remediation plans in `audit_frontend_security.md`.

---

## 5. Verification Method

To independently verify these findings:

1. **Execute Pytest Test Suite:**
   ```powershell
   .venv\Scripts\pytest -v
   ```
   Verify 18 tests fail with the exact stack traces documented in Section 4 of `audit_frontend_security.md`.

2. **Verify DOM Element Mismatches:**
   - In `todo/mylist.html`, check lines 181 and 192 (`h3` and `.modal-footer`).
   - In `todo/mylist.js`, check lines 901 and 913 (`#modalOverlay h2` and `.modal-buttons`).

3. **Verify Template String Syntax:**
   - In `schedule/create.js`, inspect line 785 to verify `title="' + svT('sched.removeSubject') + '"`.

4. **Verify Markdown Link Parser Attribute Breakout:**
   - In `career/chat.js`, inspect lines 28-30 and test `svRenderMarkdown('[Click](http://example.com/test&quot;onclick=&quot;alert(1))')`.

5. **Verify Mobile Media Query Order:**
   - In `todo/mylist.css`, verify line 624 (`max-width: 600px`) precedes line 675 (`max-width: 768px`).
