studyverse/ (Root)
├── app.py                  <-- File điều khiển chính (Backend Server - Flask)
├── index.html              <-- Trang chủ của ứng dụng
├── config.js               <-- Mặc định frontend (theme, ngôn ngữ, khóa LocalStorage, khung giờ TKB) — dev sửa ở đây
├── config-preview.html     <-- Công cụ dev: chỉnh thử theme/khung giờ rồi xuất config.js
├── shared.js               <-- Logic JS dùng chung 4 trang (modal, navbar, escapeHtml)
├── style.css               <-- Định nghĩa giao diện (CSS) trang chủ
├── requirements.txt        <-- Danh sách các thư viện Python (như Flask, OpenAI, ...)
├── pockup.png              <-- Hình ảnh mockup / giao diện tổng quan
├── README.md               <-- Tài liệu mô tả dự án
├── career/                 <-- Thư mục chứa tính năng AI Career (Tư vấn hướng nghiệp)
│   ├── chat.css            <-- Giao diện cho khung chat AI
│   ├── chat.html           <-- Trang giao diện tư vấn hướng nghiệp
│   └── chat.js             <-- Logic xử lý chat với AI
├── schedule/               <-- Thư mục chứa chức năng Lập TKB tương tác thông minh
│   ├── create.css          <-- Giao diện phong cách hiện đại cho Schedule
│   ├── create.html         <-- Trang giao diện chính của bảng thời khóa biểu
│   ├── create.js           <-- Xử lý logic xếp lịch, chia tiết, nghỉ giải lao
│   └── schedule_utils.py   <-- Các tiện ích phụ trợ xử lý thời gian/thuật toán lịch
└── todo/                   <-- Thư mục chứa tính năng quản lý công việc (My Projects / Todo)
    ├── mylist.css          <-- Giao diện danh sách project & task (Todo)
    ├── mylist.js           <-- Logic quản lý dự án & công việc (LocalStorage)
    └── mylist.html         <-- Trang quản lý dự án cá nhân


---

## Giới thiệu về Studyverse

**Studyverse** là một nền tảng web tích hợp thông minh dành cho học sinh, sinh viên, kết hợp giữa quản lý học tập, tổ chức thời gian và định hướng nghề nghiệp bằng Trí tuệ Nhân tạo (AI). 

## Chạy dự án

Yêu cầu: Python 3.10+.

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
# Cấu hình Gemini/Groq trong .env (copy .env.example thành .env rồi điền key).
# File .env không được commit.
cp .env.example .env
# Điền một hoặc nhiều key gemini1..gemini10 và/hoặc groq1..groq10.
python app.py
```

Mở `http://localhost:5000`. Nếu chưa cấu hình API key nào, các tính năng AI sẽ trả về thông báo cấu hình thay vì gọi dịch vụ bên ngoài.

## Gemini và Groq

AI Career gọi Gemini và Groq qua các API tương thích OpenAI. Khai báo key bằng các biến `gemini1` đến `gemini10` và `groq1` đến `groq10`; chỉ cần điền các key muốn sử dụng. Tên biến viết hoa tương ứng (`GEMINI1`, `GROQ1`,...) cũng được chấp nhận.

Mặc định app thử các key Gemini theo thứ tự số, sau đó lần lượt thử các key Groq. Nếu một key lỗi, app chuyển sang key tiếp theo; lỗi khả dụng (timeout, mất kết nối, lỗi 5xx) còn được tạm bỏ qua trong thời gian circuit breaker. Với ảnh, các key Gemini rồi Groq được ưu tiên để dùng khả năng thị giác.

`GEMINI_MODEL` và `GROQ_MODEL` cấu hình model dùng chung cho từng provider; endpoint mặc định lần lượt là Gemini OpenAI-compatible và `https://api.groq.com/openai/v1`. Tùy chỉnh endpoint qua `GEMINI_BASE_URL` hoặc `GROQ_BASE_URL` nếu cần.

Timeout mỗi lời gọi AI chỉnh qua `AI_REQUEST_TIMEOUT` (giây, mặc định 30); giới hạn token mỗi lời gọi chỉnh qua `AI_MAX_TOKENS` (mặc định 4096). Trạng thái từng key xem ở `GET /api/ai-providers` (trường `cooling_down`).

| Biến | Ý nghĩa | Mặc định |
|------|---------|----------|
| `gemini1`..`gemini10` | API keys Gemini | Chưa cấu hình |
| `groq1`..`groq10` | API keys Groq | Chưa cấu hình |
| `GEMINI_MODEL` | Model Gemini | `gemini-3.8-flash` |
| `GEMINI_BASE_URL` | Endpoint Gemini OpenAI-compatible | Gemini OpenAI-compatible |
| `GROQ_MODEL` | Model Groq | `openai/gpt-oss-120b` |
| `GROQ_BASE_URL` | Endpoint OpenAI-compatible của Groq | `https://api.groq.com/openai/v1` |
| `AI_REQUEST_TIMEOUT` | Timeout mỗi lời gọi AI (giây) | `30` |
| `AI_MAX_TOKENS` | Giới hạn token tối đa mỗi lời gọi AI (`max_tokens`) | `4096` |
| `AI_MAX_RETRIES` | Số lần SDK tự thử lại trước khi chuyển key (`0` = failover nhanh) | `0` |
| `AI_FAILOVER_COOLDOWN` | Giây tạm bỏ qua key vừa lỗi khả dụng (`0` = tắt circuit breaker) | `60` |

- `GET /api/ai-providers` — xem danh sách provider đã nhận diện được, kèm `cooling_down` (provider đang bị tạm bỏ qua sau lỗi khả dụng).
- `GET /api/ai-providers?probe=1` — kiểm tra thật từng provider (gọi 1 completion tối thiểu) và trả về `health` kèm `code`/`message` cho từng provider.
- `GET /api/health` — kiểm tra nhanh server còn sống và AI đã cấu hình chưa.
- Các endpoint AI mặc định ưu tiên Gemini, sau đó Groq; `AI_PROVIDER_ORDER` có thể dùng để tùy chỉnh thứ tự.
- `POST /api/career-ai-stream` — phiên bản streaming (SSE) của career chat: AI trả lời từng mảnh thay vì chờ cả câu. Body chấp nhận thêm `projects` và `schedule` (đọc từ LocalStorage của Todo/Schedule) để AI tư vấn dựa trên dữ liệu học tập thật của người dùng.
- `POST /api/ai-context` — rút gọn dữ liệu projects/schedule gửi lên thành ngữ cảnh gọn nhẹ cho AI (server không lưu dữ liệu).
- `POST /api/ai-actions` — đọc khối hành động trong câu trả lời AI (`reply`, kèm `projects`/`schedule` hiện tại) và trả về thay đổi đã kiểm tra cho Todo/Thời khóa biểu; server **không** lưu và không tự áp dụng.

Khi gateway lỗi, phản hồi lỗi kèm `code` để chỉ rõ nguyên nhân thay vì thông báo chung chung:
`invalid_key` (401), `no_balance` (402), `permission` (403), `model_not_found` (404), `rate_limit` (429), `provider_down` (5xx), `timeout`, `connection`, `unknown`.

### AI chỉnh sửa Todo & Thời khóa biểu

Ngoài phần tư vấn, AI Career có thể **đề xuất thay đổi thật** cho My Projects (Todo) và Thời khóa biểu. Cách hoạt động:

1. Trong system prompt, AI được dạy đặt ở **cuối câu trả lời** một khối mã duy nhất:

   ````
   ```studyverse-actions
   {"actions": [ {"type": "todo.create_task", "project": "Ôn thi", "name": "Làm đề 1", "deadline": "2026-11-01", "priority": "high"} ]}
   ```
   ````

2. Trình duyệt gửi `reply` (kèm projects/schedule hiện tại) tới `POST /api/ai-actions`. Server tách khối, **kiểm tra và chuẩn hóa** từng hành động rồi trả về `{actions, summary, problems}`: `summary` là các dòng mô tả theo khóa i18n (vi/en), `problems` là đề xuất bị bỏ kèm lý do.
3. Trong khung chat, khối JSON bị **ẩn khỏi phần chữ** và thay bằng **thẻ xem trước** liệt kê từng thay đổi. Chỉ khi người dùng bấm **Áp dụng** thì `svApplyAIActions()` (trong `shared.js`) mới ghi vào LocalStorage — đúng khóa mà trang Todo/Thời khóa biểu đang dùng (kể cả khóa đã tách theo tài khoản). Bấm **Bỏ qua** thì không có gì thay đổi.

Các loại hành động được phép:

| Loại | Tham số |
|------|---------|
| `todo.create_project` | `name`, `deadline?` |
| `todo.update_project` | `project`, `name?`, `deadline?` |
| `todo.create_task` | `project`, `name`, `deadline?`, `priority?`, `estimate?`, `repeat?`, `subtasks?` |
| `todo.update_task` | `project`, `task`, `patch: {name?, deadline?, priority?, estimate?, repeat?, status?}` |
| `todo.delete_task` | `project`, `task` |
| `schedule.add_subject` | `name`, `sessions?` |
| `schedule.remove_subject` | `name` |
| `schedule.set_lesson` | `day` (0 = Thứ 2 … 6 = Chủ nhật), `slot` (chỉ số trong `slots`), `subject` |
| `schedule.clear_lesson` | `day`, `slot` |

Ràng buộc để tránh ghi dữ liệu sai:

- Tên dự án/công việc/môn học phải **khớp dữ liệu hiện có** khi sửa hoặc xóa; hành động không tìm thấy đối tượng bị trả trong `problems` thay vì được áp dụng.
- `deadline` phải là `YYYY-MM-DD`; `priority` ∈ `low|medium|high`; `repeat` ∈ `none|daily|weekly`; `status` ∈ `todo|doing|done`.
- Thời khóa biểu chỉ xếp được vào khung `type` = `lesson` (giờ nghỉ bị từ chối) và môn phải có trong `subjects` — nên AI phải thêm môn trước khi xếp tiết.
- Các hành động được kiểm tra **theo đúng thứ tự**: `todo.create_project` rồi `todo.create_task` vào dự án vừa tạo vẫn hợp lệ, còn `todo.delete_task` theo tên mới sau `todo.update_task` (đổi tên) cũng vậy.
- Tối đa **20 thay đổi** mỗi câu trả lời; mọi chuỗi đều được cắt theo giới hạn (tên ≤ 120, hạn ≤ 20 ký tự...). Server chỉ đọc câu trả lời, không gọi thêm AI nên bước này chạy cả khi provider AI đang lỗi.

Nếu trang Thời khóa biểu chưa từng mở (chưa có gì trong LocalStorage), trang chat vẫn gửi khung giờ mặc định trong `config.js` làm ngữ cảnh, và khi áp dụng, `svApplyAIActions()` tự dựng khung dữ liệu tối thiểu trước khi ghi.

### Lịch sử chat AI

Trang **AI Career** lưu lịch sử trò chuyện cục bộ (LocalStorage khóa `studyverse_career_chat`, gom trong `SV_CONFIG.storage.careerChat`), giữ tối đa 100 tin nhắn gần nhất. Câu trả lời của AI được render markdown tối giản (đậm/nghiêng, `code`, danh sách, tiêu đề, liên kết) và có nút sao chép.

## Chạy test

```bash
pip install -r requirements-dev.txt   # cài pytest
.venv/bin/pytest                      # chạy toàn bộ test backend
```

Test nằm trong `tests/` và **không gọi mạng** tới nhà cung cấp AI (mọi lời gọi `request_ai` đều được mock), nên chạy được cả khi chưa cấu hình key.

## Cấu hình mặc định

Mọi mặc định của frontend gom trong **`config.js`** (`window.SV_CONFIG`), nạp trước `shared.js`:

- `defaultLang`, `defaultTheme`, `themes` — panel Cài đặt.
- `storage.*` — tên khóa LocalStorage (đổi tên = mất dữ liệu cũ).
- `schedule.*` — khung giờ mặc định, màu môn học, độ dài tiết, khoảng nghỉ, tên thứ.

Chỉ cần sửa `config.js`, không phải đụng JS/CSS.

## Tài khoản Studyverse

Trang `/account.html` hỗ trợ đăng ký, đăng nhập, xác nhận email, đặt lại mật khẩu và đăng xuất qua Supabase Auth. Để bật dịch vụ, điền `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY` trong `.env`, bật Email provider trong Supabase, rồi thêm URL đang dùng (localhost, địa chỉ LAN hoặc domain deploy) vào mục **Authentication → URL Configuration → Redirect URLs**. Khóa publishable được dùng phía trình duyệt; không đưa secret/service role key vào frontend.

Đăng nhập hiện xác thực tài khoản nhưng chưa đồng bộ projects/thời khóa biểu: dữ liệu đó vẫn được lưu trong LocalStorage của trình duyệt hiện tại.

Có sẵn công cụ dev **`/config-preview.html`**: chọn theme, sửa/thêm/bớt tiết và xem trước; trang tự kiểm tra hợp lệ rồi cho **tải xuống `config.js`** (hoặc sao chép) để dán đè vào file gốc. Lúc khởi động, `shared.js` cũng tự gọi `svValidateConfig()` và in cảnh báo `[config.js] …` ra console nếu khóa nào thiếu/sai.

## Lưu ý dữ liệu

Todo và thời khóa biểu hiện được lưu cục bộ trong LocalStorage của trình duyệt. Dữ liệu không tự đồng bộ giữa thiết bị; không nhập thông tin nhạy cảm vào bản demo này.

Các tính năng nổi bật trong kho lưu trữ này bao gồm:
1. **Interactive Schedule (Thời khóa biểu tương tác):** Cho phép học sinh thiết lập thời gian biểu cá nhân theo chuẩn khung giờ học tập thực tế (bao gồm các tiết học, giờ ra chơi lớn, nghỉ trưa và buổi chiều), hỗ trợ thuật toán xếp lịch tự động và tuỳ biến linh hoạt theo từng ngày trong tuần.
2. **My Projects / Todo List:** Giúp người dùng quản lý các mục tiêu học tập, dự án cá nhân kèm theo thời hạn (deadline) và phân chia công việc chi tiết.
3. **AI Career (Tư vấn hướng nghiệp thông minh):** Tích hợp trợ lý ảo AI (thông qua LLM API) để trò chuyện, định hướng nghề nghiệp và đưa ra lời khuyên học tập thực tế cho học sinh, kèm khả năng đề xuất chỉnh sửa Todo và Thời khóa biểu để người dùng duyệt trước khi áp dụng.
