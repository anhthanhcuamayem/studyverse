# HANDOFF REPORT — Backend & Pytest Audit

**Agent**: `teamwork_explorer_audit_1`  
**Milestone**: Backend & Pytest Audit  
**Target Recipient**: Orchestrator (`acf5f9ab-bd8b-4b61-952e-4171dbd6a324`)  
**Date**: 2026-11-03  
**Report Artifact**: `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\explorer_audit_1\audit_backend_pytest.md`  

---

## 1. Observation

1. **Pytest Execution**:
   - Command executed: `& .\.venv\Scripts\pytest.exe -v`
   - Results: Collected **180 test items** across 4 modules.
   - **Passed**: 162
   - **Failed**: 18
   - **Errors**: 0, **Warnings**: 0
   - Execution time: 1.83 seconds.

2. **Detailed Test Failures by Module**:
   - `tests/test_app.py` (6 failures):
     - `test_ai_endpoints_use_full_token_budget` (`tests/test_app.py:151`): `AssertionError: assert 500 == 200` caused by `TypeError: test_ai_endpoints_use_full_token_budget.<locals>.fake_request_ai() got an unexpected keyword argument 'has_image'`.
     - `test_career_stream_success` (`tests/test_app.py:170`): `AssertionError: assert '"delta": "Xin "' in body` caused by `TypeError: test_career_stream_success.<locals>.fake_stream() got an unexpected keyword argument 'has_image'`.
     - `test_career_stream_error_is_reported` (`tests/test_app.py:182`): `AssertionError: assert 'no_balance' in body` caused by `TypeError: test_career_stream_error_is_reported.<locals>.fake_error() got an unexpected keyword argument 'has_image'`.
     - `test_career_prompt_documents_action_block` (`tests/test_app.py:510`): `KeyError: 'system'` caused by HTTP 500 crash during `POST /api/career-ai` due to `TypeError: fake_request_ai() got an unexpected keyword argument 'has_image'`.
     - `test_career_ai_accepts_user_profile_payload` (`tests/test_app.py:1114`): `AssertionError: assert 500 == 200` caused by `TypeError: mock_request_ai() got an unexpected keyword argument 'has_image'`.
     - `test_shared_js_streak_and_helpers_execution` (`tests/test_app.py:1243`): `FileNotFoundError: [WinError 2] The system cannot find the file specified` when invoking `subprocess.run(['node', '-e', js_code])` on a Windows host without Node.js installed.
   - `tests/test_mailer.py` (1 failure):
     - `test_mailer_config` (`tests/test_mailer.py:16`): `AssertionError: assert False` where `mailer.get_resend_api_key().startswith('re_')` returns `False` because `RESEND_API_KEY` is empty in local dev environment and test lacks monkeypatch/fixture.
   - `tests/test_mobile_viewport.py` (11 failures):
     - `test_tier4_input_font_size_shared_modal` (`tests/test_mobile_viewport.py:461`): `.sv-modal-input` font-size is `0.92rem` (14.72px < 16px).
     - `test_tier4_input_font_size_shared_mobile_base` (`tests/test_mobile_viewport.py:479`): missing mobile media query rule in `shared.css` enforcing `input, select, textarea >= 16px`.
     - `test_tier4_input_font_size_account_inputs` (`tests/test_mobile_viewport.py:490`): `account.css` `.account-input-wrap input` is `12px` < 16px.
     - `test_tier4_input_font_size_account_selects` (`tests/test_mobile_viewport.py:500`): `account.css` `.account-select-wrap select` is `11px` < 16px.
     - `test_tier4_input_font_size_schedule_tc_input` (`tests/test_mobile_viewport.py:511`): `schedule/create.css` `.tc-input` is `0.85rem` < 16px.
     - `test_tier4_input_font_size_todo_search_input` (`tests/test_mobile_viewport.py:533`): `todo/mylist.css` `.todo-search-wrap input` is `12px` < 16px.
     - `test_tier4_input_font_size_todo_task_inputs` (`tests/test_mobile_viewport.py:545`): `todo/mylist.css` selects are `12px` < 16px.
     - `test_tier4_no_sub16px_inline_font_sizes_in_mylist_js` (`tests/test_mobile_viewport.py:562`): `todo/mylist.js` contains inline `font-size: 14px`.
     - `test_tier5_hero_title_no_rigid_nowrap_on_mobile` (`tests/test_mobile_viewport.py:605`): `style.css` enforces `white-space: nowrap !important;` under `@media (max-width: 768px)`.
     - `test_tier5_schedule_container_no_rigid_min_width_overflow` (`tests/test_mobile_viewport.py:655`): `schedule/create.css` `.timetable` has `min-width: 700px` (768px query) and `min-width: 600px` (640px query).
     - `test_tier5_todo_media_query_cascade_order` (`tests/test_mobile_viewport.py:681`): `todo/mylist.css` declares `max-width: 600px` before `max-width: 768px` in cascade order.
   - `tests/test_schedule_utils.py` (0 failures): All 8 tests passed.

3. **Backend & Security Inspection Observations**:
   - `app.py:484-494` (`/api/public-config`): Exposes `os.environ.get('SUPABASE_PUBLISHABLE_KEY') or os.environ.get('SUPABASE_KEY')`. At the same time, `mailer.py:34` uses `SUPABASE_KEY` as the bearer token to call Supabase Admin endpoint `/auth/v1/admin/generate_link` (which requires service_role admin privileges). If a developer sets `SUPABASE_KEY` to the service_role secret key, it is leaked publicly to anyone querying `/api/public-config`.
   - `app.py:570-595` (`/api/send-email`): Completely unauthenticated POST endpoint allowing arbitrary recipients (`to`), arbitrary subject, and arbitrary HTML body, sent directly from `Studyverse <noreply@studyverse.cloud>` via Resend.
   - `mailer.py:254-306` (`send_signup_verification_email`): If `generate_supabase_link` fails (`ok=False`), `action_link` is `None` and `email_otp` is `None`. The function fails to return an error, proceeds to render an email with empty button and empty OTP, and dispatches it via `send_email`, returning success.
   - `app.py:545-568` (`/api/notify/reminder`) & `mailer.py:353-369`: User-controlled strings (`title`, `body`, `link`, `btn_text`) are concatenated directly into HTML without HTML escaping.
   - `app.py:498-516` (`/api/auth/forgot-password`): If user email does not exist, Supabase Admin returns "User not found" and backend returns HTTP 500 with that exact message, allowing user enumeration.
   - `app.py:17-26` (`_looks_like_placeholder`): Case-insensitively checks if substring `'XXX'` is inside the key string (`marker.upper() in upper`), causing any randomly generated valid key containing `xxx` to be rejected as a placeholder.
   - Data sync status: There is no `/api/sync` endpoint, no server-side database models, and no server-side transaction management. Data is stored solely in client-side LocalStorage.
   - Flashcard regression status: Verified `app.py` has zero references to flashcards; `PUBLIC_FILES` and `ROUTE_ALIASES` are clean.

---

## 2. Logic Chain

1. **Step 1 (Pytest Mock Signature Mismatch)**:
   - Observation 2 shows 5 tests failed with `TypeError: ... unexpected keyword argument 'has_image'`.
   - Tracing `app.py:635` and `app.py:859`, `career_chat` and `career_chat_stream` pass `has_image=has_image` into `request_ai()`.
   - In `tests/test_app.py`, the test mocks at lines 142, 159, 176, 505, and 1096 defined explicit arguments without `has_image` or `**kwargs`.
   - Therefore, the failures in `test_app.py` are caused by outdated mock signatures in the test file following the multimodal vision upgrade in `app.py`.

2. **Step 2 (Portability Defect in Test Suite)**:
   - Observation 2 shows `test_shared_js_streak_and_helpers_execution` failed with `FileNotFoundError` executing `node`.
   - Node.js is not guaranteed on all Python virtual environments or CI hosts. The test does not guard with `shutil.which('node')`.
   - Therefore, this is an environmental portability bug in the test file.

3. **Step 3 (Test Environment Flaw in Mailer Test)**:
   - Observation 2 shows `test_mailer_config` failed asserting `get_resend_api_key().startswith('re_')`.
   - `mailer.py:24` reads `os.environ.get('RESEND_API_KEY')`.
   - In local dev or CI, secrets should not be hardcoded in `.env`. The test did not mock the environment variable via pytest's `monkeypatch`.
   - Therefore, this test failure is due to missing test isolation.

4. **Step 4 (Mobile Viewport CSS Baseline)**:
   - Observation 2 shows 11 failures in `tests/test_mobile_viewport.py` regarding font sizes (<16px) and responsive overflow (>375px).
   - This matches the documented "Genuine Red Baseline" declared in `TEST_READY.md`. These represent authentic UI/CSS defects on mobile devices (iOS Safari form zoom and layout overflow).

5. **Step 5 (Critical Security Flaws)**:
   - Observation 3 shows `app.py:491` falling back to `SUPABASE_KEY` for public exposure while `mailer.py:34` uses `SUPABASE_KEY` for admin API access.
   - Therefore, setting `SUPABASE_KEY` to the service_role key directly exposes full admin access to the public.
   - Observation 3 shows `/api/send-email` allows unauthenticated dispatch of arbitrary HTML to arbitrary recipients.
   - Therefore, the backend currently operates as an open email relay and phishing vector.

---

## 3. Caveats

1. **Application Source Code Not Modified**: As strictly instructed by `MISSION`, zero changes were made to any application source files or stylesheets. All findings are documented in the audit report.
2. **Third-Party External Services**: Supabase Admin API and Resend SMTP credentials were not probed with live external network calls to avoid consuming quotas or altering remote state; inspection was based on static code paths, local execution, and test simulations.
3. **No Server-Side Database Found**: No database models or migrations exist in the workspace; persistent storage is exclusively client-side LocalStorage.

---

## 4. Conclusion

1. **Overall Test Status**: 162/180 passed (90%). The 18 failures break down cleanly:
   - 5 failures in `tests/test_app.py` are test mock signature mismatches (`has_image`).
   - 1 failure in `tests/test_app.py` is missing `node` executable guard.
   - 1 failure in `tests/test_mailer.py` is missing `monkeypatch` for `RESEND_API_KEY`.
   - 11 failures in `tests/test_mobile_viewport.py` are legitimate mobile viewport CSS defects.
2. **Backend Security Posture**: Identified 2 CRITICAL vulnerabilities (Public exposure of Supabase admin secret key, Open email relay), 2 HIGH issues (Blank activation email dispatch, Unsanitized HTML injection in reminder emails), and 3 MEDIUM issues (User enumeration, Key placeholder regex false positive, Test isolation).
3. **Architecture & Sync**: The system is completely stateless. No `/api/sync` exists; data resides in LocalStorage with client-side user key scoping.
4. **Remediation Report**: Full detailed findings, root causes, and step-by-step code remediations have been compiled into `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\explorer_audit_1\audit_backend_pytest.md`.

---

## 5. Verification Method

To independently reproduce and verify this audit:

1. **Execute full test suite**:
   ```powershell
   & .\.venv\Scripts\pytest.exe -v
   ```
   *Expected outcome*: 180 collected, 162 passed, 18 failed in ~1.8 seconds.

2. **Verify individual test modules**:
   - Backend tests:
     ```powershell
     & .\.venv\Scripts\pytest.exe tests/test_app.py -v
     ```
     *Expected outcome*: 95 passed, 6 failed.
   - Mailer tests:
     ```powershell
     & .\.venv\Scripts\pytest.exe tests/test_mailer.py -v
     ```
     *Expected outcome*: 5 passed, 1 failed.
   - Schedule solver tests:
     ```powershell
     & .\.venv\Scripts\pytest.exe tests/test_schedule_utils.py -v
     ```
     *Expected outcome*: 8 passed, 0 failed.
   - Mobile viewport tests:
     ```powershell
     & .\.venv\Scripts\pytest.exe tests/test_mobile_viewport.py -v
     ```
     *Expected outcome*: 54 passed, 11 failed.

3. **Verify Security Code Locations**:
   - Inspect `app.py` lines 484–494 for `SUPABASE_KEY` exposure.
   - Inspect `app.py` lines 570–595 for unauthenticated `/api/send-email`.
   - Inspect `mailer.py` lines 254–306 for empty activation email dispatch.
   - Inspect `mailer.py` lines 353–369 for unescaped user input in email HTML.
