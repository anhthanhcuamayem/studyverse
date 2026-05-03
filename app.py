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
    user_text = data.get('text', '').strip()
    subjects = data.get('subjects', [])
    disabled_days = data.get('disabledDays', [False]*7)
    
    if not subjects:
        return jsonify({'success': False, 'error': 'Chưa có môn học nào'})
    
    if not user_text:
        return jsonify({'success': False, 'error': 'Vui lòng nhập yêu cầu'})
    
    # Chuẩn bị danh sách môn học và ngày bị cấm
    subject_list = ', '.join([f"{s['name']} ({s['sessions']} tiết)" for s in subjects])
    weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    disabled_names = [weekdays[i] for i, d in enumerate(disabled_days) if d]
    disabled_str = ', '.join(disabled_names) if disabled_names else "không có"
    
    # Các khung giờ có sẵn
    time_slots = ["07:00", "07:45", "08:30", "09:15", "10:00", "10:45", "13:00", "13:45", "14:30", "15:15", "16:00", "16:45"]
    morning_slots = [t for t in time_slots if int(t[:2]) < 12]
    afternoon_slots = [t for t in time_slots if int(t[:2]) >= 13]
    
    prompt = f"""Bạn là trợ lý xếp thời khóa biểu. Yêu cầu: "{user_text}"
Danh sách môn học: {subject_list}
Ngày bị cấm: {disabled_str}
Các khung giờ có sẵn mỗi ngày (nếu không bị cấm):
- Buổi sáng: {', '.join(morning_slots)}
- Buổi chiều: {', '.join(afternoon_slots)}

QUY TẮC:
1. Phân tích yêu cầu: nếu nói "thứ 3 học tin" thì xếp môn "tin" vào Thứ 3 (có thể buổi sáng hoặc chiều, ưu tiên buổi sáng nếu còn slot).
2. Các môn khác xếp vào các ngày còn lại, đảm bảo đủ số tiết.
3. Không xếp vào ngày bị cấm.
4. Mỗi tiết chiếm một khung giờ, không trùng lặp.

Trả về JSON duy nhất, không giải thích, cấu trúc:
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
"""
    try:
        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Xóa markdown
        if raw.startswith("```json"):
            raw = raw[7:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()
        result = json.loads(raw)
        timetable = result.get('timetable', {})
        if not timetable:
            raise ValueError("Empty timetable")
        return jsonify({'success': True, 'timetable': timetable})
    except Exception as e:
        print("Gemini error:", e)
        # Fallback: tạo lịch đơn giản dựa trên từ khóa
        fallback = create_fallback_timetable(user_text, subjects, disabled_days, weekdays, time_slots)
        if fallback:
            return jsonify({'success': True, 'timetable': fallback, 'warning': 'AI chính xử lý lỗi, dùng fallback'})
        else:
            return jsonify({'success': False, 'error': f'Không thể xếp lịch: {str(e)}'})

def create_fallback_timetable(user_text, subjects, disabled_days, weekdays, time_slots):
    """Hàm fallback đơn giản: tìm môn và ngày theo yêu cầu, xếp lần lượt vào các slot"""
    import re
    result = {day: [] for day in weekdays}
    # Tìm môn và ngày từ text
    subject_names = [s['name'] for s in subjects]
    found_subject = None
    found_day = None
    for sub in subject_names:
        if sub.lower() in user_text.lower():
            found_subject = sub
            break
    for day in weekdays:
        if day.lower() in user_text.lower():
            found_day = day
            break
    # Nếu không tìm thấy, xếp bình thường (ưu tiên ngày đầu)
    if found_subject and found_day:
        day_idx = weekdays.index(found_day)
        if disabled_days[day_idx]:
            # Nếu ngày bị cấm thì thông báo (không xếp được)
            return None
        # Tìm các slot trống (giả sử tất cả slot đều trống, ta chỉ cần xếp đủ số tiết)
        sessions_needed = next((s['sessions'] for s in subjects if s['name'] == found_subject), 0)
        # Lấy các slot buổi sáng hoặc chiều (ưu tiên sáng)
        slots_to_use = time_slots[:sessions_needed]  # lấy n tiết đầu tiên
        for i in range(min(sessions_needed, len(slots_to_use))):
            result[found_day].append({'start': slots_to_use[i], 'subject': found_subject})
        # Cập nhật lại số tiết đã dùng cho môn đó
        # (Trong fallback này ta không cần xử lý phức tạp, chỉ trả về lịch mẫu)
    # Đối với các môn khác, xếp vào các ngày khác (đơn giản)
    # (Có thể bỏ qua hoặc xếp lần lượt)
    return result

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
