import json
import os
import threading
from pathlib import Path
from queue import Empty, Queue

from dotenv import load_dotenv
from flask import Flask, Response, abort, jsonify, request, send_from_directory
from openai import OpenAI

# Một số môi trường export sẵn placeholder rỗng kiểu "PASTE_..._HERE" vào biến môi
# trường, khiến load_dotenv() không ghi đè và app dùng nhầm placeholder. Ta tự nạp
# .env và chỉ ghi đè khi giá trị hiện tại trống hoặc là placeholder — key export
# thật từ shell vẫn được ưu tiên.
_PLACEHOLDER_MARKERS = ('PASTE_', 'YOUR_', 'CHANGE_ME', 'XXX', 'xxxxxxxx', '<', '>')


def _looks_like_placeholder(value):
    v = (value or '').strip()
    if not v:
        return True
    upper = v.upper()
    return any(marker.upper() in upper for marker in _PLACEHOLDER_MARKERS)


def _load_env_file(path='.env'):
    env_path = Path(__file__).resolve().parent / path
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and _looks_like_placeholder(os.environ.get(key)):
            os.environ[key] = value


# Nạp biến môi trường từ file .env (nếu có) — để dev local, không commit lên git.
_load_env_file()

from schedule.schedule_utils import create_timetable_with_preferences
#python -m http.server 8000
#.venv/bin/python app.py
# cấu hình API nhà cung cấp
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
    'deepseek': {
        'key': os.environ.get('DEEPSEEK_API_KEY'),
        'base_url': (os.environ.get('DEEPSEEK_BASE_URL') or '').strip() or 'https://api.deepseek.com/v1',
        'model': (os.environ.get('DEEPSEEK_MODEL') or '').strip() or 'deepseek-chat',
    },
    'gemini': {
        # Google Gemini mở endpoint OpenAI-compatible, không cần thư viện riêng.
        'key': os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY'),
        'base_url': (os.environ.get('GEMINI_BASE_URL') or '').strip() or 'https://generativelanguage.googleapis.com/v1beta/openai',
        'model': (os.environ.get('GEMINI_MODEL') or '').strip() or 'gemini-3.6-flash',
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


def _classify_provider_error(exc):
    """Phân loại lỗi provider thành (code, thông báo tiếng Việt) để người dùng biết cách sửa.

    Dùng status_code và tên lớp exception của thư viện openai (không leak nội dung key).
    """
    status = getattr(exc, 'status_code', None)
    name = type(exc).__name__.lower()
    try:
        status = int(status) if status is not None else None
    except (TypeError, ValueError):
        status = None

    if status == 401 or 'authenticationerror' in name:
        return ('invalid_key', 'API key không hợp lệ hoặc đã bị thu hồi. Kiểm tra lại key trong .env.')
    if status == 402:
        return ('no_balance', 'Tài khoản provider đã hết số dư hoặc hạn mức. Nạp thêm hoặc đổi provider khác.')
    if status == 403 or 'permissiondeniederror' in name:
        return ('permission', 'Provider từ chối quyền truy cập (403). Kiểm tra project/quyền của API key.')
    if status == 404 or 'notfounderror' in name:
        return ('model_not_found', 'Không tìm thấy model đã cấu hình. Kiểm tra biến <TEN>_MODEL.')
    if status == 429 or 'ratelimiterror' in name:
        return ('rate_limit', 'Provider đang giới hạn tần suất (429). Vui lòng thử lại sau ít phút.')
    if 'timeout' in name:
        return ('timeout', 'Provider phản hồi quá chậm (timeout). Vui lòng thử lại sau.')
    if 'connectionerror' in name:
        return ('connection', 'Không kết nối được tới provider. Kiểm tra mạng và biến <TEN>_BASE_URL.')
    if status is not None and 500 <= status < 600:
        return ('provider_down', 'Provider đang gặp sự cố phía máy chủ. Vui lòng thử lại sau.')
    return ('unknown', 'Dịch vụ AI hiện không phản hồi. Vui lòng thử lại sau.')


def probe_provider(name, timeout=8.0):
    """Kiểm tra nhanh một provider bằng một completion tối thiểu (1 token)."""
    cfg = AI_PROVIDERS[name]
    key = (cfg.get('key') or '').strip()
    if not key:
        return {'configured': False, 'healthy': False, 'code': 'no_key',
                'message': 'Chưa cấu hình API key.'}
    try:
        client = OpenAI(api_key=key, base_url=cfg['base_url'], timeout=timeout)
        client.chat.completions.create(
            model=cfg['model'],
            messages=[{'role': 'user', 'content': 'ping'}],
            max_tokens=1,
        )
        return {'configured': True, 'healthy': True, 'code': 'ok', 'message': 'OK'}
    except Exception as exc:
        code, message = _classify_provider_error(exc)
        app.logger.info('Probe provider "%s" failed (%s)', name, code)
        return {'configured': True, 'healthy': False, 'code': code, 'message': message}


app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024
BASE_DIR = Path(__file__).resolve().parent
PUBLIC_FILES = {
    'index.html', 'config.js', 'theme-init.js', 'config-preview.html', 'shared.js', 'shared.css', 'style.css', 'pockup.png',
    'auth.js', 'account.html', 'account.css',
    'career/chat.html', 'career/chat.js', 'career/chat.css',
    'schedule/create.html', 'schedule/create.js', 'schedule/create.css',
    'todo/mylist.html', 'todo/mylist.js', 'todo/mylist.css',
}




def get_json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None, (jsonify(error='Dữ liệu JSON không hợp lệ.'), 400)
    return data, None


DAYS_EN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def request_ai(messages, max_tokens, provider=None, on_delta=None):
    """Gọi AI qua provider được chỉ định (hoặc tự nhận diện nếu không chỉ định).

    Trả về (reply, None) khi thành công, hoặc (None, (response_json, http_status)) khi lỗi.
    Nếu `on_delta` được truyền, dùng chế độ stream và gọi lại on_delta(text) cho từng mảnh,
    rồi trả về văn bản đầy đủ đã ghép.
    """
    # Lỗi trả về dạng (dict, status) thay vì jsonify để an toàn khi gọi từ thread
    # không có application context (ví dụ worker của endpoint streaming).
    available = detect_available_providers()
    if not available:
        return None, ({'error': 'Chưa cấu hình API key cho bất kỳ nhà cung cấp AI nào.'}, 503)

    # Chọn provider: từ request > env AI_PROVIDER > provider đầu tiên còn key.
    wanted = (provider or DEFAULT_PROVIDER or '').strip().lower() or None
    if wanted:
        if wanted not in AI_PROVIDERS:
            return None, ({'error': f'Không hỗ trợ provider "{wanted}". Các provider khả dụng: {", ".join(available)}.'}, 400)
        if wanted not in available:
            return None, ({'error': f'Provider "{wanted}" chưa được cấu hình API key.'}, 503)
        chain = [wanted]
    else:
        chain = available

    last_error = None
    streamed_any = False  # Đã gửi ít nhất một mảnh stream cho client chưa?
    for name in chain:
        cfg = AI_PROVIDERS[name]
        try:
            client = _get_provider_client(name)
            stream = on_delta is not None
            response = client.chat.completions.create(
                model=cfg['model'], messages=messages, temperature=0.7, max_tokens=max_tokens,
                stream=stream,
            )
            if stream:
                chunks = []
                for event in response:
                    if not getattr(event, 'choices', None):
                        continue
                    piece = getattr(event.choices[0].delta, 'content', None)
                    if piece:
                        chunks.append(piece)
                        streamed_any = True
                        on_delta(piece)
                reply = ''.join(chunks)
            else:
                reply = response.choices[0].message.content
            if not reply:
                raise ValueError('AI provider returned an empty reply')
            return reply, None
        except Exception as exc:
            app.logger.warning('AI provider "%s" failed: %s', name, exc)
            last_error = exc
            if streamed_any:
                # Đã stream một phần văn bản cho client. Failover sang provider khác
                # sẽ khiến client nhận phần cũ + câu trả lời mới từ đầu (trùng lặp),
                # nên dừng ngay và báo lỗi.
                return None, ({
                    'error': 'Mất kết nối tới AI giữa lúc phản hồi. Vui lòng thử lại.',
                    'partial': True,
                }, 502)

    code, message = _classify_provider_error(last_error)
    app.logger.warning('All AI providers failed (code=%s)', code, exc_info=last_error)
    # Trả dict thuần (không jsonify) để an toàn khi gọi từ thread worker
    # của endpoint streaming — thread đó không có application context.
    return None, ({'error': message, 'code': code}, 502)
 
# serve file tĩnh
@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/api/public-config', methods=['GET'])
def public_config():
    """Expose only browser-safe configuration needed by Supabase Auth."""
    return jsonify({
        'supabaseUrl': (os.environ.get('SUPABASE_URL') or '').strip(),
        'supabasePublishableKey': (
            os.environ.get('SUPABASE_PUBLISHABLE_KEY')
            or os.environ.get('SUPABASE_KEY')
            or ''
        ).strip(),
    })

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

        # Ngữ cảnh người dùng (todo/schedule) để AI tư vấn sát thực tế hơn
        user_context = _summarize_projects(data.get('projects'))
        schedule_ctx = _summarize_schedule(data.get('schedule'))
        messages = _build_career_messages(user_message, history, user_context, schedule_ctx)

        # Gọi AI (tự nhận diện provider nếu không chỉ định)
        ai_reply, error = request_ai(messages, 900, provider=provider)
        if error:
            return error
        return jsonify({'success': True, 'reply': ai_reply})
    except Exception:
        app.logger.exception('Invalid career AI request')
        return jsonify({'success': False, 'error': 'Yêu cầu không thể xử lý.'}), 500

# ==================== AI CAREER - STREAMING (SSE) ====================
CAREER_SYSTEM_PROMPT = (
    "Bạn là một chuyên gia tư vấn hướng nghiệp cho học sinh. "
    "Hãy trả lời câu hỏi một cách chi tiết, thực tế và dễ hiểu."
)


def _build_career_messages(user_message, history, user_context, schedule_ctx):
    """Dựng mảng messages dùng chung cho các endpoint career-ai."""
    system = CAREER_SYSTEM_PROMPT
    if user_context or schedule_ctx:
        system += (
            "\n\nDưới đây là dữ liệu học tập thực tế của người dùng (danh sách dự án/công việc và thời khóa biểu) "
            "để bạn tham khảo khi tư vấn. Hãy dựa vào đó nếu câu hỏi liên quan, và không liệt kê lại toàn bộ trừ khi được yêu cầu:\n"
            + json.dumps({'projects': user_context, 'schedule': schedule_ctx}, ensure_ascii=False)
        )
    messages = [{'role': 'system', 'content': system}]
    for msg in history[-20:]:
        if not isinstance(msg, dict):
            continue
        content = msg.get('content')
        if msg.get('role') in ('user', 'assistant') and isinstance(content, str) and content.strip():
            messages.append({'role': msg['role'], 'content': content[:2000]})
    messages.append({'role': 'user', 'content': user_message.strip()})
    return messages


@app.route('/api/career-ai-stream', methods=['POST'])
def career_chat_stream():
    """Phiên bản streaming (Server-Sent Events) của /api/career-ai.

    Body JSON: message, history, projects, schedule, provider (tùy chọn).
    Trả về text/event-stream: mỗi mảnh text là 'data: {"delta": "..."}\n\n',
    kết thúc bằng 'data: {"success": true}\n\n' rồi 'data: [DONE]\n\n'.
    Nếu lỗi xảy ra trước/khi stream, gửi 'data: {"error": "..."}\n\n' rồi [DONE].
    """
    data, error = get_json_body()
    if error:
        return error
    user_message = data.get('message', '')
    history = data.get('history', [])
    provider = data.get('provider')

    if (not isinstance(user_message, str) or not user_message.strip()
            or len(user_message) > 2000 or not isinstance(history, list)):
        return jsonify({'success': False, 'error': 'Nội dung gửi lên không hợp lệ'}), 400

    user_context = _summarize_projects(data.get('projects'))
    schedule_ctx = _summarize_schedule(data.get('schedule'))
    messages = _build_career_messages(user_message, history, user_context, schedule_ctx)

    def generate():
        queue = Queue()

        def on_delta(piece):
            queue.put(('delta', piece))

        def worker():
            try:
                reply, err = request_ai(messages, 900, provider=provider, on_delta=on_delta)
                queue.put(('done', (reply, err)))
            except Exception as exc:  # phòng hờ: lỗi ngoài request_ai
                app.logger.exception('career stream worker failed')
                queue.put(('done', (None, exc)))

        threading.Thread(target=worker, daemon=True).start()

        reply, err = None, None
        idle = 0
        timed_out = False
        try:
            while True:
                try:
                    kind, payload = queue.get(timeout=15)
                except Empty:
                    # Gửi "nhịp tim" để proxy/trình duyệt không cắt kết nối khi AI
                    # còn đang xử lý; chỉ báo lỗi sau ~8 lần liên tiếp (khoảng 2 phút).
                    idle += 1
                    if idle >= 8:
                        timed_out = True
                        yield f"data: {json.dumps({'error': 'Hết thời gian chờ phản hồi AI.'}, ensure_ascii=False)}\n\n"
                        break
                    yield ': ping\n\n'
                    continue
                idle = 0
                if kind == 'delta':
                    yield f"data: {json.dumps({'delta': payload}, ensure_ascii=False)}\n\n"
                else:  # 'done'
                    reply, err = payload
                    break

            if err is None and not timed_out:
                yield f"data: {json.dumps({'success': True}, ensure_ascii=False)}\n\n"
            elif not timed_out:
                # err là (dict lỗi, status) từ request_ai, hoặc Exception ngoài dự kiến
                if isinstance(err, tuple) and len(err) == 2 and isinstance(err[0], dict):
                    detail = err[0]
                    status = err[1]
                else:
                    detail = {'error': 'Dịch vụ AI hiện không phản hồi. Vui lòng thử lại sau.'}
                    status = 502
                yield f"data: {json.dumps({'success': False, 'error': detail.get('error', 'AI error'), 'code': detail.get('code'), 'status': status}, ensure_ascii=False)}\n\n"
        except GeneratorExit:
            # Client ngắt kết nối — worker dừng tự nhiên khi stream bị đóng.
            raise
        except Exception:
            app.logger.exception('career_ai_stream generate failed')
            yield f"data: {json.dumps({'error': 'Lỗi khi stream phản hồi AI.'}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
    })


# gợi ý học tập
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
    """Danh sách provider đã nhận diện được (đã cấu hình key) theo thứ tự ưu tiên.

    Thêm ?probe=1 để kiểm tra thật từng provider (gọi 1 completion tối thiểu).
    """
    available = detect_available_providers()
    payload = {
        'available': available,
        'default': DEFAULT_PROVIDER or (available[0] if available else None),
        'supported': list(AI_PROVIDERS.keys()),
    }
    if request.args.get('probe', '').lower() in ('1', 'true', 'yes'):
        payload['health'] = {name: probe_provider(name) for name in available}
    return jsonify(payload)


@app.route('/api/health', methods=['GET'])
def health():
    """Kiểm tra nhanh tình trạng server và cấu hình AI (không gọi ra ngoài)."""
    available = detect_available_providers()
    return jsonify({
        'status': 'ok',
        'ai_configured': bool(available),
        'providers': available,
        'default_provider': DEFAULT_PROVIDER or (available[0] if available else None),
    })


# xếp lịch (schedule optimize)
@app.route('/api/schedule-optimize', methods=['POST'])
def schedule_optimize():
    data, error = get_json_body()
    if error:
        return error

    subjects = data.get('subjects', [])
    availability = data.get('availability', {})
    breaks = data.get('breaks', [])
    preferences = data.get('preferences', {})
    lesson_duration = data.get('lesson_duration', 45)

    if (not isinstance(subjects, list) or not isinstance(availability, dict)
            or not isinstance(breaks, list) or not isinstance(preferences, dict)
            or isinstance(lesson_duration, bool) or not isinstance(lesson_duration, (int, float))
            or not float(lesson_duration).is_integer()
            or not 1 <= lesson_duration <= 240):
        return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400
    lesson_duration = int(lesson_duration)

    # Giới hạn kích thước đầu vào để tránh request khổng lồ làm nghẽn server.
    if len(subjects) > 50 or len(breaks) > 50 or len(availability) > 7:
        return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400
    total_sessions = 0
    for subj in subjects:
        if not isinstance(subj, dict):
            return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400
        sessions = subj.get('sessions', 0)
        if isinstance(sessions, bool) or not isinstance(sessions, (int, float)) or sessions < 0:
            return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400
        total_sessions += int(sessions)
    if total_sessions > 500:
        return jsonify({'error': 'Số tiết cần xếp quá lớn'}), 400

    # Chuyển availability key sang string cho Python
    availability_str = {str(k): v for k, v in availability.items()}

    try:
        result = create_timetable_with_preferences(
            subjects, availability_str, breaks, preferences, lesson_duration=lesson_duration
        )
    except Exception:
        app.logger.exception('schedule_optimize failed')
        return jsonify({'error': 'Xếp lịch thất bại'}), 500

    # create_timetable_with_preferences trả về list 7 phần tử (index 0..6 = Thứ 2..Chủ nhật).
    # Dùng chỉ số nên không cần map theo tên thứ, tránh phụ thuộc ngôn ngữ.
    return jsonify({'timetable': result})


# ==================== NGỮ CẢNH NGƯỜI DÙNG CHO AI ====================
LOCALSTORAGE_KEYS = {
    'projects': 'studyverse_projects',
    'schedule': 'studyverse_schedule_dashboard_data',
    'last_project': 'lastSelectedProject',
}


def _clamp_str(value, limit):
    """Ép kiểu chuỗi, giới hạn độ dài để tránh phình to ngữ cảnh AI."""
    if not isinstance(value, str):
        return ''
    return value.strip()[:limit]


def _summarize_projects(raw):
    """Rút gọn danh sách project/todo thành ngữ cảnh gọn cho AI."""
    if not isinstance(raw, list):
        return []
    out = []
    for proj in raw[:25]:
        if not isinstance(proj, dict):
            continue
        tasks = proj.get('tasks') if isinstance(proj.get('tasks'), list) else []
        out.append({
            'name': _clamp_str(proj.get('name'), 80),
            'deadline': _clamp_str(proj.get('deadline'), 20) or None,
            'total_tasks': len(tasks),
            'completed_tasks': sum(1 for t in tasks if isinstance(t, dict) and t.get('completed')),
            'open_tasks': [
                _clamp_str(t.get('name'), 60)
                for t in tasks
                if isinstance(t, dict) and not t.get('completed')
            ][:10],
        })
    return out


def _summarize_schedule(raw):
    """Rút gọn dữ liệu thời khóa biểu thành ngữ cảnh gọn cho AI."""
    if not isinstance(raw, dict):
        return None
    subjects = raw.get('subjects') if isinstance(raw.get('subjects'), list) else []
    grid = raw.get('timetableData') if isinstance(raw.get('timetableData'), list) else []
    timetable = []
    for day_idx, day_slots in enumerate(grid[:7]):
        if not isinstance(day_slots, list):
            continue
        lessons = [
            _clamp_str(slot.get('name'), 40)
            for slot in day_slots
            if isinstance(slot, dict) and slot.get('type') == 'subject' and slot.get('name')
        ]
        if lessons:
            timetable.append({'day': DAYS_EN[day_idx], 'lessons': lessons})
    return {
        'subjects': [_clamp_str(s, 40) for s in subjects if isinstance(s, str)][:20],
        'timetable': timetable,
    }


@app.route('/api/ai-context', methods=['POST'])
def ai_context():
    """Thu thập + rút gọn dữ liệu LocalStorage của người dùng thành ngữ cảnh AI.

    Client gửi LocalStorage (projects + schedule), server trả về JSON gọn nhẹ
    để nhúng vào system prompt. Server không lưu dữ liệu này.
    """
    data, error = get_json_body()
    if error:
        return error
    context = {
        'projects': _summarize_projects(data.get('projects')),
        'schedule': _summarize_schedule(data.get('schedule')),
    }
    return jsonify(context)


# khởi chạy app
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
