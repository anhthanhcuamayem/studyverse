import os
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory
from openai import OpenAI

from schedule.schedule_utils import create_timetable_with_preferences

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_FILES = {
    'index.html', 'script.js', 'shared.css', 'style.css', 'pockup.png',
    'career/chat.html', 'career/chat.js', 'career/chat.css',
    'schedule/create.html', 'schedule/create.js', 'schedule/create.css',
    'todo/mylist.html', 'todo/mylist.js', 'todo/mylist.css',
}

# ==================== PHẦN CẤU HÌNH API ====================
# Lấy biến môi trường cho FreeLLMAPI
FREELLM_API_KEY = os.environ.get("FREELLM_API_KEY")
FREELLM_BASE_URL = os.environ.get("FREELLM_BASE_URL", "http://localhost:3001/v1")

client = OpenAI(api_key=FREELLM_API_KEY, base_url=FREELLM_BASE_URL) if FREELLM_API_KEY else None


def get_json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify(error='Dữ liệu JSON không hợp lệ.'), 400)
    return data, None


def request_ai(messages, max_tokens):
    if client is None:
        return None, (jsonify(error='Dịch vụ AI chưa được cấu hình.'), 503)
    try:
        response = client.chat.completions.create(
            model='auto:fast', messages=messages, temperature=0.7, max_tokens=max_tokens
        )
        reply = response.choices[0].message.content
        if not reply:
            raise ValueError('AI provider returned an empty reply')
        return reply, None
    except Exception:
        app.logger.exception('AI provider request failed')
        return None, (jsonify(error='Dịch vụ AI hiện không phản hồi. Vui lòng thử lại sau.'), 502)
 
# ==================== PHẦN SERVE FILE TĨNH ====================
@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Chỉ public các static assets cần thiết, không lộ source hay dữ liệu người dùng.
    if path not in PUBLIC_FILES:
        abort(404)
    return send_from_directory(BASE_DIR, path)

# ==================== PHẦN AI CAREER ====================
@app.route('/api/career-ai', methods=['POST'])
def career_chat():
    try:
        data, error = get_json_body()
        if error:
            return error
        user_message = data.get('message', '')
        history = data.get('history', [])
        
        if not isinstance(user_message, str) or not user_message.strip():
            return jsonify({'success': False, 'error': 'Vui lòng nhập nội dung cần tư vấn'}), 400
        if len(user_message) > 2000 or not isinstance(history, list):
            return jsonify({'success': False, 'error': 'Nội dung gửi lên không hợp lệ'}), 400
        
        # Build messages array with conversation history
        messages = [
            {"role": "system", "content": "Bạn là một chuyên gia tư vấn hướng nghiệp cho học sinh. Hãy trả lời câu hỏi một cách chi tiết, thực tế và dễ hiểu."}
        ]
        
        # Add conversation history if provided
        for msg in history[-20:]:
            if not isinstance(msg, dict):
                continue
            content = msg.get('content')
            if msg.get('role') in ('user', 'assistant') and isinstance(content, str) and content.strip():
                messages.append({"role": msg['role'], "content": content[:2000]})
        
        # Add current user message
        messages.append({"role": "user", "content": user_message.strip()})
        
        # Gọi FreeLLMAPI
        ai_reply, error = request_ai(messages, 500)
        if error:
            return error
        return jsonify({'success': True, 'reply': ai_reply})
    except Exception:
        app.logger.exception('Invalid career AI request')
        return jsonify({'success': False, 'error': 'Yêu cầu không thể xử lý.'}), 500

# ==================== PHẦN GỢI Ý HỌC TẬP (NẾU CÓ) ====================
@app.route('/api/suggest', methods=['POST'])
def suggest_study():
    try:
        data, error = get_json_body()
        if error:
            return error
        topic = data.get('topic', '')
        
        if not isinstance(topic, str) or not topic.strip() or len(topic) > 1000:
            return jsonify({'error': 'Vui lòng nhập chủ đề cần tư vấn'}), 400
        
        # Gọi FreeLLMAPI
        ai_suggestion, error = request_ai([
            {"role": "system", "content": "Bạn là một người hướng dẫn học tập, hãy đưa ra các phương pháp học hiệu quả cho chủ đề được hỏi."},
            {"role": "user", "content": f"Hãy gợi ý cách học tốt môn/chủ đề: {topic.strip()}"}
        ], 600)
        if error:
            return error
        return jsonify({'suggestion': ai_suggestion})
    except Exception:
        app.logger.exception('Invalid study suggestion request')
        return jsonify({'error': 'Yêu cầu không thể xử lý.'}), 500

# ==================== XẾP LỊCH REAL (SCHEDULE OPTIMIZE) ====================
@app.route('/api/schedule-optimize', methods=['POST'])
def schedule_optimize():
    data, error = get_json_body()
    if error:
        return error

    subjects = data.get('subjects', [])
    availability = data.get('availability', {})
    breaks = data.get('breaks', [])
    preferences = data.get('preferences', {})

    if not isinstance(subjects, list) or not isinstance(availability, dict) or not isinstance(breaks, list) or not isinstance(preferences, dict):
        return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400

    # Chuyển availability key sang string cho Python
    availability_str = {str(k): v for k, v in availability.items()}

    try:
        result = create_timetable_with_preferences(subjects, availability_str, breaks, preferences)
    except Exception:
        app.logger.exception('schedule_optimize failed')
        return jsonify({'error': 'Xếp lịch thất bại'}), 500

    # Map tên tiếng Việt → tiếng Anh (index JS)
    day_map = {
        "Thứ 2": "Monday",
        "Thứ 3": "Tuesday",
        "Thứ 4": "Wednesday",
        "Thứ 5": "Thursday",
        "Thứ 6": "Friday",
        "Thứ 7": "Saturday",
        "Chủ nhật": "Sunday"
    }

    timetable = {}
    for vi_name, lessons in result.items():
        en_name = day_map.get(vi_name)
        if en_name:
            timetable[en_name] = lessons

    return jsonify({'timetable': timetable})


# ==================== KHỞI CHẠY APP ====================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
