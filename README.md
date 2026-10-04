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
# Cấu hình FreeLLMAPI từ .env (copy .env.example thành .env rồi điền key/model).
# File .env không được commit.
cp .env.example .env
# Điền FREELLM_API_KEY và FREELLM_MODEL trong .env.
# FREELLM_BASE_URL mặc định là http://localhost:3001/v1.
python app.py
```

Mở `http://localhost:5000`. Nếu chưa cấu hình API key nào, các tính năng AI sẽ trả về thông báo cấu hình thay vì gọi dịch vụ bên ngoài.

## FreeLLMAPI (Freellmapi) gateway

Studyverse giờ gọi AI qua endpoint OpenAI-compatible của FreeLLMAPI. FreeLLMAPI chạy ở `http://localhost:3001/v1` và được expose qua cloudflared tunnel dưới domain `ai.studyverse.cloud`.

| Biến | Ý nghĩa | Mặc định |
|------|---------|----------|
| `FREELLM_BASE_URL` | Base URL của FreeLLMAPI, thường kết thúc bằng `/v1` | `http://localhost:3001/v1` |
| `FREELLM_API_KEY` | API key từ FreeLLMAPI | Chưa cấu hình |
| `FREELLM_MODEL` | Model hoặc alias/combo hiện tại | `auto:fast` |

Điền key và model/alias phù hợp với FreeLLMAPI vào `.env`. Endpoint `/api/ai-providers` sẽ báo `freellmapi` khi có key; thêm `?probe=1` để thử một completion thật.

- `GET /api/ai-providers` — xem danh sách provider đã nhận diện được.
- `GET /api/ai-providers?probe=1` — kiểm tra thật từng provider (gọi 1 completion tối thiểu) và trả về `health` kèm `code`/`message` cho từng provider.
- `GET /api/health` — kiểm tra nhanh server còn sống và AI đã cấu hình chưa.
- Các endpoint AI luôn dùng provider `freellmapi`; cấu hình model/agent được quản lý tại FreeLLMAPI.
- `POST /api/career-ai-stream` — phiên bản streaming (SSE) của career chat: AI trả lời từng mảnh thay vì chờ cả câu. Body chấp nhận thêm `projects` và `schedule` (đọc từ LocalStorage của Todo/Schedule) để AI tư vấn dựa trên dữ liệu học tập thật của người dùng.
- `POST /api/ai-context` — rút gọn dữ liệu projects/schedule gửi lên thành ngữ cảnh gọn nhẹ cho AI (server không lưu dữ liệu).

Khi gateway lỗi, phản hồi lỗi kèm `code` để chỉ rõ nguyên nhân thay vì thông báo chung chung:
`invalid_key` (401), `no_balance` (402), `permission` (403), `model_not_found` (404), `rate_limit` (429), `provider_down` (5xx), `timeout`, `connection`, `unknown`.

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
3. **AI Career (Tư vấn hướng nghiệp thông minh):** Tích hợp trợ lý ảo AI (thông qua LLM API) để trò chuyện, định hướng nghề nghiệp và đưa ra lời khuyên học tập thực tế cho học sinh.
