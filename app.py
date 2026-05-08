from flask import Flask, render_template, request, jsonify, send_file
import json
import random
import os
import re
from groq import Groq

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='')

# ========== CẤU HÌNH GROQ API ==========
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("⚠️  Cảnh báo: Chưa có biến môi trường GROQ_API_KEY. AI sẽ không hoạt động.")
    groq_client = None
else:
    groq_client = Groq(api_key=GROQ_API_KEY)

def generate_with_groq(prompt, system_instruction=None):
    if not groq_client:
        return "Xin lỗi, tính năng AI chưa được cấu hình. Vui lòng thử lại sau."
    try:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        # Sử dụng model mới được hỗ trợ (thay thế mixtral-8x7b-32768)
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile",  # hoặc "llama-3.1-8b-instant"
            temperature=0.7,
            max_tokens=1024,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print("Groq API error:", e)
        return f"Xin lỗi, tôi đang gặp sự cố kỹ thuật. Chi tiết: {str(e)}"

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

# ========== API SCHEDULE ==========
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
        raw = generate_with_groq(prompt)
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

# ========== CAREER AI ==========
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    data = request.json
    user_message = data.get('message', '')
    if not user_message:
        return jsonify({'success': False, 'error': 'Tin nhắn trống'})

    system_instruction = (
        "Bạn là chuyên gia tuyển sinh StudyVerse - một trang web do học sinh và vì học sinh. Tư vấn chọn ngành, chọn trường "
        "và hướng nghiệp tại Việt Nam. Trả lời bằng tiếng Việt, thân thiện, chi tiết, "
        "ngắn gọn nhưng đầy đủ thông tin."
        "hãy cư xử giống 1 con người với các lập luận và số liệu nếu có"
        "hãy hỏi người dùng thêm nếu còn khá mong lung với các quyết định"
        "phân tích thị trường hiện nay và các trường và điểm chuẩn nếu người dùng cần biết về ngành và nhóm ngành gần nơi họ(có thể hỏi về tỉnh thành)"
        "muốn giống con người thì hỏi từ tốn thôi, khuyến khích 1 đến 2 câu hỏi 1 lần"
    )
    try:
        reply = generate_with_groq(user_message, system_instruction=system_instruction)
        return jsonify({'success': True, 'reply': reply})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
