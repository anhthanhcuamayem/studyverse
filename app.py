from flask import Flask, render_template, request, jsonify, send_file
import json
import random
import google.generativeai as genai
import os
import re

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='/')

# ========== CẤU HÌNH GEMINI API ==========
# Ưu tiên lấy từ biến môi trường (Render), nếu không có dùng key mặc định (nên thay bằng key thật)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyD7ykdqIuSGVA43RLQp_vZsxfAz7ZbfIP0")
genai.configure(api_key=GEMINI_API_KEY)

def get_model(model_name="gemini-1.5-flash", instruction=None):
    """Khởi tạo model với cơ chế xử lý lỗi tên model hoặc phiên bản thư viện cũ"""
    try:
        full_model_name = f"models/{model_name}" if not model_name.startswith("models/") else model_name
        return genai.GenerativeModel(
            model_name=full_model_name,
            system_instruction=instruction
        )
    except Exception:
        # Fallback về gemini-pro nếu bản flash không tồn tại
        return genai.GenerativeModel(model_name="models/gemini-pro")

# ========== ROUTES CŨ ==========
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

# ========== AI SCHEDULE ENDPOINT (GEMINI) - GIỮ NGUYÊN PROMPT CHI TIẾT ==========
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
    days_vn = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    disabled_names = [days_vn[i] for i, d in enumerate(disabled_days) if d]
    disabled_str = ', '.join(disabled_names) if disabled_names else "không có"

    # Các khung giờ có sẵn
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
        model = get_model("gemini-1.5-flash")
        response = model.generate_content(prompt)
        raw = response.text.strip()
        # Loại bỏ markdown
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
        # Không dùng fallback rule-based để tránh hiểu sai yêu cầu
        return jsonify({'success': False, 'error': f'AI xử lý lỗi: {str(e)}. Vui lòng thử lại với câu lệnh rõ ràng hơn.'})

# ========== CAREER AI (TUYỂN SINH) ==========
@app.route('/career')
def career_page():
    """Trang chat tư vấn nghề nghiệp"""
    return send_file('career/chat.html')

@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    try:
        data = request.json
        user_message = data.get('message', '')
        if not user_message:
            return jsonify({'success': False, 'error': 'Tin nhắn trống'})

        instruction = (
            "Bạn là chuyên gia tuyển sinh StudyVerse. Tư vấn chọn ngành, chọn trường "
            "và hướng nghiệp tại Việt Nam. Trả lời bằng tiếng Việt, thân thiện, chi tiết, "
            "phù hợp với học sinh trung học."
        )
        model = get_model("gemini-1.5-flash", instruction=instruction)
        try:
            response = model.generate_content(user_message)
        except:
            # Fallback nếu system_instruction không được hỗ trợ
            model = get_model("gemini-1.5-flash")
            response = model.generate_content(f"{instruction}\n\nNgười dùng: {user_message}")
        return jsonify({'success': True, 'reply': response.text})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# ========== HÀM PHỤ TRỢ ==========
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
