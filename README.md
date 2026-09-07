studyverse/ (Root)
├── app.py                  <-- File điều khiển chính (Backend Server - Flask)
├── index.html              <-- Trang chủ của ứng dụng
├── script.js               <-- Logic JavaScript trang chủ
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
    ├── create.html         <-- Trang phụ trợ giao diện tạo công việc
    ├── mylist.css          <-- Giao diện danh sách project & task (Todo)
    └── mylist.html         <-- Trang quản lý dự án cá nhân


---

## 🌟 Giới thiệu về Studyverse

**Studyverse** là một nền tảng web tích hợp thông minh dành cho học sinh, sinh viên, kết hợp giữa quản lý học tập, tổ chức thời gian và định hướng nghề nghiệp bằng Trí tuệ Nhân tạo (AI). 

## Chạy dự án

Yêu cầu: Python 3.10+.

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
# Chỉ cần cấu hình ít nhất MỘT provider (đều theo chuẩn OpenAI-compatible)
export FREELLM_API_KEY="your-key"            # FreeLLM local (http://localhost:3001/v1)
# export OPENAI_API_KEY="sk-..."
# export GEMINI_API_KEY="..."                # Google AI Studio
# export GROQ_API_KEY="gsk_..."
# export OPENROUTER_API_KEY="sk-or-..."
# export ANTHROPIC_API_KEY="sk-ant-..."
# export AI_PROVIDER="gemini"                # tùy chọn: ép dùng provider mặc định
# export AI_PROVIDER_ORDER="gemini,openai,freellm"  # tùy chọn: thứ tự failover
python app.py
```

Mở `http://localhost:5000`. Nếu chưa cấu hình API key nào, các tính năng AI sẽ trả về thông báo cấu hình thay vì gọi dịch vụ bên ngoài.

## Nhận diện & chọn AI provider

Backend hỗ trợ nhiều nhà cung cấp AI cùng lúc và **tự nhận diện** provider nào khả dụng dựa trên biến môi trường đã đặt:

| Provider | Biến bắt buộc | Tùy chọn |
|----------|---------------|----------|
| FreeLLM  | `FREELLM_API_KEY` | `FREELLM_BASE_URL`, `FREELLM_MODEL` (mặc định `auto:fast`) |
| OpenAI   | `OPENAI_API_KEY` | `OPENAI_BASE_URL`, `OPENAI_MODEL` (mặc định `gpt-4o-mini`) |
| Gemini   | `GEMINI_API_KEY` (hoặc `GOOGLE_API_KEY`) | `GEMINI_BASE_URL`, `GEMINI_MODEL` (mặc định `gemini-2.0-flash`) |
| Groq     | `GROQ_API_KEY` | `GROQ_BASE_URL`, `GROQ_MODEL` (mặc định `llama-3.3-70b-versatile`) |
| OpenRouter | `OPENROUTER_API_KEY` | `OPENROUTER_BASE_URL`, `OPENROUTER_MODEL` (mặc định `openrouter/auto`) |
| Anthropic | `ANTHROPIC_API_KEY` | `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL` |

Cách chọn provider khi có nhiều key:
1. Trường `provider` trong body request (xem bên dưới).
2. Biến môi trường `AI_PROVIDER` (provider mặc định cho toàn app).
3. Provider đầu tiên còn key theo `AI_PROVIDER_ORDER` (mặc định: freellm → openai → gemini → groq → openrouter → anthropic).

Nếu provider được chọn lỗi, backend **tự failover** sang provider tiếp theo còn key.

- `GET /api/ai-providers` — xem danh sách provider đã nhận diện được.
- Body request cho `/api/career-ai` và `/api/suggest` có thể kèm `"provider": "groq"` để ép dùng một provider cụ thể cho request đó.

## Lưu ý dữ liệu

Todo và thời khóa biểu hiện được lưu cục bộ trong LocalStorage của trình duyệt. Dữ liệu không tự đồng bộ giữa thiết bị; không nhập thông tin nhạy cảm vào bản demo này.

Các tính năng nổi bật trong kho lưu trữ này bao gồm:
1. **Interactive Schedule (Thời khóa biểu tương tác):** Cho phép học sinh thiết lập thời gian biểu cá nhân theo chuẩn khung giờ học tập thực tế (bao gồm các tiết học, giờ ra chơi lớn, nghỉ trưa và buổi chiều), hỗ trợ thuật toán xếp lịch tự động và tuỳ biến linh hoạt theo từng ngày trong tuần.
2. **My Projects / Todo List:** Giúp người dùng quản lý các mục tiêu học tập, dự án cá nhân kèm theo thời hạn (deadline) và phân chia công việc chi tiết.
3. **AI Career (Tư vấn hướng nghiệp thông minh):** Tích hợp trợ lý ảo AI (thông qua LLM API) để trò chuyện, định hướng nghề nghiệp và đưa ra lời khuyên học tập thực tế cho học sinh.
