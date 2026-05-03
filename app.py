from flask import Flask, render_template, request, jsonify, send_file
import json
import random
import google.generativeai as genai
import os

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='/')

# Cấu hình Gemini API (thay bằng API key của bạn)
# Lấy key từ biến môi trường hoặc điền trực tiếp (không khuyến khích)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE")
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/mylist')
def mylist():
    return render_template('index.html')

@app.route('/create')
def create():
    return render_template('index.html')

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

# ========== AI SCHEDULE ENDPOINT (GEMINI) ==========
@app.route('/schedule/ai-schedule', methods=['POST'])
def ai_schedule():
    data = request.json
    user_text = data.get('text', '')
    subjects = data.get('subjects', [])
    disabled_days = data.get('disabledDays', [False]*7)
    
    if not subjects:
        return jsonify({'success': False, 'error': 'Chưa có môn học nào'})
    
    # Chuẩn bị danh sách môn và ngày nghỉ
    subject_list = ', '.join([f"{s['name']} ({s['sessions']} tiết)" for s in subjects])
    disabled_names = [["Thứ 2","Thứ 3","Thứ 4","Thứ 5","Thứ 6","Thứ 7","Chủ nhật"][i] for i, d in enumerate(disabled_days) if d]
    disabled_str = ', '.join(disabled_names) if disabled_names else "không có"
    
    # Prompt cho Gemini
    prompt = f"""Bạn là trợ lý xếp thời khóa biểu thông minh. Dựa vào yêu cầu sau:
    "{user_text}"
    
    Danh sách môn học: {subject_list}
    Các ngày không được học (nghỉ): {disabled_str}
    
    Hãy xuất ra một lịch học hợp lý dưới dạng JSON duy nhất, không kèm giải thích, với cấu trúc:
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
    Quy tắc:
    - Mỗi tiết học kéo dài 45 phút, bắt đầu lúc 7:00, 7:45, 8:30, 9:15, 10:00, 10:45, 13:00, 13:45, 14:30, 15:15, 16:00, 16:45.
    - Chỉ xếp vào các khung giờ trên.
    - Ưu tiên tuyệt đối theo yêu cầu của người dùng (ví dụ: "Tin học vào thứ 6 buổi sáng" thì phải xếp Tin học vào sáng thứ 6).
    - Đảm bảo mỗi môn đủ số tiết theo danh sách.
    - Nếu không thể đáp ứng chính xác, hãy cố gắng gần nhất và xếp các tiết còn lại vào các ngày khác.
    """
    
    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Lọc lấy phần JSON (bỏ markdown nếu có)
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        result = json.loads(raw)
        timetable = result.get('timetable', {})
        # Kiểm tra tính hợp lệ cơ bản
        if not isinstance(timetable, dict):
            raise ValueError("Invalid timetable format")
        return jsonify({'success': True, 'timetable': timetable})
    except Exception as e:
        # Fallback: dùng rule-based nếu Gemini lỗi
        from schedule.schedule_utils import create_timetable_with_preferences
        # Phân tích sơ bộ preferences từ user_text
        preferences = extract_preferences_from_text(user_text, subjects)
        availability = {}
        default_slots = [{"start": "07:00", "end": "17:00"}]
        for day in range(7):
            if not disabled_days[day]:
                availability[str(day)] = default_slots
        try:
            timetable = create_timetable_with_preferences(subjects, availability, [], preferences)
        except:
            # fallback cuối
            from schedule.schedule_utils import create_timetable
            timetable = create_timetable(subjects, availability, [])
        return jsonify({'success': True, 'timetable': timetable, 'warning': f'Gemini lỗi, dùng rule-based: {str(e)}'})

def extract_preferences_from_text(text, subjects):
    """Hàm đơn giản trích xuất ưu tiên từ văn bản (fallback)"""
    preferences = {'preferred_slots': [], 'avoid_days': [], 'subject_preferences': {}}
    text_lower = text.lower()
    if 'sáng' in text_lower or 'buổi sáng' in text_lower:
        preferences['preferred_slots'].append('morning')
    if 'chiều' in text_lower or 'buổi chiều' in text_lower:
        preferences['preferred_slots'].append('afternoon')
    day_map = {'thứ 2':0, 'thứ 3':1, 'thứ 4':2, 'thứ 5':3, 'thứ 6':4, 'thứ 7':5, 'chủ nhật':6}
    for day_vn, idx in day_map.items():
        if f'tránh {day_vn}' in text_lower or f'không học {day_vn}' in text_lower:
            preferences['avoid_days'].append(idx)
    # Ưu tiên môn theo buổi
    import re
    for subj in subjects:
        name = subj['name'].lower()
        if re.search(rf'{name}.*sáng', text_lower):
            preferences['subject_preferences'][subj['name']] = 'morning'
        elif re.search(rf'{name}.*chiều', text_lower):
            preferences['subject_preferences'][subj['name']] = 'afternoon'
    return preferences

if __name__ == '__main__':
    app.run(debug=True)
