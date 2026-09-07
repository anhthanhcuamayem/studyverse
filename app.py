import os
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory
from openai import OpenAI

from schedule.schedule_utils import create_timetable_with_preferences
#python -m http.server 8000
# ==================== PHẦN CẤU HÌNH API ĐA NHÀ CUNG CẤP ====================
# Mỗi provider khai báo qua biến môi trường: <TEN>_API_KEY (+ tùy chọn <TEN>_BASE_URL, <TEN>_MODEL).
# Tất cả đều dùng giao thức OpenAI-compatible (chat.completions).
AI_PROVIDERS = {
    'freellm': {
        'key': os.environ.get('FREELLM_API_KEY'),
        'base_url': (os.environ.get('FREELLM_BASE_URL') or '').strip() or 'http://localhost:3001/v1',
        'model': (os.environ.get('FREELLM_MODEL') or '').strip() or 'auto:fast',
    },
    'openai': {
        'key': os.environ.get('OPENAI_API_KEY'),
        'base_url': (os.environ.get('OPENAI_BASE_URL') or '').strip() or 'https://api.openai.com/v1',
        'model': (os.environ.get('OPENAI_MODEL') or '').strip() or 'gpt-4o-mini',
    },
    'gemini': {
        # Google Gemini mở endpoint OpenAI-compatible, không cần thư viện riêng.
        'key': os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY'),
        'base_url': (os.environ.get('GEMINI_BASE_URL') or '').strip() or 'https://generativelanguage.googleapis.com/v1beta/openai',
        'model': (os.environ.get('GEMINI_MODEL') or '').strip() or 'gemini-2.0-flash',
    },
    'groq': {
        'key': os.environ.get('GROQ_API_KEY'),
        'base_url': (os.environ.get('GROQ_BASE_URL') or '').strip() or 'https://api.groq.com/openai/v1',
        'model': (os.environ.get('GROQ_MODEL') or '').strip() or 'llama-3.3-70b-versatile',
    },
    'openrouter': {
        'key': os.environ.get('OPENROUTER_API_KEY'),
        'base_url': (os.environ.get('OPENROUTER_BASE_URL') or '').strip() or 'https://openrouter.ai/api/v1',
        'model': (os.environ.get('OPENROUTER_MODEL') or '').strip() or 'openrouter/auto',
    },
    'anthropic': {
        # Anthropic có endpoint OpenAI-compatible (giao thức /v1/chat/completions).
        'key': os.environ.get('ANTHROPIC_API_KEY'),
        'base_url': (os.environ.get('ANTHROPIC_BASE_URL') or '').strip() or 'https://api.anthropic.com/v1',
        'model': (os.environ.get('ANTHROPIC_MODEL') or '').strip() or 'claude-sonnet-4-20250514',
    },
}

# Thứ tự ưu tiên khi nhiều key được cấu hình cùng lúc (đổi nếu muốn ưu tiên nhà khác).
AI_PROVIDER_ORDER = [name for name in (os.environ.get('AI_PROVIDER_ORDER') or '').split(',') if name.strip()]
AI_PROVIDER_ORDER += [name for name in AI_PROVIDERS if name not in AI_PROVIDER_ORDER]


def detect_available_providers():
    """Nhận diện các provider đã cấu hình API key, sắp theo thứ tự ưu tiên."""
    return [name for name in AI_PROVIDER_ORDER if (AI_PROVIDERS[name].get('key') or '').strip()]


def _get_provider_client(provider):
    """Tạo OpenAI client cho provider (dùng lại nếu đã tạo)."""
    cfg = AI_PROVIDERS[provider]
    client = cfg.get('_client')
    if client is None:
        client = OpenAI(api_key=cfg['key'].strip(), base_url=cfg['base_url'])
        cfg['_client'] = client
    return client


DEFAULT_PROVIDER = (os.environ.get('AI_PROVIDER') or '').strip().lower() or None

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_FILES = {
    'index.html', 'script.js', 'shared.css', 'style.css', 'pockup.png',
    'career/chat.html', 'career/chat.js', 'career/chat.css',
    'schedule/create.html', 'schedule/create.js', 'schedule/create.css',
    'todo/mylist.html', 'todo/mylist.js', 'todo/mylist.css',
}




def get_json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify(error='Dữ liệu JSON không hợp lệ.'), 400)
    return data, None


def request_ai(messages, max_tokens, provider=None):
    """Gọi AI qua provider được chỉ định (hoặc tự nhận diện nếu không chỉ định).

    Trả về (reply, None) khi thành công, hoặc (None, (response_json, http_status)) khi lỗi.
    """
    available = detect_available_providers()
    if not available:
        return None, (jsonify(error='Chưa cấu hình API key cho bất kỳ nhà cung cấp AI nào.'), 503)

    # Chọn provider: từ request > env AI_PROVIDER > provider đầu tiên còn key.
    wanted = (provider or DEFAULT_PROVIDER or '').strip().lower() or None
    if wanted:
        if wanted not in AI_PROVIDERS:
            return None, (jsonify(error=f'Không hỗ trợ provider "{wanted}". Các provider khả dụng: {", ".join(available)}.'), 400)
        if wanted not in available:
            return None, (jsonify(error=f'Provider "{wanted}" chưa được cấu hình API key.'), 503)
        chain = [wanted]
    else:
        chain = available

    last_error = None
    for name in chain:
        cfg = AI_PROVIDERS[name]
        try:
            client = _get_provider_client(name)
            response = client.chat.completions.create(
                model=cfg['model'], messages=messages, temperature=0.7, max_tokens=max_tokens
            )
            reply = response.choices[0].message.content
            if not reply:
                raise ValueError('AI provider returned an empty reply')
            return reply, None
        except Exception as exc:
            app.logger.warning('AI provider "%s" failed: %s', name, exc)
            last_error = exc

    app.logger.exception('All AI providers failed', exc_info=last_error)
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
        provider = data.get('provider')  # tùy chọn: 'openai', 'gemini', 'groq', ...
        
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
        
        # Gọi AI (tự nhận diện provider nếu không chỉ định)
        ai_reply, error = request_ai(messages, 500, provider=provider)
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
        provider = data.get('provider')  # tùy chọn
        
        if not isinstance(topic, str) or not topic.strip() or len(topic) > 1000:
            return jsonify({'error': 'Vui lòng nhập chủ đề cần tư vấn'}), 400
        
        # Gọi AI (tự nhận diện provider nếu không chỉ định)
        ai_suggestion, error = request_ai([
            {"role": "system", "content": "Bạn là một người hướng dẫn học tập, hãy đưa ra các phương pháp học hiệu quả cho chủ đề được hỏi."},
            {"role": "user", "content": f"Hãy gợi ý cách học tốt môn/chủ đề: {topic.strip()}"}
        ], 600, provider=provider)
        if error:
            return error
        return jsonify({'suggestion': ai_suggestion})
    except Exception:
        app.logger.exception('Invalid study suggestion request')
        return jsonify({'error': 'Yêu cầu không thể xử lý.'}), 500

# ==================== TRẠNG THÁI PROVIDER AI ====================
@app.route('/api/ai-providers', methods=['GET'])
def ai_providers_status():
    """Danh sách provider đã nhận diện được (đã cấu hình key) theo thứ tự ưu tiên."""
    available = detect_available_providers()
    return jsonify({
        'available': available,
        'default': DEFAULT_PROVIDER or (available[0] if available else None),
        'supported': list(AI_PROVIDERS.keys()),
    })


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
