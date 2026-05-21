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

def generate_with_groq(messages):
    """Gửi danh sách messages (có thể có system + user) lên Groq."""
    if not groq_client:
        return None
    try:
        chat_completion = groq_client.chat.completions.create(
            messages=messages,
            model="llama-3.1-70b-versatile",
            temperature=0.5,  # giảm nhiệt độ để kết quả ổn định hơn
            max_tokens=2048,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print("Groq API error:", e)
        return None

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

    # Chuẩn bị dữ liệu
    subject_list = ', '.join([f"{s['name']} ({s['sessions']} tiết)" for s in subjects])
    days_vn = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    disabled_names = [days_vn[i] for i, d in enumerate(disabled_days) if d]
    disabled_str = ', '.join(disabled_names) if disabled_names else "không có"

    time_slots = ["07:00", "07:45", "08:30", "09:15", "10:00", "10:45",
                  "13:00", "13:45", "14:30", "15:15", "16:00", "16:45"]
    morning_slots = [t for t in time_slots if int(t[:2]) < 12]
    afternoon_slots = [t for t in time_slots if int(t[:2]) >= 13]

    # Prompt chi tiết, yêu cầu AI trả về JSON thuần
    prompt = f"""Bạn là trợ lý xếp thời khóa biểu thông minh. Hãy phân tích yêu cầu sau bằng tiếng Việt:
"{user_text}"

Danh sách môn học cần xếp (mỗi môn có số tiết):
{subject_list}

Các ngày bị cấm (không xếp bất kỳ môn nào): {disabled_str}
Khung giờ mỗi ngày (nếu ngày không bị cấm):
- Buổi sáng: {', '.join(morning_slots)}
- Buổi chiều: {', '.join(afternoon_slots)}

Yêu cầu: Xuất ra JSON duy nhất với cấu trúc:
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

Lưu ý:
- Tên các ngày phải đúng: "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật".
- start phải là một trong các mốc giờ đã cho.
- Mỗi tiết chỉ một môn, không trùng lặp trong cùng khung giờ của một ngày.
- Đảm bảo tổng số tiết của mỗi môn bằng đúng số tiết yêu cầu.
- Nếu yêu cầu nói rõ "môn X vào ngày Y buổi Z", hãy ưu tiên xếp đúng.
- Trả về JSON hợp lệ, không thêm bất kỳ văn bản hay giải thích nào khác."""

    messages = [{"role": "user", "content": prompt}]
    raw = generate_with_groq(messages)
    
    if not raw:
        return jsonify({'success': False, 'error': 'AI không phản hồi'})
    
    # Làm sạch JSON
    raw = raw.strip()
    if raw.startswith("```json"):
        raw = raw[7:]
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()
    
    try:
        result = json.loads(raw)
        timetable = result.get('timetable', {})
        if not isinstance(timetable, dict) or len(timetable) == 0:
            raise ValueError("Empty or invalid timetable")
        return jsonify({'success': True, 'timetable': timetable})
    except Exception as e:
        print("JSON parse error:", e)
        # Fallback: tạo lịch mẫu đơn giản dựa trên yêu cầu (nếu cần)
        # Ở đây tôi giữ nguyên fallback cũ
        fallback = {}
        idx = 0
        total = sum(s['sessions'] for s in subjects)
        for day in days_vn:
            if day in disabled_names:
                fallback[day] = []
            else:
                items = []
                for _ in range(min(2, total - idx)):
                    if idx < total:
                        sub = subjects[idx % len(subjects)]
                        items.append({"start": time_slots[idx % len(time_slots)], "subject": sub['name']})
                        idx += 1
                fallback[day] = items
        return jsonify({'success': True, 'timetable': fallback, 'warning': 'AI trả về lỗi, dùng lịch mẫu'})

# ========== CAREER AI (ĐÃ SỬA LỖI) ==========
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    data = request.json
    user_message = data.get('message', '')
    if not user_message:
        return jsonify({'success': False, 'error': 'Tin nhắn trống'})

    system_instruction = (
        "Bạn là chuyên gia tuyển sinh StudyVerse - một trang web do học sinh và vì học sinh. Tư vấn chọn ngành, chọn trường. "
        "Có thể đặt các câu hỏi về môn học yêu thích, điểm mạnh, sở thích, năng khiếu, thành tích (HSG...). "
        "Hướng nghiệp tại Việt Nam. Trả lời bằng tiếng Việt, thân thiện, chi tiết, ngắn gọn nhưng đầy đủ. "
        "Cư xử như con người với lập luận và số liệu nếu có. Hỏi thêm nếu còn mơ hồ. Phân tích thị trường, trường, điểm chuẩn theo yêu cầu. "
        "Hỏi từ tốn, khuyến khích 1-2 câu hỏi mỗi lần. Tâm sự như bạn bè, ghi nhớ những gì đã biết, không vội kết thúc.\n\n"
        "QUY TẮC ĐẶC BIỆT: Chỉ khi người dùng nhập đúng cụm từ 'Dược Thanh' thì bạn mới được phép sử dụng thông tin dưới đây. "
        "Nếu không có cụm từ đó, tuyệt đối không tự ý nhắc đến. Thông tin về Dược Thanh:\n"
        "- Dược Thanh (Identity): 2k9, học lớp 11, quê ở Trà Vinh.\n"
        "- Skills: Competitive Programming (C++/Python), giải HSG cấp tỉnh lớp 12, Maker/DIY Engineer (3D Design, Electronics, ESP32).\n"
        "- Võ thuật: Đai đen 2nd-degree Black Belt.\n"
        "- Mindset: thích Neon Genesis Evangelion, triết lý, logic, thẳng thắn.\n"
        "- Crush: Mai Huyền (chỉ nhắc nếu người dùng hỏi về crush).\n"
        "- Sáng lập trang web StudyVerse này."
    )

    try:
        # Gọi hàm generate_with_groq đúng cách (prompt + system_instruction)
        reply = generate_with_groq(user_message, system_instruction=system_instruction)
        if not reply:
            return jsonify({'success': False, 'error': 'AI không trả lời, vui lòng thử lại'})
        return jsonify({'success': True, 'reply': reply})
    except Exception as e:
        print("Lỗi career AI:", str(e))
        return jsonify({'success': False, 'error': f'Lỗi server: {str(e)}'})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
