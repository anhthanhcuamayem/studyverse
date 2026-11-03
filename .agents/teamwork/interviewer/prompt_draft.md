Rà soát toàn diện codebase Studyverse (backend app.py, test suite pytest, frontend JS/HTML/CSS của các trang Todo, Schedule, AI Career, Account, logic xác thực, email, đồng bộ dữ liệu) để phát hiện mọi lỗi phát sinh sau các thay đổi gần đây và lập báo cáo chi tiết kèm hướng xử lý mà không sửa đổi mã nguồn.

Working directory: c:\Users\Administrator\Downloads\studyverse
Integrity mode: development

## Requirements

### R1. Rà soát codebase và chạy kiểm thử (Comprehensive Codebase Audit & Test Execution)
Thực thi toàn bộ test suite pytest trong môi trường ảo .venv (Python 3.11) và rà soát backend (app.py, mailer.py), logic xác thực, email, đồng bộ dữ liệu cùng frontend JS/HTML/CSS của các trang Todo (todo/mylist.html), Schedule, AI Career, và Account để phát hiện toàn bộ các lỗi cú pháp, test fail, import gãy, link chết, vấn đề bảo mật hoặc hồi quy logic.

### R2. Báo cáo kiểm tra chi tiết (Comprehensive Audit Report)
Lập báo cáo kiểm tra chi tiết ghi nhận tất cả lỗi được tìm thấy, phân loại theo mức độ nghiêm trọng, chỉ rõ vị trí tệp và dòng mã cụ thể, phân tích nguyên nhân gốc và đưa ra phương án xử lý cụ thể cho từng lỗi. Giữ nguyên trạng thái mã nguồn ứng dụng, không trực tiếp chỉnh sửa code.

## Verification Resources
- Môi trường Python 3.11 với virtual environment .venv và các dependencies trong requirements.txt.
- Bộ kiểm thử pytest hiện có (tests/test_app.py, tests/test_mobile_viewport.py, v.v.).

## Acceptance Criteria

### Audit Coverage & Test Verification
- [ ] Lệnh pytest được thực thi đầy đủ trong môi trường .venv và mọi trường hợp fail/error hoặc warning được ghi nhận lại trong báo cáo.
- [ ] Toàn bộ mã nguồn liên quan đến các thay đổi gần đây (xóa Flashcard trong backend và frontend, nâng cấp 10 slot Gemini/Groq trong AI Career, khôi phục UI trong todo/mylist.html) được rà soát và xác nhận không còn import gãy hay tham chiếu mồ côi.
- [ ] Các trang Todo, Schedule, AI Career, Account cùng các luồng logic (xác thực, gửi email, đồng bộ dữ liệu) được rà soát đầy đủ về cú pháp, link chết, tính toàn vẹn logic và bảo mật.

### Audit Deliverable & Remediation Plan
- [ ] Báo cáo kiểm tra chi tiết được tạo lập đầy đủ, liệt kê từng lỗi phát hiện kèm mức độ nghiêm trọng, vị trí tệp/dòng mã cụ thể, nguyên nhân gốc và phương án khắc phục tương ứng.
- [ ] Mã nguồn của ứng dụng không bị sửa đổi trong quá trình thực hiện kiểm tra.
