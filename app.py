from flask import Flask, render_template, request, jsonify, send_file
import json
import random
import google.generativeai as genai
import os
import re

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')

# ========== CẤU HÌNH GEMINI API ==========
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_REAL_API_KEY_HERE")  # <-- THAY KEY THẬT
genai.configure(api_key=GEMINI_API_KEY)

def get_working_model():
    """Thử các tên model khác nhau, trả về model đầu tiên hoạt động"""
    model_names = [
        'models/gemini-1.5-flash',
        'models/gemini-1.5-pro',
        'models/gemini-pro',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
    ]
    for name in model_names:
        try:
            model = genai.GenerativeModel(name)
            # Thử generate một câu đơn giản để kiểm tra
            model.generate_content("test")
            print(f"✅ Model hoạt động: {name}")
            return name
        except Exception as e:
            print(f"❌ Model {name} lỗi: {e}")
    # Nếu không có model nào, dùng gemini-pro với fallback
    print("⚠️ Không tìm thấy model Gemini, sẽ dùng fallback rule-based")
    return None

WORKING_MODEL_NAME = get_working_model()

def generate_with_fallback(prompt, system_instruction=None):
    """Gọi Gemini nếu có model, không thì trả về phản hồi mẫu"""
    if WORKING_MODEL_NAME is None:
        return "Xin lỗi, tính năng AI đang được cập nhật. Vui lòng thử lại sau."
    try:
        if system_instruction:
            model = genai.GenerativeModel(WORKING_MODEL_NAME, system_instruction=system_instruction)
        else:
            model = genai.GenerativeModel(WORKING_MODEL_NAME)
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Gemini error: {e}")
        return "Xin lỗi, AI tạm thời bận. Vui lòng thử lại sau."

# ========== ROUTES STATIC ==========
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

# CSS, JS
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

# ========== API ==========
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

Các ngày bị cấm:
{disabled_str}

Khung giờ:
- Sáng: {', '.join(morning_slots)}
- Chiều: {', '.join(afternoon_slots)}

Hãy xuất JSON timetable theo cấu trúc:
{{
  "timetable": {{
    "Thứ 2": [{{"start": "07:00", "subject": "Toán"}}, ...],
    ...
  }}
}}
Chỉ JSON, không giải thích.
"""

    try:
        raw = generate_with_fallback(prompt)
        # Lấy JSON từ response
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not match:
            raise ValueError("Không tìm thấy JSON")
        raw = match.group()
        result = json.loads(raw)
        timetable = result.get('timetable', {})
        return jsonify({'success': True, 'timetable': timetable})
    except Exception as e:
        return jsonify({'success': False, 'error': f'AI xử lý lỗi: {str(e)}'})

@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    try:
        data = request.json
        user_message = data.get('message', '')
        if not user_message:
            return jsonify({'success': False, 'error': 'Tin nhắn trống'})
        system_instruction = (
            "Bạn là chuyên gia tuyển sinh StudyVerse. Tư vấn chọn ngành, chọn trường "
            "và hướng nghiệp tại Việt Nam. Trả lời bằng tiếng Việt, thân thiện, chi tiết."
        )
        reply = generate_with_fallback(user_message, system_instruction=system_instruction)
        return jsonify({'success': True, 'reply': reply})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
