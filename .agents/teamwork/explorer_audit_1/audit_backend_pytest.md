# BÁO CÁO KIỂM TRA TOÀN DIỆN BACKEND VÀ BỘ KIỂM THỬ PYTEST (STUDYVERSE CODEBASE AUDIT)

**Ngày thực hiện**: 2026-11-03  
**Người thực hiện**: `teamwork_explorer_audit_1` (Teamwork Explorer Auditor)  
**Môi trường thực thi**: Windows Server / Windows 11, Python 3.11.9, pytest 9.2.0, PowerShell  
**Trạng thái mã nguồn**: Giữ nguyên vẹn 100% (Read-only Audit — không chỉnh sửa mã nguồn ứng dụng).

---

## MỤC LỤC
1. [TỔNG QUAN VÀ PHẠM VI KIỂM TRA](#1-tổng-quan-và-phạm-vi-kiểm-tra)
2. [KẾT QUẢ THỰC THI BỘ KIỂM THỬ PYTEST](#2-kết-quả-thực-thi-bộ-kiểm-thử-pytest)
3. [CHI TIẾT 18 TRƯỜNG HỢP KIỂM THỬ THẤT BẠI (TEST FAILURES)](#3-chi-tiết-18-trường-hợp-kiểm-thử-thất-bại-test-failures)
   - [3.1. Nhóm kiểm thử Backend & AI (`tests/test_app.py`) — 6 failures](#31-nhóm-kiểm-thử-backend--ai-teststest_apppy--6-failures)
   - [3.2. Nhóm kiểm thử Mailer & Cấu hình (`tests/test_mailer.py`) — 1 failure](#32-nhóm-kiểm-thử-mailer--cấu-hình-teststest_mailerpy--1-failure)
   - [3.3. Nhóm kiểm thử Mobile Viewport & CSS (`tests/test_mobile_viewport.py`) — 11 failures](#33-nhóm-kiểm-thử-mobile-viewport--css-teststest_mobile_viewportpy--11-failures)
4. [RÀ SOÁT KIẾN TRÚC VÀ MÃ NGUỒN BACKEND](#4-rà-soát-kiến-trúc-và-mã-nguồn-backend)
   - [4.1. Kiến trúc Backend & Dịch vụ tĩnh](#41-kiến-trúc-backend--dịch-vụ-tĩnh)
   - [4.2. Cơ chế Xác thực & Quản lý Phiên (Authentication & Session)](#42-cơ-chế-xác-thực--quản-lý-phiên-authentication--session)
   - [4.3. Luồng Gửi Email & Tạo Liên kết Xác thực (Resend & Supabase Admin)](#43-luồng-gửi-email--tạo-liên-kết-xác-thực-resend--supabase-admin)
   - [4.4. Kiểm tra Đồng bộ Dữ liệu (/api/sync & Cloud Persistence)](#44-kiểm-tra-đồng-bộ-dữ-liệu-apisync--cloud-persistence)
5. [DANH MỤC LỖI, LỖ HỔNG BẢO MẬT VÀ NGOẠI LỆ CHƯA XỬ LÝ](#5-danh-mục-lỗi-lỗ-hổng-bảo-mật-và-ngoại-lệ-chưa-xử-lý)
   - [Lỗ hổng 1 (CRITICAL): Lộ SUPABASE_KEY (Service Role Secret) qua `/api/public-config`](#lỗ-hổng-1-critical-lộ-supabase_key-service-role-secret-qua-apipublic-config)
   - [Lỗ hổng 2 (CRITICAL): Open Email Relay / Spam Proxy tại `/api/send-email`](#lỗ-hổng-2-critical-open-email-relay--spam-proxy-tại-apisend-email)
   - [Lỗi 3 (HIGH): Gửi email kích hoạt rỗng khi tạo link Supabase thất bại](#lỗi-3-high-gửi-email-kích-hoạt-rỗng-khi-tạo-link-supabase-thất-bại)
   - [Lỗ hổng 4 (HIGH): Chèn mã HTML/Phishing vào email nhắc việc `/api/notify/reminder`](#lỗ-hổng-4-high-chèn-mã-htmlphishing-vào-email-nhắc-việc-apinotifyreminder)
   - [Lỗ hổng 5 (MEDIUM): Dò quét danh sách email người dùng (User Enumeration)](#lỗ-hổng-5-medium-dò-quét-danh-sách-email-người-dùng-user-enumeration)
   - [Lỗi 6 (MEDIUM): Logic nhận diện Placeholder 'XXX' loại bỏ nhầm API Key hợp lệ](#lỗi-6-medium-logic-nhận-diện-placeholder-xxx-loại-bỏ-nhầm-api-key-hợp-lệ)
   - [Lỗi 7 (MEDIUM): Test suite phụ thuộc Node.js và thiếu Mock Environment](#lỗi-7-medium-test-suite-phụ-thuộc-nodejs-và-thiếu-mock-environment)
   - [Lỗi 8 (LOW): Model Vision của Groq đã bị đóng (Deprecated)](#lỗi-8-low-model-vision-của-groq-đã-bị-đóng-deprecated)
6. [LỘ TRÌNH KHẮC PHỤC KHUYẾN NGHỊ (ACTIONABLE REMEDIATION ROADMAP)](#6-lộ-trình-khắc-phục-khuyến-nghị-actionable-remediation-roadmap)

---

## 1. TỔNG QUAN VÀ PHẠM VI KIỂM TRA

Theo yêu cầu tại `ORIGINAL_REQUEST.md`, đợt kiểm tra toàn diện này tập trung vào:
1. **Kiểm thử tự động**: Khởi chạy toàn bộ test suite pytest trong môi trường ảo `.venv` (Python 3.11.9 / Windows).
2. **Kiểm tra mã nguồn backend**: `app.py`, `mailer.py`, `schedule/schedule_utils.py`, các file cấu hình `.env`, `.env.example`, `pytest.ini`, `conftest.py`.
3. **Kiểm tra logic nghiệp vụ trọng điểm**:
   - Xác thực người dùng (đăng ký, đăng nhập, đặt lại mật khẩu, khôi phục session, chia sẻ quyền).
   - Cơ chế email (gửi qua Resend REST API, SDK, tạo OTP/magic link qua Supabase Admin).
   - Cơ chế đồng bộ dữ liệu (kiểm tra endpoint `/api/sync`, tính toàn vẹn dữ liệu, phân vùng LocalStorage).
   - 10 slot API key cho Gemini & Groq, tính năng AI Career đa phương thức (Multimodal Image), streaming SSE, và trích xuất Action JSON (`studyverse-actions`).
4. **Kiểm tra hồi quy sau khi gỡ bỏ Flashcard**: Xác minh các tham chiếu mồ côi (dead links / orphaned imports) của Flashcard trong backend và router.

---

## 2. KẾT QUẢ THỰC THI BỘ KIỂM THỬ PYTEST

### 2.1. Lệnh thực thi chính xác
Trong PowerShell (Windows):
```powershell
& .\.venv\Scripts\pytest.exe -v
```

### 2.2. Bảng tổng hợp số lượng kiểm thử

| Thư mục / Tệp kiểm thử | Mục tiêu kiểm thử | Tổng số test | Passed (Đạt) | Failed (Thất bại) | Errors (Lỗi) |
|---|---|:---:|:---:|:---:|:---:|
| `tests/test_app.py` | Routing Flask, AI Career, SSE Stream, Actions, Profiling, Schedule Optimize | 101 | 95 | **6** | 0 |
| `tests/test_mailer.py` | Cấu hình Mailer Resend, Supabase Link, Validation các endpoint email | 6 | 5 | **1** | 0 |
| `tests/test_mobile_viewport.py` | Kiểm tra giao diện Mobile Viewport iPhone 11 Pro, Safe Area, Font >= 16px | 65 | 54 | **11** | 0 |
| `tests/test_schedule_utils.py` | Giải thuật tối ưu hóa thời khóa biểu, xử lý giờ nghỉ, tránh ngày | 8 | 8 | 0 | 0 |
| **TỔNG CỘNG TOÀN HỆ THỐNG** | **Toàn bộ Test Suite Studyverse** | **180** | **162** | **18** | **0** |

- **Thời gian chạy**: 1.83 giây.
- **Tỉ lệ đạt**: 90.0% (162/180).
- **Tỉ lệ thất bại**: 10.0% (18/180).
- **Cảnh báo (Warnings)**: Không có cảnh báo nghiêm trọng (0 warning).

---

## 3. CHI TIẾT 18 TRƯỜNG HỢP KIỂM THỬ THẤT BẠI (TEST FAILURES)

### 3.1. Nhóm kiểm thử Backend & AI (`tests/test_app.py`) — 6 failures

Tất cả 5 lỗi đầu tiên trong `tests/test_app.py` bắt nguồn từ cùng một **nguyên nhân gốc (Root Cause)**: Khi backend `app.py` được nâng cấp hỗ trợ AI Career đa phương thức (Vision/Image), hàm `request_ai` được bổ sung tham số `has_image=has_image` (mặc định `False`). Tuy nhiên, các hàm mock giả lập trong `tests/test_app.py` được viết trước đó với chữ ký cứng nhắc `def fake_xxx(messages, max_tokens, provider=None, on_delta=None):` và không nhận `**kwargs` hoặc `has_image`, dẫn đến ngoại lệ `TypeError: got an unexpected keyword argument 'has_image'`. Lỗi thứ 6 là do thiếu Node.js trên môi trường Windows.

#### Test 1: `test_ai_endpoints_use_full_token_budget`
- **Vị trí**: `tests/test_app.py:151`
- **Mã lỗi / Traceback**:
  ```text
  AssertionError: assert 500 == 200
  ERROR app:app.py:640 Invalid career AI request
  Traceback (most recent call last):
    File "app.py", line 635, in career_chat
      ai_reply, error = request_ai(messages, AI_MAX_TOKENS, provider=provider, has_image=has_image)
  TypeError: test_ai_endpoints_use_full_token_budget.<locals>.fake_request_ai() got an unexpected keyword argument 'has_image'
  ```
- **Nguyên nhân**: `career_chat` tại `app.py:635` luôn truyền `has_image=has_image`. Trong test, mock `fake_request_ai` (dòng 142) không khai báo tham số này.
- **Biện pháp khắc phục**: Cập nhật hàm mock trong test: `def fake_request_ai(messages, max_tokens, provider=None, on_delta=None, **kwargs):` hoặc trong `app.py:635` chỉ truyền `has_image` khi nó mang giá trị `True`.

#### Test 2: `test_career_stream_success`
- **Vị trí**: `tests/test_app.py:170`
- **Mã lỗi / Traceback**:
  ```text
  AssertionError: assert '"delta": "Xin "' in body
  ERROR app:app.py:862 career stream worker failed
  Traceback (most recent call last):
    File "app.py", line 859, in worker
      reply, err = request_ai(messages, AI_MAX_TOKENS, provider=provider, on_delta=on_delta, has_image=has_image)
  TypeError: test_career_stream_success.<locals>.fake_stream() got an unexpected keyword argument 'has_image'
  ```
- **Nguyên nhân**: `career_chat_stream` tại `app.py:859` gọi `request_ai(..., has_image=has_image)`. Hàm `fake_stream` tại `tests/test_app.py:159` thiếu `has_image`.
- **Biện pháp khắc phục**: Sửa chữ ký mock `fake_stream(messages, max_tokens, provider=None, on_delta=None, **kwargs):`.

#### Test 3: `test_career_stream_error_is_reported`
- **Vị trí**: `tests/test_app.py:182`
- **Mã lỗi / Traceback**:
  ```text
  AssertionError: assert 'no_balance' in body
  ERROR app:app.py:862 career stream worker failed
  TypeError: test_career_stream_error_is_reported.<locals>.fake_error() got an unexpected keyword argument 'has_image'
  ```
- **Nguyên nhân**: Hàm mock `fake_error` tại `tests/test_app.py:176` thiếu `has_image` hoặc `**kwargs`.
- **Biện pháp khắc phục**: Sửa chữ ký `fake_error(messages, max_tokens, provider=None, on_delta=None, **kwargs):`.

#### Test 4: `test_career_prompt_documents_action_block`
- **Vị trí**: `tests/test_app.py:510`
- **Mã lỗi / Traceback**:
  ```text
  KeyError: 'system'
  File "tests/test_app.py", line 511, in test_career_prompt_documents_action_block
    assert 'studyverse-actions' in captured['system']
  ```
- **Nguyên nhân**: `fake_request_ai` tại dòng 505 không nhận `has_image`, làm request `POST /api/career-ai` văng 500 trước khi kịp gán `captured['system'] = messages[0]['content']`.
- **Biện pháp khắc phục**: Sửa `fake_request_ai` tại dòng 505 thêm `**kwargs`.

#### Test 5: `test_career_ai_accepts_user_profile_payload`
- **Vị trí**: `tests/test_app.py:1114`
- **Mã lỗi / Traceback**:
  ```text
  AssertionError: assert 500 == 200
  TypeError: test_career_ai_accepts_user_profile_payload.<locals>.mock_request_ai() got an unexpected keyword argument 'has_image'
  ```
- **Nguyên nhân**: `mock_request_ai` tại `tests/test_app.py:1096` thiếu `has_image` hoặc `**kwargs`.
- **Biện pháp khắc phục**: Thêm `**kwargs` vào `mock_request_ai`.

#### Test 6: `test_shared_js_streak_and_helpers_execution`
- **Vị trí**: `tests/test_app.py:1243`
- **Mã lỗi / Traceback**:
  ```text
  FileNotFoundError: [WinError 2] The system cannot find the file specified
  File "C:\Program Files\Python311\Lib\subprocess.py", line 1538, in _winapi.CreateProcess
  File "tests/test_app.py", line 1243, in test_shared_js_streak_and_helpers_execution
    result = subprocess.run(['node', '-e', js_code], capture_output=True, text=True)
  ```
- **Nguyên nhân**: Test gọi nhị phân `node` qua `subprocess.run` nhưng máy trạm chạy test chưa cài đặt Node.js trên PATH. Kiểm thử thiếu điều kiện kiểm tra công cụ ngoại vi.
- **Biện pháp khắc phục**: Bổ sung decorator pytest:
  ```python
  import shutil
  @pytest.mark.skipif(not shutil.which('node'), reason="Cần cài đặt Node.js để chạy test JavaScript eval")
  def test_shared_js_streak_and_helpers_execution(): ...
  ```

---

### 3.2. Nhóm kiểm thử Mailer & Cấu hình (`tests/test_mailer.py`) — 1 failure

#### Test 7: `test_mailer_config`
- **Vị trí**: `tests/test_mailer.py:16`
- **Mã lỗi / Traceback**:
  ```text
  AssertionError: assert False
   where False = ''.startswith('re_')
   where '' = mailer.get_resend_api_key()
  ```
- **Nguyên nhân**: Kiểm thử unit test phụ thuộc vào biến môi trường `RESEND_API_KEY` có sẵn trong `.env`. Trong môi trường CI/CD hoặc môi trường dev mặc định chưa cấu hình khóa Resend thật, `get_resend_api_key()` trả về chuỗi rỗng `""`. Test không thiết lập mock hoặc fixture cho biến môi trường.
- **Biện pháp khắc phục**: Sử dụng fixture `monkeypatch` để thiết lập biến giả định cho test:
  ```python
  def test_mailer_config(monkeypatch):
      monkeypatch.setenv('RESEND_API_KEY', 're_test_dummy_key_12345')
      assert mailer.get_resend_api_key().startswith('re_')
  ```

---

### 3.3. Nhóm kiểm thử Mobile Viewport & CSS (`tests/test_mobile_viewport.py`) — 11 failures

11 trường hợp thất bại này phản ánh **đúng thực trạng lỗi giao diện di động** (Genuine Red Baseline) theo đặc tả `TEST_READY.md`. Chúng chỉ ra các vấn đề về iOS Safari Form Auto-Zoom (khi font-size < 16px) và vỡ bố cục trên màn hình hẹp 375px:

| # | Tên Test Case | Tệp & Dòng vi phạm | Giá trị thực tế | Yêu cầu chuẩn | Hậu quả người dùng |
|---|---|---|:---:|:---:|---|
| 8 | `test_tier4_input_font_size_shared_modal` | `shared.css:461` (`.sv-modal-input`) | `0.92rem` (~14.7px) | `>= 16px` hoặc `>= 1rem` | iOS Safari tự động phóng to màn hình (auto-zoom) khi chạm vào ô input modal. |
| 9 | `test_tier4_input_font_size_shared_mobile_base` | `shared.css:479` (`@media (max-width: 768px)`) | Thiếu rule base cho `input, select, textarea` | Phải có rule base `>= 16px` | Các phần tử form chung trên mobile bị zoom lệch layout. |
| 10 | `test_tier4_input_font_size_account_inputs` | `account.css:490` (`.account-input-wrap input`) | `12px` | `>= 16px` | Trang Account bị zoom cận cảnh khi gõ tài khoản/mật khẩu trên iPhone. |
| 11 | `test_tier4_input_font_size_account_selects` | `account.css:500` (`.account-select-wrap select`) | `11px` | `>= 16px` | Dropdown chọn ngôn ngữ/cách xưng hô trên iPhone bị phóng đại. |
| 12 | `test_tier4_input_font_size_schedule_tc_input` | `schedule/create.css:511` (`.tc-input`) | `0.85rem` (~13.6px) | `>= 16px` | Ô nhập môn học/tiết học trong trang Lịch bị nhảy zoom. |
| 13 | `test_tier4_input_font_size_todo_search_input` | `todo/mylist.css:533` (`.todo-search-wrap input`) | `12px` | `>= 16px` | Ô tìm kiếm Todo bị auto-zoom trên thiết bị di động. |
| 14 | `test_tier4_input_font_size_todo_task_inputs` | `todo/mylist.css:545` (`.todo-filter-row select`) | `12px` | `>= 16px` | Dropdown lọc công việc Todo bị zoom. |
| 15 | `test_tier4_no_sub16px_inline_font_sizes_in_mylist_js` | `todo/mylist.js:562` | Inline `font-size: 14px` | Không được chèn inline `< 16px` | Inline style trong JS đè lên CSS media query, gây zoom. |
| 16 | `test_tier5_hero_title_no_rigid_nowrap_on_mobile` | `style.css:605` (`.hero-title`) | `white-space: nowrap !important;` (768px) | Cho phép xuống dòng `normal` / `wrap` | Tiêu đề trang chủ tràn ngang ra khỏi màn hình 375px. |
| 17 | `test_tier5_schedule_container_no_rigid_min_width_overflow` | `schedule/create.css:655` (`.timetable`) | `min-width: 700px` (768px) & `600px` (640px) | `min-width: 100%` hoặc max `375px` | Bảng thời khóa biểu bị cố định 700px, ép màn hình xuất hiện thanh cuộn ngang vỡ khung. |
| 18 | `test_tier5_todo_media_query_cascade_order` | `todo/mylist.css:681` | `@media (max-width: 600px)` đứng TRƯỚC `768px` | `max-width: 768px` phải đứng trước `600px` | Theo nguyên tắc CSS Cascade, rule 768px ghi đè làm mất hiệu lực rule 600px trên mobile hẹp. |

---

## 4. RÀ SOÁT KIẾN TRÚC VÀ MÃ NGUỒN BACKEND

### 4.1. Kiến trúc Backend & Dịch vụ tĩnh
- Studyverse backend là một ứng dụng Python Flask (`app.py`), phục vụ theo kiến trúc **Stateless Micro-Backend**:
  - Đóng vai trò Backend-for-Frontend (BFF) kết nối với các mô hình ngôn ngữ lớn (LLM): Gemini (Google AI Studio) và Groq Cloud qua OpenAI SDK tương thích.
  - Hỗ trợ cơ chế dự phòng nhiều tầng (Failover Chain) với 10 slot key cho Gemini và 10 slot key cho Groq (`_PROVIDER_KEY_COUNT = 10`), tích hợp Circuit Breaker (`_mark_provider_down`, cooldown 60s/120s).
  - Phục vụ file tĩnh có danh sách trắng (`PUBLIC_FILES` tại `app.py:302-309`), đã gỡ bỏ hoàn toàn mọi file liên quan đến Flashcard.
  - Cung cấp API SSE Streaming `/api/career-ai-stream` với nhịp tim ping (`: ping\n\n`) giữ kết nối proxy không bị ngắt quãng.

### 4.2. Cơ chế Xác thực & Quản lý Phiên (Authentication & Session)
- **Supabase Client-Side Auth**: Hệ thống không lưu trữ mật khẩu, không băm muối (hash/salt) cục bộ trong Flask. Toàn bộ logic đăng nhập, đăng ký, refresh token JWT được ủy nhiệm cho Supabase Auth (`@supabase/supabase-js` v2).
- **Phân vùng dữ liệu LocalStorage theo User**:
  - Hàm `svScopedKey(baseKey)` trong `shared.js` chuyển key lưu trữ thành `${baseKey}::${userId}` khi người dùng đăng nhập.
  - Hàm `svMigrateGuestData(userId)` di chuyển dữ liệu tạo lúc chưa đăng nhập (khách) vào tài khoản mới.
- **Điểm yếu phát hiện**: Backend cung cấp endpoint `GET /api/public-config` để frontend lấy `supabaseUrl` và `supabasePublishableKey`. Endpoint này có lỗi rò rỉ khóa bí mật nghiêm trọng (xem phần 5.1).

### 4.3. Luồng Gửi Email & Tạo Liên kết Xác thực (Resend & Supabase Admin)
- Module `mailer.py` đảm nhiệm 3 luồng:
  1. `send_signup_verification_email`: Gọi Supabase Admin API `/auth/v1/admin/generate_link` với `link_type='signup'` để sinh `action_link` và `email_otp`, sau đó dựng email HTML Studyverse gửi qua Resend.
  2. `send_password_reset_email`: Gọi `/auth/v1/admin/generate_link` với `link_type='recovery'`, sinh link đổi mật khẩu (hạn 60 phút) và gửi qua Resend.
  3. `send_reminder_email`: Gửi thông báo Todo Deadline, Chuỗi Streak hoặc tin nhắn chung.
- Cơ chế gửi kép: Ưu tiên dùng SDK `resend.Emails.send`, nếu SDK lỗi hoặc chưa cài đặt thư viện thì tự động chuyển sang gọi REST API `https://api.resend.com/emails` qua `urllib.request` (zero-dependency).

### 4.4. Kiểm tra Đồng bộ Dữ liệu (/api/sync & Cloud Persistence)
- **Thực trạng**: Hệ thống **KHÔNG CÓ** endpoint `/api/sync`, không có database nội bộ trong Flask (không có SQLAlchemy, PostgreSQL direct connection, hay migration script).
- **Lưu trữ dữ liệu**: 100% dữ liệu dự án (`studyverse_projects`), công việc, thời khóa biểu (`studyverse_schedule_dashboard_data`), chuỗi streak và lịch sử chat lưu trực tiếp trên trình duyệt của người dùng (`localStorage`).
- **Khả năng đồng bộ đám mây hiện tại**: Chỉ đồng bộ được thông tin hồ sơ cá nhân (`displayName`, `interests`, `dailyGoal`, `aiCalling`, `aiStyle`) qua metadata tài khoản Supabase (`client.auth.updateUser({ data: ... })`).
- **Đánh giá về Tính toàn vẹn giao dịch & Rollback**:
  - Không có database backend nên không có transaction DB hay ACID rollback ở tầng server.
  - Mọi thao tác cập nhật từ AI Actions (`svApplyTodoActions`, `svApplyScheduleActions`) được thực hiện trên client-side in-memory object trước khi `localStorage.setItem`. Nếu xảy ra lỗi giữa chừng, không có cơ chế snapshot/rollback khôi phục trạng thái LocalStorage trước đó.

---

## 5. DANH MỤC LỖI, LỖ HỔNG BẢO MẬT VÀ NGOẠI LỆ CHƯA XỬ LÝ

### Lỗ hổng 1 (CRITICAL): Lộ SUPABASE_KEY (Service Role Secret) qua `/api/public-config`
- **Tệp & Dòng**: `app.py:484-494` và `mailer.py:32-35`
- **Mức độ nghiêm trọng**: **CRITICAL (Khẩn cấp)**
- **Mô tả chi tiết**:
  Trong `app.py`:
  ```python
  @app.route('/api/public-config', methods=['GET'])
  def public_config():
      return jsonify({
          'supabaseUrl': (os.environ.get('SUPABASE_URL') or '').strip(),
          'supabasePublishableKey': (
              os.environ.get('SUPABASE_PUBLISHABLE_KEY')
              or os.environ.get('SUPABASE_KEY')
              or ''
          ).strip(),
      })
  ```
  Trong khi đó, `mailer.py` dòng 34 lại viết:
  ```python
  def get_supabase_credentials() -> Tuple[str, str]:
      url = (os.environ.get('SUPABASE_URL') or '').strip().rstrip('/')
      key = (os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_SECRET_KEY') or '').strip()
      return url, key
  ```
  Và tại `mailer.py:124`, `sb_key` được dùng để gọi `/auth/v1/admin/generate_link` — endpoint này của Supabase **BẮT BUỘC** phải dùng Secret Role Key (Admin Key) mới được phép gọi!
- **Hậu quả**: Nếu người quản trị cấu hình khóa Admin của Supabase vào biến môi trường `SUPABASE_KEY`, thì bất kỳ người dùng nào trên Internet truy cập `GET /api/public-config` cũng sẽ nhận được toàn bộ khóa Admin bí mật này. Kẻ tấn công có thể dùng khóa này để vượt qua Row Level Security (RLS), đọc, tải về, chỉnh sửa hoặc xóa toàn bộ cơ sở dữ liệu người dùng của dự án.
- **Phương án khắc phục cụ thể**:
  1. Trong `app.py:491`, tuyệt đối **KHÔNG** fallback về `SUPABASE_KEY`. Chỉ chấp nhận `SUPABASE_PUBLISHABLE_KEY` hoặc `SUPABASE_ANON_KEY`.
  2. Trong `mailer.py:34`, chỉ đọc các biến dành riêng cho backend: `os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('SUPABASE_SECRET_KEY')`. Tách biệt hoàn toàn biến môi trường public và secret.

---

### Lỗ hổng 2 (CRITICAL): Open Email Relay / Spam Proxy tại `/api/send-email`
- **Tệp & Dòng**: `app.py:570-595` (`api_send_email`)
- **Mức độ nghiêm trọng**: **CRITICAL (Khẩn cấp)**
- **Mô tả chi tiết**:
  ```python
  @app.route('/api/send-email', methods=['POST'])
  def api_send_email():
      data, error = get_json_body()
      ...
      to_email = (data.get('to') or '').strip()
      subject = (data.get('subject') or 'Thông báo từ Studyverse').strip()
      html_content = data.get('html') or '<p>Thông báo từ Studyverse</p>'
      ...
      ok, res = mailer.send_email(to=to_email, subject=subject, html=html_content)
  ```
  Endpoint này là một API `POST` công khai hoàn toàn không có:
  - Xác thực người dùng (Session / JWT / API Token).
  - Giới hạn tần suất gọi (Rate Limiting).
  - Kiểm soát người nhận (Whitelist / Domain Restriction).
  - Làm sạch nội dung HTML (HTML Sanitization).
- **Hậu quả**: Bất kỳ ai trên Internet đều có thể gửi request đến endpoint này để phát tán thư rác, thư lừa đảo (phishing), mã độc mạo danh thương hiệu Studyverse (`noreply@studyverse.cloud`). Hậu quả là domain gửi mail bị đưa vào danh sách đen (Blacklist DNS/Spamhaus) và tài khoản Resend bị cạn kiệt hạn ngạch hoặc bị khóa vĩnh viễn.
- **Phương án khắc phục cụ thể**:
  - Gỡ bỏ hoàn toàn route `/api/send-email` nếu không dùng ở client, HOẶC
  - Bắt buộc xác thực JWT Token từ Supabase trong header `Authorization`, kiểm tra `to_email` phải khớp với email của chính user đang đăng nhập, và không cho phép truyền nội dung HTML tùy ý từ phía client.

---

### Lỗi 3 (HIGH): Gửi email kích hoạt rỗng khi tạo link Supabase thất bại
- **Tệp & Dòng**: `mailer.py:254-306` (`send_signup_verification_email`)
- **Mức độ nghiêm trọng**: **HIGH (Nghiêm trọng)**
- **Mô tả chi tiết**:
  ```python
  ok, link_data = generate_supabase_link(email=email, link_type='signup', redirect_to=target_redirect)
  action_link = link_data.get('action_link') if ok else None
  email_otp = link_data.get('email_otp') if ok else None

  btn_html = ""
  if action_link:
      btn_html = f'<div style="text-align: center;"><a href="{action_link}" class="btn">...</a></div>'
  otp_html = ""
  if email_otp:
      otp_html = f'<div>{email_otp}</div>'

  # VẪN TIẾP TỤC GỬI EMAIL DÙ link_data BỊ LỖI!
  return send_email(to=email, subject=..., html=html, ...)
  ```
- **Hậu quả**: Khi backend chưa cấu hình `SUPABASE_SECRET_KEY` hoặc Supabase Admin gặp lỗi mạng, `generate_supabase_link` trả về `ok = False`. Tuy nhiên, hàm không ngắt mà vẫn tiếp tục gửi email. Người dùng nhận được một email chào mừng có nội dung: *"Nhấn vào nút bên dưới để hoàn tất kích hoạt tài khoản:"* nhưng bên dưới **hoàn toàn trống trơn**, không có nút bấm và không có mã OTP! Người dùng không thể kích hoạt tài khoản trong khi server báo thành công (`{"ok": true}`).
- **Phương án khắc phục cụ thể**:
  Bổ sung kiểm tra điều kiện ngay sau khi gọi `generate_supabase_link`:
  ```python
  if not ok or not action_link:
      err_msg = link_data.get('error', 'Không thể tạo liên kết xác nhận tài khoản.')
      logger.error(f"Signup link generation failed for {email}: {err_msg}")
      return False, {'error': f"Lỗi tạo liên kết kích hoạt: {err_msg}"}
  ```

---

### Lỗ hổng 4 (HIGH): Chèn mã HTML/Phishing vào email nhắc việc `/api/notify/reminder`
- **Tệp & Dòng**: `app.py:545-568` và `mailer.py:353-369`
- **Mức độ nghiêm trọng**: **HIGH (Nghiêm trọng)**
- **Mô tả chi tiết**:
  Trong `mailer.py`:
  ```python
  else:
      title = data.get('title') or 'Thông báo học tập'
      body = data.get('message') or data.get('content') or 'Bạn có thông báo mới từ Studyverse.'
      link = data.get('link') or f"{base_url}/index.html"
      btn_text = data.get('buttonText') or 'Mở Studyverse'

      content = f"""
        <h2 style="font-size: 22px; color: #ffffff;">📢 {title}</h2>
        <p>{body}</p>
        <div style="text-align: center;"><a href="{link}" class="btn">{btn_text}</a></div>
      """
  ```
  Các trường `title`, `body`, `link`, `btn_text` được lấy trực tiếp từ JSON gửi lên mà không qua bất kỳ bước escape HTML nào (như `html.escape()`). Endpoint `/api/notify/reminder` cũng không có xác thực người dùng.
- **Hậu quả**: Kẻ tấn công có thể gửi request với `body` chứa mã HTML độc hại, bảng biểu giả mạo, hoặc `link` trỏ đến trang web lừa đảo chiếm đoạt tài khoản. Thư gửi đi xuất phát từ email chính thức của Studyverse nên dễ dàng vượt qua bộ lọc spam của Gmail/Outlook.
- **Phương án khắc phục cụ thể**:
  1. Thêm xác thực người dùng cho `/api/notify/reminder`.
  2. Dùng thư viện chuẩn `html.escape()` cho tất cả các trường dữ liệu text:
     ```python
     import html
     clean_title = html.escape(str(title))
     clean_body = html.escape(str(body))
     clean_btn = html.escape(str(btn_text))
     ```
  3. Kiểm tra tính hợp lệ của URL trong trường `link` (chỉ cho phép đường dẫn tương đối `/...` hoặc tên miền chính thức `studyverse.cloud`).

---

### Lỗ hổng 5 (MEDIUM): Dò quét danh sách email người dùng (User Enumeration)
- **Tệp & Dòng**: `app.py:513-514` và `mailer.py:209-211`
- **Mức độ nghiêm trọng**: **MEDIUM (Trung bình)**
- **Mô tả chi tiết**:
  Khi người dùng gọi `POST /api/auth/forgot-password` với một email chưa từng đăng ký:
  Supabase Admin API trả về lỗi: `User not found`.
  Hàm `send_password_reset_email` trả về: `{'error': 'Lỗi Supabase Admin: User not found'}`.
  Backend `app.py` trả về HTTP 500 kèm đúng thông báo lỗi này ra ngoài response JSON.
- **Hậu quả**: Kẻ tấn công có thể chạy script kiểm tra hàng loạt email để biết chính xác những ai đã đăng ký tài khoản trên hệ thống Studyverse, vi phạm quyền riêng tư của người dùng.
- **Phương án khắc phục cụ thể**:
  Tuân thủ nguyên tắc Generic Response trong bảo mật Authentication:
  Dù email có tồn tại hay không, server luôn trả về HTTP 200:
  ```json
  {"ok": true, "message": "Nếu email hợp lệ, liên kết đặt lại mật khẩu đã được gửi đến hộp thư của bạn."}
  ```

---

### Lỗi 6 (MEDIUM): Logic nhận diện Placeholder 'XXX' loại bỏ nhầm API Key hợp lệ
- **Tệp & Dòng**: `app.py:17-26` (`_looks_like_placeholder`)
- **Mức độ nghiêm trọng**: **MEDIUM (Trung bình)**
- **Mô tả chi tiết**:
  ```python
  _PLACEHOLDER_MARKERS = ('PASTE_', 'YOUR_', 'CHANGE_ME', 'XXX', 'xxxxxxxx', '<', '>')

  def _looks_like_placeholder(value):
      v = (value or '').strip()
      if not v:
          return True
      upper = v.upper()
      return any(marker.upper() in upper for marker in _PLACEHOLDER_MARKERS)
  ```
  Hàm chuyển toàn bộ chuỗi sang chữ hoa `upper = v.upper()` rồi tìm kiếm chuỗi con `'XXX'`.
- **Hậu quả**: Các API key thật sinh ra ngẫu nhiên bởi Google AI Studio hay Groq thường là các chuỗi ký tự base64/hash dài 40–60 ký tự. Về mặt xác suất thống kê, việc một key thật chứa 3 ký tự liên tiếp dạng `xxx`, `Xxx`, hoặc `XXx` là hoàn toàn có thể xảy ra. Khi đó, key hợp lệ này sẽ bị coi là placeholder và bị hàm `_numbered_provider_key()` bỏ qua, dẫn đến việc ứng dụng không nhận diện được key mà không rõ lý do.
- **Phương án khắc phục cụ thể**:
  Không tìm chuỗi con `'XXX'` chung chung trên toàn chuỗi. Thay vào đó, kiểm tra nếu giá trị chỉ chứa toàn chữ X hoặc khớp chính xác các mẫu placeholder thường gặp:
  ```python
  def _looks_like_placeholder(value):
      v = (value or '').strip()
      if not v:
          return True
      upper = v.upper()
      if upper in ('XXX', 'PASTE_HERE', 'YOUR_KEY_HERE', 'CHANGE_ME'):
          return True
      return any(marker in upper for marker in ('PASTE_', 'YOUR_', '<', '>'))
  ```

---

### Lỗi 7 (MEDIUM): Test suite phụ thuộc Node.js và thiếu Mock Environment
- **Tệp & Dòng**: `tests/test_app.py:1243` và `tests/test_mailer.py:16`
- **Mức độ nghiêm trọng**: **MEDIUM (Trung bình)**
- **Mô tả chi tiết**:
  - `tests/test_app.py:1243` cố gắng chạy `subprocess.run(['node', '-e', js_code])` làm gãy toàn bộ test suite trên bất kỳ máy trạm hoặc container nào không cài Node.js.
  - `tests/test_mailer.py:16` `assert mailer.get_resend_api_key().startswith('re_')` đòi hỏi phải có key thật trong `.env`, vi phạm tính độc lập và khép kín của unit test.
- **Phương án khắc phục cụ thể**:
  - Dùng `shutil.which('node')` để bỏ qua test khi thiếu runtime.
  - Dùng fixture `monkeypatch.setenv()` để nạp mock key cho mọi test trong `test_mailer.py`.

---

### Lỗi 8 (LOW): Model Vision của Groq đã bị đóng (Deprecated)
- **Tệp & Dòng**: `app.py:73` và `app.py:385`
- **Mức độ nghiêm trọng**: **LOW (Thấp)**
- **Mô tả chi tiết**:
  Biến mặc định `GROQ_VISION_MODEL` được đặt là `'llama-3.2-11b-vision-preview'`. Model preview này đã bị Groq thông báo ngưng hỗ trợ. Nếu người dùng gửi ảnh trong AI Career và hệ thống chọn Groq, request sẽ thất bại với mã lỗi `model_not_found`.
- **Phương án khắc phục cụ thể**:
  Đổi model mặc định thành các model vision hiện hành của Groq hoặc ưu tiên 100% sang Gemini Vision khi có hình ảnh đính kèm.

---

## 6. LỘ TRÌNH KHẮC PHỤC KHUYẾN NGHỊ (ACTIONABLE REMEDIATION ROADMAP)

Để đưa toàn bộ test suite về **100% GREEN (180/180 Passing)** và loại bỏ triệt để các rủi ro an ninh nghiêm trọng, nhóm phát triển nên thực hiện theo 4 bước sau:

### Giai đoạn 1: Vá các lỗi kiểm thử tự động (Đưa Pytest về Green cho Backend & Mailer)
1. **Sửa các mock function trong `tests/test_app.py`**:
   - Thêm `**kwargs` vào `fake_request_ai` (dòng 142, 505), `fake_stream` (dòng 159), `fake_error` (dòng 176), `mock_request_ai` (dòng 1096).
   - Thêm `@pytest.mark.skipif(not shutil.which('node'), ...)` tại dòng 1243.
2. **Sửa kiểm thử cấu hình trong `tests/test_mailer.py`**:
   - Thêm fixture `monkeypatch.setenv('RESEND_API_KEY', 're_test_key_12345')` vào `test_mailer_config`.
   *(Sau bước này, 100% test của `test_app.py` và `test_mailer.py` sẽ PASS hoàn toàn).*

### Giai đoạn 2: Khắc phục các lỗ hổng bảo mật Backend
1. **Bảo vệ `SUPABASE_KEY`**: Sửa `app.py:491` để không đọc `SUPABASE_KEY` ra public config; đổi tên biến trong `mailer.py` thành `SUPABASE_SERVICE_ROLE_KEY`.
2. **Đóng Open Relay `/api/send-email`**: Xóa bỏ route hoặc thêm kiểm tra session Supabase bắt buộc.
3. **Chống XSS/Phishing Email**: Bổ sung `html.escape()` trong `mailer.py` cho tất cả các trường dữ liệu người dùng.
4. **Xử lý rỗng khi tạo link kích hoạt**: Ngắt sớm và trả về lỗi nếu `generate_supabase_link` không thành công.
5. **Chống User Enumeration**: Chuẩn hóa thông báo thành công chung cho luồng quên mật khẩu.

### Giai đoạn 3: Tối ưu hóa giao diện di động (Khắc phục 11 test viewport)
1. Cập nhật `shared.css`: Đặt base rule `@media (max-width: 768px) { input, select, textarea { font-size: 16px !important; } }`.
2. Cập nhật `account.css`, `schedule/create.css`, `todo/mylist.css`: Đảm bảo các input/select đạt tối thiểu `16px` trên mobile.
3. Cập nhật `style.css`: Bỏ `white-space: nowrap !important;` trên `.hero-title` ở màn hình dưới 768px.
4. Cập nhật `schedule/create.css`: Thay `min-width: 700px` của `.timetable` thành bố cục co giãn responsive phù hợp với 375px.
5. Cập nhật `todo/mylist.css`: Đảo thứ tự media query, đưa `@media (max-width: 768px)` lên trước `@media (max-width: 600px)`.

---
*Báo cáo được hoàn thành bởi teamwork_explorer_audit_1 — Tuân thủ tuyệt đối quy định không sửa đổi mã nguồn ứng dụng.*
