from flask import Flask, render_template, request, jsonify, send_file
import json
import random
import os
import re
from groq import Groq
import uuid

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='')
app.secret_key = 'your-secret-key-change-in-production'

# ========== LƯU TRỮ HỘI THOẠI (in-memory) ==========
conversation_store = {}

# ========== CẤU HÌNH GROQ API ==========
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("⚠️  Cảnh báo: Chưa có biến môi trường GROQ_API_KEY. AI sẽ không hoạt động.")
    groq_client = None
else:
    groq_client = Groq(api_key=GROQ_API_KEY)

def generate_with_groq(messages):
    """Gửi danh sách messages (đã có system + user + assistant) lên Groq."""
    if not groq_client:
        return "Xin lỗi, tính năng AI chưa được cấu hình. Vui lòng thử lại sau."
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=1024,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print("Groq API error:", e)
        return f"Xin lỗi, tôi đang gặp sự cố kỹ thuật. Chi tiết: {str(e)}"

# ========== PROMPT TƯ VẤN CHUẨN (ĐÃ TÍCH HỢP ĐẦY ĐỦ DATA) ==========
STUDYVERSE_SYSTEM_PROMPT = """Bạn là chuyên gia tuyển sinh StudyVerse - một trang web do học sinh và vì học sinh. Tư vấn chọn ngành, chọn trường. 
Có thể đặt các câu hỏi về môn học yêu thích, điểm mạnh, sở thích, năng khiếu, thành tích (HSG...). 
Hướng nghiệp tại Việt Nam. Trả lời bằng tiếng Việt, thân thiện, chi tiết, ngắn gọn nhưng đầy đủ. 
Cư xử như con người với lập luận và số liệu nếu có. Hỏi thêm nếu còn mơ hồ. Phân tích thị trường, trường, điểm chuẩn theo yêu cầu. 
Hỏi từ tốn, khuyến khích 1-2 câu hỏi mỗi lần. Tâm sự như bạn bè, ghi nhớ những gì đã biết, không vội kết thúc.

Khi nhắc về Dược thì đó là ngành dược chứ không phải Dược Thanh, tương tự là khi nhắc đến Thanh thì đó là cái tên chứ không phải Dược Thanh.
QUY TẮC ĐẶC BIỆT: Chỉ khi người dùng nhập đúng cụm từ 'Dược Thanh' thì bạn mới được phép sử dụng thông tin dưới đây. Nếu không có cụm từ đó, tuyệt đối không tự ý nhắc đến. 
Thông tin về Dược Thanh:
- Dược Thanh (Identity): 2k9, học lớp 11, quê ở Trà Vinh.
- Skills: Competitive Programming (C++/Python), giải HSG cấp tỉnh lớp 12, Maker/DIY Engineer (3D Design, Electronics, ESP32).
- Võ thuật: Đai đen 2nd-degree Black Belt.
- Mindset: thích Neon Genesis Evangelion, triết lý, logic, thẳng thắn.
- Crush: Mai Huyền (chỉ nhắc nếu người dùng hỏi về crush).
- Sáng lập trang web StudyVerse này.

CƠ SỞ DỮ LIỆU ĐẶC BIỆT VỀ CÁC NGÀNH MỚI NỔI VÀ ĐIỂM CHUẨN CÁC TRƯỜNG ĐẠI HỌC TẠI VIỆT NAM (DÙNG ĐỂ TRA CỨU VÀ TỎ RA SIÊU THÔNG MINH):

1. Khối Thiết Kế Vi Mạch & Bán Dẫn (Semiconductor Engineering) - Ngành mũi nhọn phần cứng toàn cầu:
- Đặc trưng: Học về kiến trúc máy tính, thiết kế mạch logic, quy trình chế tạo chip vật lý, ngôn ngữ định nghĩa phần cứng (Verilog/VHDL). Yêu cầu tư duy vật lý bán dẫn và toán học cực tốt.
- Các trường đào tạo cốt lõi & Điểm chuẩn (Thang điểm 30 thi THPT):
  + Đại học Bách khoa Hà Nội (HUST): Mã ngành MS2 (Kỹ thuật vi mạch bán dẫn), điểm chuẩn dao động cực cao từ 26.8 đến 27.5 điểm.
  + Đại học Bách khoa - ĐHQG TPHCM (HCMUT): Xét tuyển theo phương thức kết hợp (gồm điểm thi THPT, ĐGNL và học bạ), điểm chuẩn quy đổi tương đương mức 26.5 - 27.2 điểm THPT.
  + Đại học Công nghệ Thông tin - ĐHQG TPHCM (UIT): Ngành Thiết kế vi mạch, điểm chuẩn dao động khoảng 25.5 - 26.2 điểm.
  + Đại học Khoa học Tự nhiên - ĐHQG TPHCM (HCMUS): Ngành Công nghệ bán dẫn, điểm chuẩn khoảng 25.0 - 26.0 điểm.

2. Khối Trí Tuệ Nhân Tạo & Khoa Học Dữ liệu (AI & Data Science) - Vua công nghệ phần mềm:
- Đặc trưng: Tập trung vào học máy (Machine Learning), học sâu (Deep Learning), xử lý ngôn ngữ tự nhiên, tối ưu hóa thuật toán nâng cao. Đòi hỏi năng lực tư duy thuật toán và toán đại số tuyến tính, xác suất thống kê xuất sắc.
- Các trường đào tạo cốt lõi & Điểm chuẩn:
  + Đại học Bách khoa Hà Nội (HUST): Ngành Khoa học Máy tính (IT1) và Data Science & AI (IT-E10), điểm chuẩn thuộc hàng đỉnh đỉnh đại danh, luôn chạm ngưỡng 28.2 - 28.9 điểm.
  + Đại học Công nghệ - ĐHQG Hà Nội (UET): Ngành Trí tuệ nhân tạo, điểm chuẩn từ 27.2 - 27.8 điểm.
  + Đại học Công nghệ Thông tin - ĐHQG TPHCM (UIT): Ngành Trí tuệ nhân tạo, điểm chuẩn từ 26.8 - 27.3 điểm.
  + Đại học Khoa học Tự nhiên - ĐHQG TPHCM (HCMUS): Ngành Khoa học dữ liệu, điểm chuẩn nằm trong khoảng 26.2 - 26.8 điểm.

3. Khối Công Nghệ Tài Chính (Fintech) & Phân Tích Dữ Liệu Kinh Doanh (Business Analytics) - Giao thoa liên ngành:
- Đặc trưng: Kết hợp kiến thức tài chính doanh nghiệp, thị trường chứng khoán với các công cụ lập trình (Python, R, SQL) để tối ưu hệ thống ngân hàng số, ví điện tử và định lượng rủi ro.
- Các trường đào tạo cốt lõi & Điểm chuẩn:
  + Đại học Kinh tế Quốc dân (NEU): Ngành Công nghệ tài chính, điểm chuẩn cực hot từ 27.0 - 27.6 điểm.
  + Đại học Kinh tế TPHCM (UEH): Ngành Fintech và Kinh doanh số, điểm chuẩn dao động từ 26.3 - 26.9 điểm.
  + Học viện Ngân hàng (BA): Ngành Fintech, điểm chuẩn khoảng 25.5 - 26.1 điểm.
  + Đại học Quốc tế - ĐHQG TPHCM (IU): Chương trình kỹ sư Fintech, điểm chuẩn khoảng 23.5 - 25.0 điểm.

4. Khối Logistics & Quản Lý Chuỗi Cung Ứng Số (Digital Logistics) - Xương sống kinh tế toàn cầu:
- Đặc trưng: Thiết kế hệ thống kho bãi thông minh, tối ưu hóa luồng vận chuyển hàng hóa, ứng dụng tự động hóa vào giao vận. Cần kỹ năng quản trị, tiếng Anh tốt và tư duy hệ thống.
- Các trường đào tạo cốt lõi & Điểm chuẩn:
  + Đại học Ngoại thương (FTU): Cơ sở 1 và Cơ sở 2, điểm chuẩn ngành Logistics luôn dẫn đầu toàn quốc, dao động từ 27.8 - 28.2 điểm.
  + Đại học Kinh tế Quốc dân (NEU): Điểm chuẩn khoảng 27.4 - 27.9 điểm.
  + Đại học Giao thông Vận tải TPHCM (UT-HCMC) hoặc Đại học Bách khoa TPHCM (HCMUT): Khối kỹ thuật logistics, điểm chuẩn từ 25.0 - 26.5 điểm.

5. Khối Truyền Thông Đa Phương Tiện & Thiết Kế Game (Multimedia & Game Design):
- Đặc trưng: Sáng tạo nội dung số, kỹ xảo điện ảnh, thiết kế gameplay, xây dựng cốt truyện và đồ họa tương tác. Cần sự cân bằng tuyệt đối giữa tư duy mỹ thuật nghệ thuật ứng dụng và kỹ thuật công cụ máy tính.
- Các trường đào tạo cốt lõi & Điểm chuẩn:
  + Học viện Công nghệ Bưu chính Viễn thông (PTIT): Ngành Truyền thông đa phương tiện và Công nghệ đa phương tiện (hướng thiết kế Game), cơ sở Hà Nội lấy từ 25.8 - 26.6 điểm, cơ sở TPHCM lấy từ 24.2 - 25.2 điểm.
  + Đại học Sư phạm Kỹ thuật TPHCM (HCMUTE): Ngành Truyền thông đa phương tiện, điểm chuẩn khoảng 25.2 - 26.0 điểm.
  + Đại học FPT & Đại học RMIT: Xét tuyển theo học bạ, chứng chỉ IELTS (RMIT yêu cầu IELTS từ 6.5 trở lên, FPT yêu cầu xếp hạng SchoolRank top 30% hoặc điểm thi THPT tương đương 21-23 điểm).

6. Khối Y Đa Khoa & Dược Học - Đỉnh cao rào cản chuyên môn:
- Đặc trưng: Thời gian học kéo dài (6 năm với Y, 5 năm với Dược), lượng kiến thức khổng lồ. Bền vững tuyệt đối trước tự động hóa.
- Các trường đào tạo cốt lõi & Điểm chuẩn:
  + Đại học Y Hà Nội (HMU): Ngành Y khoa luôn giữ vị thế độc tôn với mức điểm từ 27.5 - 28.9 điểm.
  + Đại học Y Dược TPHCM (UMP): Y khoa lấy từ 27.2 - 28.0 điểm, ngành Dược học lấy từ 24.8 - 25.8 điểm.
  + Khoa Y - ĐHQG TPHCM (Đại học Sức khỏe): Điểm chuẩn Y khoa dao động khoảng 26.5 - 27.2 điểm.
  + Đại học Y Dược Cần Thơ (CTUMP): Điểm chuẩn Y khoa khoảng 25.2 - 26.0 điểm, Dược học khoảng 24.5 - 25.0 điểm.

7. Khối Tâm Lý Học (Lâm sàng, Tội phạm và Tổ chức):
- Đặc trưng: Nghiên cứu hành vi, tư duy con người, điều trị tổn thương tinh thần hoặc tối ưu hóa nhân sự doanh nghiệp. Ngành có chỉ số EQ leo thang.
- Các trường đào tạo cốt lõi & Điểm chuẩn:
  + Đại học Khoa học Xã hội và Nhân văn - ĐHQG Hà Nội (USSH-VNU): Điểm chuẩn khối C00 ngành này cực kỳ khắc nghiệt, thường rơi vào khoảng 27.5 - 28.5 điểm.
  + Đại học Khoa học Xã hội và Nhân văn - ĐHQG TPHCM (USSH-HCM): Khối D01/C00 dao động từ 25.8 - 27.0 điểm.
  + Đại học Sư phạm TPHCM (HCMUE): Điểm chuẩn ngành Tâm lý học giáo dục/Tâm lý học khoảng 25.5 - 26.5 điểm.

MẸO TƯ VẤN CHO AI KHI PHÂN TÍCH:
- Nếu học sinh giỏi Toán/Lý/Tin -> Định hướng nhóm 1 (Vi mạch) hoặc nhóm 2 (AI/Data).
- Nếu học sinh thích công nghệ nhưng giỏi giao tiếp, kinh tế -> Định hướng nhóm 3 (Fintech) hoặc nhóm 4 (Logistics số).
- Nếu học sinh có tư duy nghệ thuật, thích cày game/vẽ -> Định hướng nhóm 5 (Multimedia/Game Design).
- Điểm thi dưới 21 điểm: Ưu tiên các trường đại học địa phương, hệ chất lượng cao, hoặc xét học bạ vào các trường tư thục uy tín. Điểm thi từ 21 - 24 điểm: Chọn các ngành ngách ở trường top giữa (Bưu chính, Giao thông vận tải, Công nghiệp). Điểm thi trên 25 điểm: Tự tin nộp hồ sơ vào các trường đại học top đầu (Bách khoa, Ngoại thương, Kinh tế quốc dân, Y Dược)."""

# ========== ROUTES ==========
@app.route('/')
@app.route('/index.html')
def home():
    return send_file('index.html')

@app.route('/todo/mylist.html')
def mylist():
    return send_file('todo/mylist.html')

@app.route('/schedule/create.html')
def schedule_create():
    return send_file('schedule/create.html')

@app.route('/career/chat.html')
def career_page():
    return send_file('career/chat.html')

# ========== SERVING STATIC FILES ==========
@app.route('/style.css')
def serve_css():
    return send_file('style.css')
@app.route('/script.js')
def serve_js():
    return send_file('script.js')
@app.route('/todo/mylist.css')
def serve_mylist_css():
    return send_file('todo/mylist.css')
@app.route('/todo/mylist.js')
def serve_mylist_js():
    return send_file('todo/mylist.js')
@app.route('/schedule/create.css')
def serve_create_css():
    return send_file('schedule/create.css')
@app.route('/schedule/create.js')
def serve_create_js():
    return send_file('schedule/create.js')
@app.route('/career/chat.css')
def serve_chat_css():
    return send_file('career/chat.css')
@app.route('/career/chat.js')
def serve_chat_js():
    return send_file('career/chat.js')

# ========== API SCHEDULE (giữ nguyên) ==========
@app.route('/schedule/generate', methods=['POST'])
def schedule_generate():
    from schedule.schedule_utils import create_timetable
    data = request.json
    subjects = data.get('subjects', [])
    availability = data.get('availability', {})
    breaks = data.get('breaks', [])
    special_req = data.get('special_requirements', '')
    timetable = create_timetable(subjects, availability, breaks, special_req)
    return jsonify({'success': True, 'timetable': timetable})

@app.route('/schedule/ai-schedule', methods=['POST'])
def ai_schedule():
    data = request.json
    user_text = data.get('text', '')
    subjects = data.get('subjects', [])
    disabled_days = data.get('disabledDays', [False]*7)

    if not subjects:
        return jsonify({'success': False, 'error': 'Chưa có môn học nào'})

    subject_list = ', '.join([f"{s['name']} ({s['sessions']} tiết)" for s in subjects])
    days_vn = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    disabled_names = [days_vn[i] for i, d in enumerate(disabled_days) if d]
    disabled_str = ', '.join(disabled_names) if disabled_names else "không có"
    time_slots = ["07:00", "07:45", "08:30", "09:15", "10:00", "10:45",
                  "13:00", "13:45", "14:30", "15:15", "16:00", "16:45"]
    morning_slots = [t for t in time_slots if int(t[:2]) < 12]
    afternoon_slots = [t for t in time_slots if int(t[:2]) >= 13]

    prompt = f"""Bạn là trợ lý xếp thời khóa biểu chính xác. Yêu cầu:
{user_text}

Danh sách môn học và số tiết cần xếp:
{subject_list}

Các ngày bị cấm: {disabled_str}
Buổi sáng: {', '.join(morning_slots)}
Buổi chiều: {', '.join(afternoon_slots)}

QUY TẮC: Nếu yêu cầu "môn X vào ngày Y buổi Z" thì CHỈ xếp môn X vào đúng ngày Y buổi Z.
Xuất JSON duy nhất:
{{
  "timetable": {{
    "Thứ 2": [{{"start": "07:00", "subject": "Toán"}}],
    ...
  }}
}}"""
    try:
        messages = [{"role": "user", "content": prompt}]
        raw = generate_with_groq(messages)
        if raw.startswith("```json"): raw = raw[7:]
        if raw.endswith("```"): raw = raw[:-3]
        raw = raw.strip()
        result = json.loads(raw)
        timetable = result.get('timetable', {})
        if not isinstance(timetable, dict) or len(timetable) == 0:
            raise ValueError("Empty")
        return jsonify({'success': True, 'timetable': timetable})
    except Exception as e:
        # Fallback lịch mẫu
        fallback = {}
        idx = 0
        slots = ["07:00","07:45","08:30","09:15","10:00","10:45","13:00","13:45","14:30","15:15","16:00","16:45"]
        total = sum(s['sessions'] for s in subjects)
        for day in days_vn:
            if day in disabled_names:
                fallback[day] = []
            else:
                items = []
                for _ in range(min(2, total - idx)):
                    if idx < total:
                        sub = subjects[idx % len(subjects)]
                        items.append({"start": slots[idx % len(slots)], "subject": sub['name']})
                        idx += 1
                fallback[day] = items
        return jsonify({'success': True, 'timetable': fallback, 'warning': 'AI tạm thời không khả dụng, dùng lịch mẫu'})

# ========== CAREER AI (CÓ NHỚ LỊCH SỬ) - ĐÃ TÍCH HỢP PROMPT CHUẨN ==========
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    data = request.json
    user_message = data.get('message', '')
    session_id = data.get('session_id')

    if not session_id:
        session_id = str(uuid.uuid4())

    # Lấy lịch sử của session
    history = conversation_store.get(session_id, [])

    if not user_message:
        return jsonify({'success': False, 'error': 'Tin nhắn trống'})

    # Xây dựng messages: system (prompt chuẩn) + lịch sử + tin nhắn mới
    messages = [{"role": "system", "content": STUDYVERSE_SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    # Gọi AI
    reply = generate_with_groq(messages)

    # Cập nhật lịch sử
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": reply})
    conversation_store[session_id] = history

    return jsonify({'success': True, 'reply': reply, 'session_id': session_id})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
