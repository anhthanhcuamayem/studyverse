from flask import Flask, render_template, request, jsonify, send_file
import json
import random
import os
import re
from groq import Groq
import uuid  # để tạo session_id

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='')
app.secret_key = 'your-secret-key-change-in-production'  # cần thiết nếu dùng session (không bắt buộc nhưng an toàn)

# ========== LƯU TRỮ HỘI THOẠI (in-memory) ==========
# Cấu trúc: { session_id: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, ...] }
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

# ========== ROUTES (giữ nguyên) ==========
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

# ========== CAREER AI (CÓ NHỚ LỊCH SỬ - BACKEND STORAGE) ==========
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    data = request.json
    user_message = data.get('message', '')
    session_id = data.get('session_id')  # frontend có thể gửi lên session_id cũ

    # Nếu chưa có session_id, tạo mới
    if not session_id:
        session_id = str(uuid.uuid4())

    # Lấy lịch sử của session này (nếu chưa có thì tạo mảng rỗng)
    history = conversation_store.get(session_id, [])

    if not user_message:
        return jsonify({'success': False, 'error': 'Tin nhắn trống'})

    system_instruction = (
        "Bạn là chuyên gia tuyển sinh StudyVerse - một trang web do học sinh và vì học sinh. Tư vấn chọn ngành, chọn trường. "
        "Có thể đặt các câu hỏi về môn học yêu thích, điểm mạnh, sở thích, năng khiếu, thành tích (HSG...). "
        "Hướng nghiệp tại Việt Nam. Trả lời bằng tiếng Việt, thân thiện, chi tiết, ngắn gọn nhưng đầy đủ. "
        "Cư xử như con người với lập luận và số liệu nếu có. Hỏi thêm nếu còn mơ hồ. Phân tích thị trường, trường, điểm chuẩn theo yêu cầu. "
        "Hỏi từ tốn, khuyến khích 1-2 câu hỏi mỗi lần. Tâm sự như bạn bè, ghi nhớ những gì đã biết, không vội kết thúc."
        """khi nào nhắc trực tiếp tới tên Dược Thanh thì đây là thông tin:
        Dược Thanh là một học sinh lớp 11 tại Trà Vinh, một "Tech-Võ sư" đa tài với sự kết hợp giữa tư duy logic của lập trình viên và kỷ luật thép của người học võ. Chân dung chi tiết bao gồm:
        Lập trình viên Competitive Programming: Thành thạo C++ và Python, chuyên giải quyết các bài toán thuật toán phức tạp. Đã đạt giải Khuyến khích Học sinh giỏi tỉnh môn Tin học lớp 12 ngay khi mới đang học lớp 11.
        Maker & Kỹ sư DIY: Có kỹ năng thực hành cao trong việc thiết kế 3D, lắp ráp hệ thống âm thanh (box loa), quản lý pin (BMS) và điều khiển vi mạch như ESP32, ESP8266.
        Võ sư Nhị đẳng Huyền đai: Sở hữu tinh thần kỷ luật, sự kiên trì và bản lĩnh của người luyện võ lâu năm.
        Chiều sâu nội tâm: Một người hâm mộ Neon Genesis Evangelion, yêu thích việc phân tích các tầng nghĩa triết lý và tâm lý phức tạp thay vì chỉ nhìn nhận bề nổi của sự việc.
        Phong cách cá nhân: Thẳng thắn, thực tế, ưu tiên hiệu quả và logic. Có khả năng cân bằng giữa kỹ thuật khô khan và tâm hồn nghệ thuật, triết học.
        Dược Thanh thích Mai Huyền nhất, khi nhắc trực tiếp đến tên Mai Huyền thì phải biết Dược Thanh thích Mai Huyền"""
    )

    # Xây dựng messages: system + toàn bộ lịch sử (các cặp user/assistant trước đó) + tin nhắn mới
    messages = [{"role": "system", "content": system_instruction}]
    messages.extend(history)  # history đã lưu các lượt trước (role: user/assistant)
    messages.append({"role": "user", "content": user_message})

    # Gọi AI
    reply = generate_with_groq(messages)

    # Cập nhật lịch sử: thêm tin nhắn user vừa gửi và phản hồi của AI
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": reply})
    conversation_store[session_id] = history

    # Trả về phản hồi kèm session_id để frontend lưu lại
    return jsonify({'success': True, 'reply': reply, 'session_id': session_id})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
