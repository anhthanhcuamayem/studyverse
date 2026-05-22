from flask import Flask, render_template, request, jsonify, send_file, session
import json
import random
import os
import re
from groq import Groq

app = Flask(__name__,
            template_folder='.',
            static_folder='.',
            static_url_path='')
app.secret_key = 'your-secret-key-change-in-production'

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
STUDYVERSE_SYSTEM_PROMPT = """Bạn là chuyên gia tuyển sinh StudyVerse (web học sinh). Tư vấn chọn ngành/trường, hỏi thêm về sở thích, điểm mạnh, HSG. Trả lời tiếng Việt, thân thiện, chi tiết ngắn gọn, có số liệu. Khuyến khích 1-2 câu hỏi mỗi lần, tâm sự như bạn bè.

Quy tắc: "Dược" là ngành dược, "Thanh" là tên. Chỉ khi người dùng nhập **'Dược Thanh'** mới được dùng thông tin sau: Dược Thanh (2k9, Trà Vinh, lớp 11), giỏi CP (C++/Python),Khuyến khích HSG tin tỉnh lớp 12 in 11, Maker (3D, ESP32), võ đai đen, thích Evangelion, crush Mai Huyền (nếu hỏi), sáng lập StudyVerse.

**Dữ liệu điểm chuẩn (thang 30, 2024):**
- Vi mạch/Bán dẫn: Bách khoa HN 26.8-27.5; Bách khoa SG 26.5-27.2; UIT 25.5-26.2; HCMUS 25-26.
- AI/Data: Bách khoa HN 28.2-28.9; UET 27.2-27.8; UIT 26.8-27.3; HCMUS 26.2-26.8.
- Fintech: NEU 27-27.6; UEH 26.3-26.9; Học viện Ngân hàng 25.5-26.1; IU 23.5-25.
- Logistics: Ngoại thương 27.8-28.2; NEU 27.4-27.9; GTVT SG/Bách khoa SG 25-26.5.
- Truyền thông/Game: PTIT HN 25.8-26.6, SG 24.2-25.2; HCMUTE 25.2-26; FPT/RMIT học bạ, IELTS 6.5+.
- Y/Dược: Y Hà Nội 27.5-28.9; Y Dược SG Y 27.2-28, Dược 24.8-25.8; Y Cần Thơ 25.2-26, Dược 24.5-25.
- Tâm lý: USSH HN (C00) 27.5-28.5; USSH SG 25.8-27; Sư phạm SG 25.5-26.5.

**Mẹo:** Giỏi Toán/Lý/Tin → Vi mạch hoặc AI/Data. Thích công nghệ + giao tiếp → Fintech/Logistics. Nghệ thuật, game → Truyền thông/Game. Điểm <21 → trường địa phương, chất lượng cao, tư thục. 21-24 → ngành ngách trường top giữa (PTIT, GTVT...). >25 → top đầu (Bách khoa, Ngoại thương, NEU, Y Dược)."""

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

# ========== CAREER AI - DÙNG FLASK SESSION ĐỂ NHỚ LỊCH SỬ ==========
@app.route('/api/career-ai', methods=['POST'])
def career_ai():
    data = request.json
    user_message = data.get('message', '')

    if not user_message:
        return jsonify({'success': False, 'error': 'Tin nhắn trống'})

    # Lấy lịch sử từ session (mỗi trình duyệt riêng)
    history = session.get('chat_history', [])

    # Xây dựng messages: system + lịch sử + tin nhắn mới
    messages = [{"role": "system", "content": STUDYVERSE_SYSTEM_PROMPT}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    # Gọi AI
    reply = generate_with_groq(messages)

    # Cập nhật lịch sử
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": reply})
    session['chat_history'] = history

    return jsonify({'success': True, 'reply': reply})

# (Tuỳ chọn) Route reset lịch sử chat
@app.route('/api/career-reset', methods=['POST'])
def career_reset():
    session.pop('chat_history', None)
    return jsonify({'success': True})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
