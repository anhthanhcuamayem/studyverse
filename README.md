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
export FREELLM_API_KEY="your-key"
export FREELLM_BASE_URL="http://localhost:3001/v1"  # tùy chọn
python app.py
```

Mở `http://localhost:5000`. Nếu chưa cấu hình `FREELLM_API_KEY`, các tính năng AI sẽ trả về thông báo cấu hình thay vì gọi dịch vụ bên ngoài.

## Lưu ý dữ liệu

Todo và thời khóa biểu hiện được lưu cục bộ trong LocalStorage của trình duyệt. Dữ liệu không tự đồng bộ giữa thiết bị; không nhập thông tin nhạy cảm vào bản demo này.

Các tính năng nổi bật trong kho lưu trữ này bao gồm:
1. **Interactive Schedule (Thời khóa biểu tương tác):** Cho phép học sinh thiết lập thời gian biểu cá nhân theo chuẩn khung giờ học tập thực tế (bao gồm các tiết học, giờ ra chơi lớn, nghỉ trưa và buổi chiều), hỗ trợ thuật toán xếp lịch tự động và tuỳ biến linh hoạt theo từng ngày trong tuần.
2. **My Projects / Todo List:** Giúp người dùng quản lý các mục tiêu học tập, dự án cá nhân kèm theo thời hạn (deadline) và phân chia công việc chi tiết.
3. **AI Career (Tư vấn hướng nghiệp thông minh):** Tích hợp trợ lý ảo AI (thông qua LLM API) để trò chuyện, định hướng nghề nghiệp và đưa ra lời khuyên học tập thực tế cho học sinh.
