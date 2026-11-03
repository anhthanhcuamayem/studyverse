# BÁO CÁO RÀ SOÁT TOÀN DIỆN CODEBASE STUDYVERSE
**Mã kiểm toán**: AUDIT-RECENT-CHANGES-2026-11-03  
**Tác giả**: Teamwork Explorer Audit 2 (`teamwork_explorer_audit_2`)  
**Thư mục làm việc**: `c:\Users\Administrator\Downloads\studyverse\.agents\teamwork\explorer_audit_2\`  
**Chế độ**: Read-only Investigation (Không sửa đổi mã nguồn ứng dụng)

---

## 1. TỔNG QUAN KẾT QUẢ RÀ SOÁT (EXECUTIVE SUMMARY)

Đợt kiểm toán này rà soát toàn diện các sửa đổi gần đây trong codebase Studyverse trên 3 trọng tâm chính:
1. **Loại bỏ Flashcard** (Backend `app.py`, template HTML, script JS, CSS, route và database sync).
2. **Nâng cấp AI Career 10-slot Gemini / Groq** (Cơ chế xoay vòng key, fallback logic, bounds checking, biến môi trường, phân loại lỗi và rate limiting).
3. **Khôi phục UI trong `todo/mylist.html`** (DOM Element ID mismatches, action handlers thêm/sửa/xóa, CSS class conflicts và responsive layout cho iPhone 11 Pro 375px).

### Kết quả chạy kiểm thử tự động (`pytest` trong `.venv` Python 3.11):
- **Tổng số test**: 180 test items thu thập từ `tests/test_app.py`, `tests/test_mailer.py`, `tests/test_mobile_viewport.py`, `tests/test_schedule_utils.py`.
- **Kết quả**: **162 Passed**, **18 Failed** (Tỉ lệ đạt: 90.0%).
- **Phân loại 18 lỗi thất bại**:
  - **5 lỗi trong `test_app.py`**: Do hồi quy chữ ký hàm `request_ai(..., has_image=...)` khi gọi các hàm mock trong unit test.
  - **1 lỗi trong `test_app.py`**: Do môi trường thực thi thiếu runtime `node` trong PATH khi chạy `test_shared_js_streak_and_helpers_execution`.
  - **1 lỗi trong `test_mailer.py`**: Do test `test_mailer_config` kiểm tra cứng `RESEND_API_KEY` bắt đầu bằng `'re_'` nhưng không monkeypatch biến môi trường trong test fixture.
  - **11 lỗi trong `test_mobile_viewport.py`**: Bao gồm vi phạm thứ tự CSS media query trong `todo/mylist.css`, font-size form controls < 16px gây auto-zoom trên iOS Safari, `white-space: nowrap` trên `.hero-title` và rigid `min-width` > 375px trong `schedule/create.css`.

---

## 2. RÀ SOÁT CHI TIẾT THEO TỪNG VÙNG TRỌNG TÂM

### VÙNG 1: RÀ SOÁT LOẠI BỎ FLASHCARD (FLASHCARD REMOVAL AUDIT)

#### 1.1. Hiện trạng Backend & Định tuyến (`app.py`)
- **Tập tin công khai (`PUBLIC_FILES`, dòng 302-309)**: Hoàn toàn không còn bất kỳ đường dẫn nào chứa `flashcard`, `flashcard.html`, `flashcard.css`, hay `flashcard.js`.
- **Bí danh URL (`ROUTE_ALIASES`, dòng 311-316)**: Chỉ gồm `'account'`, `'career'`, `'schedule'`, `'todo'`. Không còn route alias `/flashcard`.
- **Handler phục vụ file tĩnh (`serve_static`, dòng 597-606)**: Nếu người dùng truy cập `/flashcard` hoặc `/flashcard/flashcard.html`, ứng dụng trả về HTTP 404 Not Found đúng theo thiết kế bảo mật.
- **API Endpoints**: Không còn bất kỳ endpoint `/api/flashcards`, `/api/flashcard/*` hay hàm xử lý parse tài liệu heuristic/AI cho flashcard trong `app.py`.

#### 1.2. Hiện trạng Frontend HTML, Navbars & Sidebars
- Kiểm tra toàn bộ 7 file HTML trong workspace: `index.html`, `account.html`, `career/chat.html`, `schedule/create.html`, `todo/mylist.html`, `admin.html`, `config-preview.html`.
- **Thanh điều hướng (`<nav class="navigation">`)**: Đồng bộ trên tất cả các trang, gồm đúng 4 mục:
  1. `nav.home` (`/` hoặc `/index.html`)
  2. `nav.project` (`/todo` hoặc `/todo/mylist.html`)
  3. `nav.schedule` (`/schedule` hoặc `/schedule/create.html`)
  4. `nav.career` (`/career` hoặc `/career/chat.html`)
- **Liên kết href**: Toàn bộ liên kết trong HTML đều trỏ đến các route hợp lệ, không có bất kỳ liên kết chết (dead link) nào đến `/flashcard`.
- **Feature Cards trang chủ (`index.html`)**: Các thẻ nổi chỉ gồm AI Career, Nhiệm vụ hoàn thành, Thời khóa biểu, Chuỗi tập trung. Không còn thẻ Flashcard.

#### 1.3. Hiện trạng Client-side Storage & Sync (`config.js`, `shared.js`, `auth.js`)
- `config.js` (`window.SV_CONFIG.storage`): Khóa lưu trữ chỉ gồm `lang`, `theme`, `projects`, `schedule`, `lastProject`, `careerChat`, `userProfile`, `streak`.
- `shared.js` (`svMigrateGuestData` dòng 1300): Không còn khóa di trú flashcard.
- `auth.js`: Đồng bộ tài khoản Supabase chỉ đồng bộ hồ sơ người dùng (`displayName`, `dailyGoal`, `interests`, `aiCalling`, `aiStyle`, `aiFocus`, `notifyStreak`, `notifyDeadline`, `soundEnabled`).

#### 1.4. Tồn dư tài liệu kiểm thử cũ (Documentation Residue)
- `tests/test_flashcards.py` đã được xóa bỏ hoàn toàn khỏi bộ test.
- Tuy nhiên, trong hai tệp tài liệu `TEST_INFRA.md` (dòng 44, 85) và `TEST_READY.md` (dòng 30, 40, 41, 48, 49, 52, 64, 73, 95) vẫn còn ghi chép lịch sử về `test_flashcards.py` và đường dẫn `/flashcard`.
- **Đánh giá**: Mức độ Low. Không ảnh hưởng đến runtime hay test suite nhưng cần dọn dẹp để tài liệu phản ánh chính xác trạng thái hiện tại.

---

### VÙNG 2: NÂNG CẤP AI CAREER 10-SLOT GEMINI / GROQ (ROTATION & FAILOVER AUDIT)

#### 2.1. Cấu hình 10 Slot Key & Biến môi trường
- Trong `app.py`:
  - `_PROVIDER_KEY_COUNT = 10` (dòng 54).
  - Vòng lặp khởi tạo `AI_PROVIDERS[f'{family}{number}']` (dòng 93-96) tạo đầy đủ 10 slot cho `gemini1`..`gemini10` và `groq1`..`groq10`.
  - `_PROVIDER_FAMILIES` (dòng 107-110) nhóm đúng 10 slot kèm slot fallback đơn lẻ: `['gemini1', ..., 'gemini10', 'gemini']`.
  - Thứ tự ưu tiên mặc định (`AI_PROVIDER_ORDER`, dòng 123-127) duyệt qua toàn bộ 10 key Gemini trước, sau đó tới 10 key Groq.

#### 2.2. LỖI LOGIC: Thiếu định dạng biến môi trường chuẩn (`GEMINI_API_KEY_1..10`, `GROQ_API_KEY_1..10`)
- **Vị trí**: `app.py`, dòng 57-64:
  ```python
  def _numbered_provider_key(family, number):
      """Read the requested lowercase env name and common uppercase variants."""
      for env_name in (f'{family}{number}', f'{family.upper()}{number}',
                       f'{family.upper()}{number}_API_KEY'):
          value = (os.environ.get(env_name) or '').strip()
          if value and not _looks_like_placeholder(value):
              return value
      return None
  ```
- **Phân tích nguyên nhân gốc**:
  - `_numbered_provider_key` chỉ quét: `gemini1`, `GEMINI1`, `GEMINI1_API_KEY`.
  - Các chuẩn đặt tên biến môi trường phổ biến trong triển khai đám mây (CI/CD, Docker, Kubernetes, Vercel, Supabase) và đặc tả nhiệm vụ yêu cầu: `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, ..., `GEMINI_API_KEY_10` và `GROQ_API_KEY_1`, ..., `GROQ_API_KEY_10`.
  - Do tiền tố số nằm sau dấu gạch dưới (`_API_KEY_1` thay vì `1_API_KEY`), hàm hiện tại **HOÀN TOÀN BỎ QUA** nếu quản trị viên cấu hình `GEMINI_API_KEY_1` hoặc `GROQ_API_KEY_1`.
- **Mức độ nghiêm trọng**: **HIGH**.
- **Đề xuất khắc phục**: Mở rộng tuple `env_name` trong `_numbered_provider_key`:
  ```python
  for env_name in (
      f'{family}{number}',
      f'{family.upper()}{number}',
      f'{family.upper()}{number}_API_KEY',
      f'{family.upper()}_API_KEY_{number}',
      f'{family.upper()}_API_KEY{number}',
      f'{family.upper()}_KEY_{number}',
  ):
  ```

#### 2.3. LỖI LOGIC: Ngắt kết nối Fallback đơn lẻ (`GEMINI_API_KEY` / `GROQ_API_KEY`) khi nhận diện động
- **Vị trí**: `app.py`, dòng 97-105 và dòng 207-216:
  ```python
  def detect_available_providers():
      """Nhận diện các provider đã cấu hình API key, sắp theo thứ tự ưu tiên."""
      for family in ('gemini', 'groq'):
          for number in range(1, _PROVIDER_KEY_COUNT + 1):
              slot_name = f'{family}{number}'
              if slot_name in AI_PROVIDERS and not AI_PROVIDERS[slot_name].get('key'):
                  env_key = _numbered_provider_key(family, number)
                  if env_key:
                      AI_PROVIDERS[slot_name]['key'] = env_key
      return [name for name in AI_PROVIDER_ORDER if (AI_PROVIDERS.get(name, {}).get('key') or '').strip()]
  ```
- **Phân tích nguyên nhân gốc**:
  - Tại dòng 98-105 (thời điểm import module), `AI_PROVIDERS['gemini']['key']` chỉ được gán nếu `not any(_gemini_numbered_keys)`.
  - Khi gọi `detect_available_providers()`, hàm chỉ duyệt vòng lặp `slot_name = f'{family}{number}'` (1..10). Nó **không cập nhật lại** slot đơn lẻ `gemini` và `groq` từ `os.environ.get('GEMINI_API_KEY')` hoặc `os.environ.get('GROQ_API_KEY')`.
  - Nếu key đơn lẻ được inject sau thời điểm import (hoặc qua `monkeypatch.setenv('GEMINI_API_KEY', ...)` trong test suite), `detect_available_providers()` không nhận diện được key này.
- **Mức độ nghiêm trọng**: **MEDIUM**.

#### 2.4. LỖI LOGIC: Client OpenAI bị cache vĩnh viễn (`_get_provider_client`)
- **Vị trí**: `app.py`, dòng 233-241:
  ```python
  def _get_provider_client(provider):
      cfg = AI_PROVIDERS[provider]
      client = cfg.get('_client')
      if client is None:
          client = OpenAI(api_key=cfg['key'].strip(), base_url=cfg['base_url'],
                         timeout=AI_REQUEST_TIMEOUT, max_retries=AI_MAX_RETRIES)
          cfg['_client'] = client
      return client
  ```
- **Phân tích nguyên nhân gốc**:
  - Đối tượng `OpenAI` client được lưu vào `cfg['_client']` và không bao giờ bị xóa hay cập nhật lại nếu `cfg['key']` hoặc cấu hình mạng thay đổi.
  - Khi xoay vòng key hoặc kiểm thử probe, client cũ với key cũ vẫn bị tái sử dụng.
- **Mức độ nghiêm trọng**: **MEDIUM**.

#### 2.5. LỖI LOGIC: Không mở Circuit Breaker khi bị Rate Limit 429 hoặc Hết hạn mức
- **Vị trí**: `app.py`, dòng 165 và dòng 460-463:
  ```python
  _COOLDOWN_ERROR_CODES = ('timeout', 'connection', 'provider_down')
  ...
  code, _ = _classify_provider_error(exc)
  if code in _COOLDOWN_ERROR_CODES:
      _mark_provider_down(name)
  ```
- **Phân tích nguyên nhân gốc**:
  - `_classify_provider_error(exc)` phân loại mã HTTP 429 hoặc `RateLimitError` thành mã `'rate_limit'`.
  - Nhưng tuple `_COOLDOWN_ERROR_CODES` **chỉ chứa** `('timeout', 'connection', 'provider_down')`.
  - Mã `'rate_limit'` và `'no_balance'` **không nằm trong danh sách cooldown**!
  - **Hệ quả nghiêm trọng**: Khi slot `gemini1` bị Google Gemini trả về 429 (Rate Limit / Quota Exceeded), hàm failover sang `gemini2` trong request hiện tại. Nhưng `gemini1` **KHÔNG** bị đánh dấu `_mark_provider_down('gemini1')`.
  - Ở tất cả các request tiếp theo của người dùng, hệ thống **VẪN TIẾP TỤC GỌI `gemini1` ĐẦU TIÊN**, phải chịu lỗi 429 một lần nữa rồi mới failover sang `gemini2`. Điều này làm tăng độ trễ phản hồi lên 1-3 giây cho từng câu hỏi và làm lãng phí request.
- **Mức độ nghiêm trọng**: **HIGH**.
- **Đề xuất khắc phục**: Bổ sung `'rate_limit'` vào `_COOLDOWN_ERROR_CODES` để key bị 429 tạm thời chuyển sang trạng thái cooldown trong `AI_FAILOVER_COOLDOWN` giây (mặc định 60s).

#### 2.6. HỒI QUY TEST: Lỗi TypeError do thêm tham số `has_image` vào `request_ai`
- **Vị trí**: `app.py`, dòng 635 và dòng 859:
  ```python
  # Trong career_chat():
  ai_reply, error = request_ai(messages, AI_MAX_TOKENS, provider=provider, has_image=has_image)
  
  # Trong worker() của career_chat_stream():
  reply, err = request_ai(messages, AI_MAX_TOKENS, provider=provider, on_delta=on_delta, has_image=has_image)
  ```
- **Phân tích nguyên nhân gốc**:
  - Hàm `request_ai` được cập nhật định nghĩa: `def request_ai(messages, max_tokens, provider=None, on_delta=None, has_image=False)`.
  - Nhưng trong `tests/test_app.py`, 5 hàm mock test (`fake_request_ai`, `fake_stream`, `fake_error`, `mock_request_ai`) ở các dòng 142, 159, 176, 505, 1100 chỉ nhận `(messages, max_tokens, provider=None, on_delta=None)` mà không có `**kwargs` hoặc `has_image=False`.
  - Dẫn đến 5 test fail ngay lập tức:
    1. `test_ai_endpoints_use_full_token_budget` (TypeError)
    2. `test_career_stream_success` (TypeError)
    3. `test_career_stream_error_is_reported` (TypeError)
    4. `test_career_prompt_documents_action_block` (KeyError do 500)
    5. `test_career_ai_accepts_user_profile_payload` (TypeError)
- **Mức độ nghiêm trọng**: **HIGH** (Làm gãy 5 test chính trong test suite).
- **Đề xuất khắc phục**:
  - Trong `app.py`: Chỉ truyền `has_image=has_image` khi `has_image` là True, hoặc kiểm tra chữ ký hàm trước khi truyền, hoặc tốt nhất là trong `tests/test_app.py`: khai báo các mock handler chấp nhận `*args, **kwargs`.

---

### VÙNG 3: KHÔI PHỤC UI TRONG `todo/mylist.html` (TODO UI RESTORATION AUDIT)

#### 3.1. LỖI CRITICAL: DOM Selector sai trong tính năng Chỉnh sửa Dự án (`Edit Project`)
- **Vị trí**: `todo/mylist.js`, dòng 901 và dòng 913:
  ```javascript
  893: if (event.target.classList.contains('btn-edit-project')) {
  ...
  901:     const modalTitle = document.querySelector('#modalOverlay h2');
  902:     modalTitle.innerText = "Edit Project";
  ...
  913:     document.querySelector('.modal-buttons').prepend(btnDelete);
  ```
- **Đối chiếu với `todo/mylist.html` (dòng 178-198)**:
  ```html
  <div class="modal-overlay" id="modalOverlay">
      <div class="modal-content">
          <div class="modal-header">
              <h3 data-i18n="todo.newProjectTitle">New Project</h3>
          </div>
          <div class="input-group">...</div>
          <div class="modal-footer">
              <button class="btn-modal btn-cancel" id="btnCancel">Cancel</button>
              <button class="btn-modal btn-confirm" id="btnConfirm">Create</button>
          </div>
      </div>
  </div>
  ```
- **Phân tích nguyên nhân gốc**:
  1. Trong `#modalOverlay`, thẻ tiêu đề là `<h3>`, **hoàn toàn không có thẻ `<h2>`**. Biến `modalTitle` nhận giá trị `null`, dẫn đến lỗi `TypeError: Cannot set properties of null (setting 'innerText')`.
  2. Vùng chứa nút trong modal có class là `.modal-footer`, **hoàn toàn không có class `.modal-buttons`**. Biến `document.querySelector('.modal-buttons')` nhận `null`, dẫn đến lỗi `TypeError: Cannot read properties of null (reading 'prepend')`.
  - **Hệ quả**: Bất kỳ khi nào người dùng kích hoạt hành động `.btn-edit-project`, script ném ngoại lệ chưa bắt được, làm treo toàn bộ luồng xử lý UI tiếp theo.
- **Mức độ nghiêm trọng**: **CRITICAL**.
- **Đề xuất khắc phục**:
  - Đổi selector: `document.querySelector('#modalOverlay .modal-header h3') || document.querySelector('#modalOverlay h3')`.
  - Đổi selector nút: `document.querySelector('#modalOverlay .modal-footer') || document.querySelector('.modal-footer')`.

#### 3.2. LỖI LOGIC & UI: Icon Bút Sửa Tên & Deadline Bị Ẩn và Không Nhận Sự Kiện
- **Vị trí**: `todo/mylist.html` (dòng 71, 76) và `todo/mylist.js` (dòng 700-701, 829, 849):
  ```html
  <!-- todo/mylist.html:71, 76 -->
  <i class="fa-solid fa-pen btn-edit-name" style="cursor: pointer; font-size: 14px; color: rgba(255,255,255,0.3); display: none;"></i>
  <i class="fa-solid fa-pen btn-edit-deadline" style="cursor: pointer; font-size: 13px; color: rgba(255,255,255,0.3); display: none;"></i>
  ```
  ```javascript
  // todo/mylist.js:700-701
  const btnEditName = document.querySelector('.btn-edit-name');
  const btnEditDeadline = document.querySelector('.btn-edit-deadline');
  // (Không có dòng nào đặt display = 'inline-block' hay 'block' cho hai icon này)

  // todo/mylist.js:829, 849
  if (event.target.id === 'mainProjectName' && mainTitle.hasAttribute('data-old-name')) { ... }
  if (event.target.id === 'mainProjectDeadline' && mainTitle.hasAttribute('data-old-name')) { ... }
  ```
- **Phân tích nguyên nhân gốc**:
  - Hai icon bút chỉnh sửa `.btn-edit-name` và `.btn-edit-deadline` bị gán cứng `display: none` trong HTML và JavaScript không hề mở hiển thị chúng khi một dự án được chọn.
  - Người dùng không nhìn thấy bất kỳ nút hoặc biểu tượng nào để sửa tên dự án hay deadline.
  - Sự kiện click chỉ được gắn trực tiếp vào chính thẻ văn bản `id="mainProjectName"` và `id="mainProjectDeadline"`. Nếu người dùng click vào icon bút (kể cả khi unhide), sự kiện không chạy vì listener kiểm tra `event.target.id === 'mainProjectName'`.
- **Mức độ nghiêm trọng**: **HIGH**.
- **Đề xuất khắc phục**:
  - Khi mở một dự án (`openProject` hoặc khi click `sidebarItem`), đặt hiển thị cho `.btn-edit-name` và `.btn-edit-deadline`: `btn.style.display = 'inline-block'`.
  - Trong event listener: kiểm tra thêm `event.target.closest('.btn-edit-name')` để kích hoạt hộp thoại đổi tên và `event.target.closest('.btn-edit-deadline')` để đổi deadline.

#### 3.3. LỖI CSS & RESPONSIVE: Đảo ngược thứ tự Media Query trong `todo/mylist.css`
- **Vị trí**: `todo/mylist.css`, dòng 624 và dòng 675:
  ```css
  /* Dòng 624 */
  @media (max-width: 600px) {
      .task-meta-grid { grid-template-columns: 1fr; }
      .todo-filter-row select, .todo-data-btn { flex: 1 1 calc(50% - 8px); }
  }

  /* Dòng 675 */
  @media (max-width: 768px) {
      .project-wrapper { flex-direction: column; ... }
      ...
  }
  ```
- **Phân tích nguyên nhân gốc**:
  - Theo nguyên lý xếp tầng CSS (Cascading Style Sheets), khi sử dụng `max-width`, media query có độ rộng lớn hơn (`768px`) phải được đặt **TRƯỚC** media query có độ rộng hẹp hơn (`600px`).
  - Do `max-width: 768px` xuất hiện sau `max-width: 600px` (vị trí ký tự 13504 so với 12577), trên các màn hình hẹp <= 600px, các quy tắc của block `768px` ghi đè lên block `600px`.
  - Test `test_tier5_todo_media_query_cascade_order` phát hiện trực tiếp lỗi này: `assert 13504 < 12577` (FAILED).
- **Mức độ nghiêm trọng**: **MEDIUM**.
- **Đề xuất khắc phục**: Di chuyển block `@media (max-width: 768px)` lên trước block `@media (max-width: 600px)`.

#### 3.4. LỖI FORM ZOOM (iOS SAFARI): Cỡ chữ form input < 16px gây Auto-Zoom
- **Vị trí**:
  1. `todo/mylist.html` dòng 133: `<input id="taskNameInput" ... style="... font-size: 15px; ...">`
  2. `todo/mylist.html` dòng 137: `<input id="taskDeadlineInput" ... style="... font-size: 13px; ...">`
  3. `todo/mylist.js` dòng 990: `<input id="editTaskDate-${task.id}" ... style="... font-size: 14px; ...">`
  4. `todo/mylist.css` dòng 443: `.todo-search-wrap input { font-size: 12px; }`
  5. `todo/mylist.css` dòng 489: `.task-meta-grid select, .task-meta-grid input { font-size: 12px; }`
  6. `todo/mylist.css` dòng 446: `.todo-filter-row select` (không có rule >= 16px trên mobile).
- **Phân tích nguyên nhân gốc**:
  - Trình duyệt Safari trên iOS (iPhone 11 Pro 375x812 viewport) tự động phóng to toàn trang khi người dùng focus vào bất kỳ ô nhập liệu nào có cỡ chữ nhỏ hơn 16px.
  - Các input trong `mylist.html` và `mylist.js` bị gán cứng inline `font-size: 15px;`, `14px;`, `13px;`.
  - Trong `mylist.css`, `@media (max-width: 768px)` chỉ đặt 16px cho `#taskNameInput, #taskDeadlineInput, #editTaskName, #editTaskDate` mà bỏ quên `.todo-search-wrap input`, `.todo-filter-row select`, và `.task-meta-grid select, .task-meta-grid input`.
  - Dẫn đến 3 test fail trong `test_mobile_viewport.py`:
    - `test_tier4_input_font_size_todo_search_input`
    - `test_tier4_input_font_size_todo_task_inputs`
    - `test_tier4_no_sub16px_inline_font_sizes_in_mylist_js`
- **Mức độ nghiêm trọng**: **HIGH**.
- **Đề xuất khắc phục**:
  - Sửa inline style trong `mylist.html` (dòng 133, 137) thành `font-size: 16px;`.
  - Sửa inline style trong `mylist.js` (dòng 990) thành `font-size: 16px;`.
  - Bổ sung quy tắc trong `todo/mylist.css` dưới `@media (max-width: 768px)`:
    ```css
    .todo-search-wrap input,
    .todo-filter-row select,
    .task-meta-grid select,
    .task-meta-grid input {
        font-size: 16px !important;
    }
    ```

#### 3.5. TỒN DƯ CODE: Tham chiếu ID mồ côi (`taskInputBox`, `editTaskBox`, `btn-delete`)
- **Vị trí**: `todo/mylist.js` dòng 707, 869, 1140, 1258, 1316.
- **Phân tích**:
  - Mảng `listToHide` (dòng 1140) và các hàm `showMyProjectsTab`, `backToMain` chứa `taskInputBox` và `editTaskBox`. Trong khi đó DOM thực tế sử dụng `taskInputCard` và `edit-task-card`.
  - Listener click kiểm tra `event.target.classList.contains('btn-delete')` trên sidebar (dòng 707, 869), nhưng hàm `renderSidebar()` không hề render class này. Nút xóa dự án thực tế là `.delete-project-btn` trong bảng danh sách chính.
- **Mức độ nghiêm trọng**: **LOW**.

---

## 3. CÁC LỖI PHÁT SINH KHÁC TRONG CODEBASE ĐÃ PHÁT HIỆN

### 3.1. Hồi quy Viewport & CSS trên các trang khác (`test_mobile_viewport.py`)
1. **`style.css` dòng 725**: `.hero-title` có quy tắc `white-space: nowrap !important;` dưới `@media (max-width: 768px)`.
   - **Hậu quả**: Tiêu đề tràn ngang màn hình iPhone 11 Pro 375px. Gây fail test `test_tier5_hero_title_no_rigid_nowrap_on_mobile`.
   - **Xử lý**: Đổi thành `white-space: normal !important;` trong mobile media query.
2. **`schedule/create.css` dòng 712, 756**: `.timetable` có `min-width: 700px;` (dưới 768px) và `min-width: 600px;` (dưới 640px).
   - **Hậu quả**: Vượt quá chiều rộng 375px của iPhone 11 Pro. Gây fail test `test_tier5_schedule_container_no_rigid_min_width_overflow`.
   - **Xử lý**: Bao bọc timetable trong container có `overflow-x: auto` hoặc không đặt rigid min-width trực tiếp trên viewport container.
3. **`shared.css` dòng 932**: `.sv-modal-input` không khai báo `font-size >= 16px`.
   - Gây fail test `test_tier4_input_font_size_shared_modal`.
4. **`shared.css`**: Thiếu quy tắc media query cơ sở cho mobile form controls:
   ```css
   @media (max-width: 768px) {
       input, select, textarea { font-size: 16px; }
   }
   ```
   - Gây fail test `test_tier4_input_font_size_shared_mobile_base`.
5. **`account.css` dòng 199, 249**: `.account-input-wrap input` (12px) và `.account-select-wrap select` (11px) không có override >= 16px trên mobile media query.
   - Gây fail test `test_tier4_input_font_size_account_inputs` và `test_tier4_input_font_size_account_selects`.
6. **`schedule/create.css` dòng 1260**: `.tc-input` không có `font-size >= 16px`.
   - Gây fail test `test_tier4_input_font_size_schedule_tc_input`.

### 3.2. Thiếu cấu hình Test Fixture trong `tests/test_mailer.py`
- `tests/test_mailer.py` dòng 16 kiểm tra `mailer.get_resend_api_key().startswith('re_')`.
- Khi biến môi trường `RESEND_API_KEY` chưa được đặt trong máy phát triển, test này fail ngay lập tức mà không có fallback hay monkeypatch.
- **Xử lý**: Thêm `monkeypatch.setenv('RESEND_API_KEY', 're_test_key_123')` vào test fixture.

### 3.3. Thiếu Dependency kiểm thử môi trường Node.js (`test_app.py`)
- `tests/test_app.py` dòng 1243 gọi `subprocess.run(['node', '-e', ...])`.
- Nếu máy host chạy test không cài đặt Node.js trong PATH, test ném lỗi `FileNotFoundError`.
- **Xử lý**: Thêm điều kiện kiểm tra:
  ```python
  import shutil
  if not shutil.which('node'):
      pytest.skip("Node.js runtime is not available in PATH")
  ```

---

## 4. MA TRẬN TỔNG HỢP LỖI & PHƯƠNG ÁN KHẮC PHỤC (ISSUE MATRIX)

| ID | Vị trí (File & Dòng) | Mức độ | Phân loại | Tóm tắt nguyên nhân gốc | Phương án khắc phục chi tiết |
|---|---|---|---|---|---|
| **ISS-01** | `todo/mylist.js:901` | **CRITICAL** | DOM Mismatch | Query selector tìm `#modalOverlay h2` nhưng trong `mylist.html:181` là `<h3>` -> null pointer exception khi sửa project | Đổi selector thành `#modalOverlay h3` |
| **ISS-02** | `todo/mylist.js:913` | **CRITICAL** | DOM Mismatch | Query selector tìm `.modal-buttons` nhưng trong `mylist.html:192` là `.modal-footer` -> null pointer exception khi sửa project | Đổi selector thành `.modal-footer` |
| **ISS-03** | `app.py:57-64` | **HIGH** | Config / Env | `_numbered_provider_key` chỉ đọc `family+N`, không đọc chuẩn `GEMINI_API_KEY_1..10` hay `GROQ_API_KEY_1..10` | Thêm các biến thể `GEMINI_API_KEY_{N}`, `GROQ_API_KEY_{N}` vào tuple tìm kiếm |
| **ISS-04** | `app.py:165, 461` | **HIGH** | Circuit Breaker | Lỗi 429 (`rate_limit`) và 402 (`no_balance`) không có trong `_COOLDOWN_ERROR_CODES` -> key lỗi vẫn bị gọi lại đầu tiên ở mọi request sau | Thêm `'rate_limit'`, `'no_balance'` vào `_COOLDOWN_ERROR_CODES` |
| **ISS-05** | `app.py:635, 859` & `tests/test_app.py` | **HIGH** | Unit Test Regression | `request_ai` truyền `has_image` keyword argument làm vỡ chữ ký hàm của 5 mock test trong `test_app.py` | Cập nhật các mock trong `test_app.py` chấp nhận `**kwargs` hoặc điều chỉnh `request_ai` |
| **ISS-06** | `todo/mylist.html:71, 76` & `todo/mylist.js:700, 829` | **HIGH** | UI / Event Handler | Icon `.btn-edit-name` và `.btn-edit-deadline` bị `display: none` vĩnh viễn và không được gắn sự kiện click | Bỏ `display: none` khi mở project và gắn click handler cho cả icon lẫn title |
| **ISS-07** | `todo/mylist.html:133, 137` & `todo/mylist.js:990` | **HIGH** | Mobile iOS Zoom | Form input bị hardcode inline `font-size: 15px`, `13px`, `14px` gây auto-zoom trên iOS Safari | Đổi thành `font-size: 16px;` |
| **ISS-08** | `todo/mylist.css:443, 446, 489` | **HIGH** | Mobile iOS Zoom | Search input, filter select, task meta input/select có font 12px thiếu rule >= 16px trên mobile query | Thêm rule `font-size: 16px !important;` dưới `@media (max-width: 768px)` |
| **ISS-09** | `style.css:725` | **HIGH** | Mobile Reflow | `.hero-title` bị gán cứng `white-space: nowrap !important;` dưới 768px gây tràn ngang | Đổi thành `white-space: normal !important;` |
| **ISS-10** | `schedule/create.css:712, 756` | **HIGH** | Mobile Reflow | `.timetable` gán cứng `min-width: 700px / 600px` trên mobile gây tràn ngang 375px | Đưa bảng vào wrapper scroll hoặc loại bỏ rigid min-width trên mobile |
| **ISS-11** | `shared.css:932` & base mobile | **HIGH** | Mobile iOS Zoom | `.sv-modal-input` và base input/select/textarea thiếu rule font-size >= 16px dưới 768px | Khai báo `font-size: 16px` cho `.sv-modal-input` và base form controls dưới `@media (max-width: 768px)` |
| **ISS-12** | `account.css:199, 249` | **HIGH** | Mobile iOS Zoom | `.account-input-wrap input` (12px) và select (11px) thiếu rule >= 16px dưới 768px | Thêm rule `font-size: 16px` dưới `@media (max-width: 768px)` trong `account.css` |
| **ISS-13** | `schedule/create.css:1260` | **HIGH** | Mobile iOS Zoom | `.tc-input` thiếu khai báo `font-size >= 16px` trên mobile | Thêm `font-size: 16px` cho `.tc-input` dưới `@media (max-width: 768px)` |
| **ISS-14** | `todo/mylist.css:624, 675` | **MEDIUM** | CSS Cascade Order | `@media (max-width: 600px)` đứng trước `@media (max-width: 768px)` làm đảo ngược thứ tự kế thừa CSS | Đổi thứ tự: đặt block 768px trước block 600px |
| **ISS-15** | `app.py:207-216` | **MEDIUM** | Dynamic Env Key | `detect_available_providers` chỉ lặp slot 1..10, không quét lại fallback key đơn `GEMINI_API_KEY` / `GROQ_API_KEY` nếu được set sau import | Bổ sung quét key đơn vào `detect_available_providers` |
| **ISS-16** | `app.py:233-241` | **MEDIUM** | Client Cache | `OpenAI` client bị cache vĩnh viễn trong `AI_PROVIDERS[p]['_client']` | Thêm cơ chế refresh hoặc tạo mới client khi key/config thay đổi |
| **ISS-17** | `tests/test_mailer.py:16` | **MEDIUM** | Test Fixture | Test giả định `RESEND_API_KEY` có sẵn mà không monkeypatch trong fixture | Thêm monkeypatch `re_test_key` trong fixture test |
| **ISS-18** | `tests/test_app.py:1243` | **MEDIUM** | Test Env | Test phụ thuộc runtime `node` trên host OS | Bọc trong `shutil.which('node')` và `pytest.skip` |
| **ISS-19** | `todo/mylist.js:707, 869` | **LOW** | Orphan Code | Sự kiện xóa dự án kiểm tra class `.btn-delete` vốn không hề được render trong `renderSidebar` | Dọn dẹp code thừa hoặc thống nhất dùng `deleteProject()` |
| **ISS-20** | `TEST_INFRA.md`, `TEST_READY.md` | **LOW** | Documentation | Tài liệu cũ vẫn còn nhắc đến `tests/test_flashcards.py` và route `/flashcard` | Cập nhật tài liệu phản ánh chính xác trạng thái đã xóa Flashcard |

---

## 5. KẾT LUẬN & KIẾN NGHỊ HÀNH ĐỘNG TIẾP THEO

1. **Về loại bỏ Flashcard**: Đã được thực hiện triệt để và an toàn trong toàn bộ mã nguồn ứng dụng (backend `app.py`, template HTML, route, CSS, JS, Supabase auth/sync). Không còn bất kỳ import gãy hay dead link nào liên quan đến Flashcard trong ứng dụng.
2. **Về AI Career 10-slot**: Kiến trúc 10-slot đã được thiết lập, nhưng cần bổ sung các định dạng biến môi trường chuẩn (`GEMINI_API_KEY_1..10`, `GROQ_API_KEY_1..10`) và đưa mã `rate_limit` (429) vào danh sách mở Circuit Breaker (`_COOLDOWN_ERROR_CODES`) để đảm bảo failover trơn tru khi key bị chạm quota.
3. **Về Todo UI Restoration**: Cần khẩn cấp sửa hai lỗi lệch selector DOM trong `todo/mylist.js` (dòng 901 và 913) để phục hồi chức năng Sửa dự án, đồng thời chuẩn hóa font-size form controls lên 16px và đảo lại thứ tự media query trong `todo/mylist.css` để đưa 11 test viewport mobile về trạng thái xanh (PASS).
