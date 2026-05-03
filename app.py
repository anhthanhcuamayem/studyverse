from flask import Flask, render_template, request, jsonify, send_file
import json
import random
import google.generativeai as genai
import os

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='/')

# Cấu hình Gemini API (lấy key từ biến môi trường)
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'YOUR_API_KEY_HERE')
if GEMINI_API_KEY != 'YOUR_API_KEY_HERE':
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-flash')
else:
    model = None
    print("Warning: GEMINI_API_KEY not set. AI scheduling will use fallback.")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/mylist')
def mylist():
    return render_template('index.html')

@app.route('/create')
def create():
    return render_template('index.html')

# ========== SCHEDULE ==========
@app.route('/schedule/create')
def schedule_create():
    return send_file('schedule/create.html')

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

# ========== AI SCHEDULE ENDPOINT (CHỈ MỘT LẦN) ==========
@app.route('/schedule/ai-schedule', methods=['POST'])
def ai_schedule():
    data = request.json
    text = data.get('text', '')
    subjects = data.get('subjects', [])
    disabled_days = data.get('disabledDays', [False]*7)
    
    # Chuẩn bị danh sách môn học
    subject_list = ', '.join([f"{s['name']} ({s['sessions']} tiết)" for s in subjects])
    disabled_list = [i for i, d in enumerate(disabled_days) if d]
    
    if model is None:
        # Fallback: xếp lịch ngẫu nhiên
        from schedule.schedule_utils import create_timetable
        availability = {}
        for day in range(7):
            if not disabled_days[day]:
                availability[str(day)] = [{"start": "07:00", "end": "17:00"}]
        timetable = create_timetable(subjects, availability, [])
        return jsonify({'success': True, 'timetable': timetable})
    
    prompt = f"""Bạn là trợ lý xếp thời khóa biểu. Dựa vào yêu cầu sau:
"{text}"
Danh sách môn học: {subject_list}
Các ngày không học (disabled): {disabled_list} (0=Thứ2,1=Thứ3,...6=Chủ nhật)
Hãy xuất ra một lịch học hợp lý dưới dạng JSON với cấu trúc:
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
Chỉ xuất JSON, không giải thích. Mỗi tiết học kéo dài 45 phút, bắt đầu từ 7:00, 7:45, 8:30, 9:15, 10:00, 10:45, 13:00, 13:45, 14:30, 15:15, 16:00, 16:45. Đảm bảo mỗi môn đủ số tiết, ưu tiên sắp xếp theo yêu cầu."""
    
    try:
        response = model.generate_content(prompt)
        result_text = response.text.strip()
        # Loại bỏ markdown json nếu có
        if result_text.startswith('```json'):
            result_text = result_text[7:]
        if result_text.endswith('```'):
            result_text = result_text[:-3]
        result = json.loads(result_text)
        timetable = result.get('timetable', {})
        return jsonify({'success': True, 'timetable': timetable})
    except Exception as e:
        print("AI error:", e)
        # Fallback nếu AI lỗi
        from schedule.schedule_utils import create_timetable
        availability = {}
        for day in range(7):
            if not disabled_days[day]:
                availability[str(day)] = [{"start": "07:00", "end": "17:00"}]
        timetable = create_timetable(subjects, availability, [])
        return jsonify({'success': True, 'timetable': timetable, 'warning': 'AI failed, used random schedule'})

if __name__ == '__main__':
    app.run(debug=True)
