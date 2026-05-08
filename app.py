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
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "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")
groq_client = Groq(api_key=GROQ_API_KEY)

def generate_with_groq(prompt, system_instruction=None):
    """Gọi Groq API với fallback nếu lỗi"""
    try:
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})
        
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model="llama-3.1-70b-versatile",  # Có thể đổi thành "mixtral-8x7b-32768" hoặc "llama3-8b-8192"
            temperature=0.7,
            max_tokens=1024,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print("Groq API error:", e)
        return "Xin lỗi, tôi đang gặp sự cố kỹ thuật. Vui lòng thử lại sau."

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

Các ngày bị cấm hoàn toàn (không được xếp bất kỳ môn nào):
{disabled_str}

Các khung giờ có sẵn mỗi ngày (nếu ngày không bị cấm):
- Buổi sáng: {', '.join(morning_slots)}
- Buổi chiều: {', '.join(afternoon_slots)}

QUY TẮC TUÂN THỦ NGHIÊM NGẶT:
1. Phải phân tích yêu cầu của người dùng: nếu yêu cầu "môn X vào ngày Y buổi Z" thì CHỈ xếp môn X vào đúng ngày Y và đúng buổi Z, không xếp môn X vào ngày khác.
2. Ví dụ: "thứ 6 học tin vào buổi sáng" => chỉ xếp Tin học vào các khung giờ buổi sáng của Thứ 6, không xếp Tin vào Thứ 2,3,4,5,7,CN.
3. Các môn còn lại (không có yêu cầu đặc biệt) có thể xếp vào bất kỳ ngày nào còn trống (ưu tiên buổi sáng trước, sau đó buổi chiều), miễn không trùng với ngày bị cấm.
4. Mỗi tiết học chiếm một khung giờ. Đảm bảo tổng số tiết của mỗi môn bằng đúng số tiết yêu cầu.
5. Xuất JSON theo đúng cấu trúc, không thêm giải thích.

Cấu trúc JSON:
{{
  "timetable": {{
    "Thứ 2": [{{"start": "07:00", "subject": "Toán"}}, ...],
    "Thứ 3": [...],
    "Thứ 4": [...],
    "Thứ 5": [...],
    "Thứ 6": [...],
    "Thứ 7": [...],
    "Chủ nhật": [...]
  }}
}}

Hãy trả về JSON duy nhất."""

    try:
        raw = generate_with_groq(prompt)
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        result = json.loads(raw)
        timetable = result.get('timetable', {})
        if not isinstance(timetable, dict) or len(timetable) == 0:
            raise ValueError("Empty or invalid timetable")
        return jsonify({'success': True, 'timetable': timetable})
    except Exception as e:
        # Fallback: tạo lịch mẫu nếu AI lỗi
        fallback_timetable = {}
        lesson_idx = 0
        time_slots = ["07:00","07:45","08:30","09:15","10:00","10:45","13:00","13:45","14:30","15:15","16:00","16:45"]
        total_lessons = sum([s['sessions'] for s in subjects])
        for day in days_vn:
            if day in disabled_names:
                fallback_timetable[day] = []
            else:
                slots = []
                for _ in range(min(total_lessons, len(time_slots))):
                    if lesson_idx < len(time_slots) and lesson_idx < total_lessons:
                        sub = subjects[lesson_idx % len(subjects)]
                        slots.append({"start": time_slots[lesson_idx], "subject": sub['name']})
                        lesson_idx += 1
                fallback_timetable[day] = slots
        return jsonify({'success': True, 'timetable': fallback_timetable, 'warning': 'AI lỗi, dùng lịch mẫu'})

# ========== CAREER AI (DÙNG GROQ) ==========
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    data = request.json
    user_message = data.get('message', '')
    if not user_message:
        return jsonify({'success': False, 'error': 'Tin nhắn trống'})

    system_instruction = (
        "Bạn là chuyên gia tuyển sinh StudyVerse. Tư vấn chọn ngành, chọn trường "
        "và hướng nghiệp tại Việt Nam. Trả lời bằng tiếng Việt, thân thiện, chi tiết, "
        "phù hợp với học sinh trung học."
    )
    try:
        reply = generate_with_groq(user_message, system_instruction=system_instruction)
        return jsonify({'success': True, 'reply': reply})
    except Exception as e:
        return jsonify({'success': True, 'reply': "Cảm ơn bạn! Hiện tại tôi đang được nâng cấp. Vui lòng thử lại sau. (Lỗi: " + str(e) + ")"})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
