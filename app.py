import json
import os
import re
import threading
import time
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
# Studyverse gọi AI qua FreeLLMAPI (Freellmapi), không dùng OmniRoute nữa.
# FreeLLMAPI chạy ở http://localhost:3001/v1 và được expose qua cloudflared
# tunnel dưới domain ai.studyverse.cloud.
#
# Provider chính là `freellmapi` (ai.studyverse.cloud). Khi gateway này không
# khả dụng (không kết nối được, timeout, lỗi 5xx...), request_ai tự chuyển sang
# provider dự phòng `groq` — dùng endpoint OpenAI-compatible có sẵn của Groq
# (https://api.groq.com/openai/v1) nên vẫn đi qua thư viện openai, không cần
# SDK riêng.
GROQ_DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'

AI_PROVIDERS = {
    'freellmapi': {
        'key': os.environ.get('FREELLM_API_KEY'),
        'base_url': (os.environ.get('FREELLM_BASE_URL') or '').strip() or 'http://localhost:3001/v1',
        'model': (os.environ.get('FREELLM_MODEL') or '').strip(),
    },
    'groq': {
        'key': os.environ.get('GROQ_API_KEY'),
        'base_url': (os.environ.get('GROQ_BASE_URL') or '').strip() or GROQ_DEFAULT_BASE_URL,
        'model': (os.environ.get('GROQ_MODEL') or '').strip() or 'openai/gpt-oss-120b',
    },
}

# Thứ tự ưu tiên: gateway chính trước, Groq là phương án dự phòng.
AI_PROVIDER_ORDER = ['freellmapi', 'groq']

# Timeout cho mỗi lời gọi AI (giây). Đủ ngắn để phát hiện gateway chính không
# khả dụng mà chuyển sang Groq, nhưng vẫn đủ dài cho stream bình thường.
def _env_float(name, default):
    try:
        value = float((os.environ.get(name) or '').strip())
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


AI_REQUEST_TIMEOUT = _env_float('AI_REQUEST_TIMEOUT', 30.0)

# Số lần SDK tự thử lại trước khi chuyển provider. SDK mặc định là 2, khiến một
# gateway treo bị gọi 3 lần liên tiếp (3 x timeout) mới failover — với timeout
# mặc định 30s là gần 90s cho mỗi request. Mặc định 0 để phát hiện lỗi ngay và
# chuyển sang Groq nhanh; tăng lên nếu muốn chịu lỗi tạm thời tốt hơn.
AI_MAX_RETRIES = int(_env_float('AI_MAX_RETRIES', 0.0))

# Sau khi một provider lỗi kiểu "không khả dụng" (timeout, mất kết nối, 5xx),
# tạm bỏ qua provider đó trong bấy nhiêu giây. Nhờ vậy khi ai.studyverse.cloud
# chết, các request sau đi thẳng Groq thay vì chờ hết timeout lần nào nữa.
# Đặt 0 để tắt (luôn thử gateway chính trước mỗi request).
AI_FAILOVER_COOLDOWN = _env_float('AI_FAILOVER_COOLDOWN', 60.0)

# Giới hạn token tối đa cho mỗi lời gọi AI (max_tokens). Model "suy luận trước"
# (reasoning, vd gpt-oss trên Groq) tiêu một phần token vào phần suy nghĩ, nên
# đặt cao (4096) để câu trả lời không bị cắt ngắn vì hết budget.
AI_MAX_TOKENS = int(_env_float('AI_MAX_TOKENS', 4096.0))

# Không vội gửi mảnh stream ra client cho tới khi câu trả lời tích lũy đủ
# _STREAM_FLUSH_CHARS ký tự. Nhờ vậy chat không bao giờ hiện đúng một chữ khi
# provider trả về 1-2 token (reasoning chiếm hết budget, hoặc stream đứt sớm) —
# lúc đó chưa gửi gì nên vẫn thử lại được.
_STREAM_FLUSH_CHARS = 40

# Dưới ngưỡng này coi là câu trả lời bất thường (câu trả lời bình thường dài
# hàng trăm ký tự) → thử lại thay vì trả cho người dùng.
_MIN_REPLY_CHARS = 6

# Mã lỗi coi là "provider không khả dụng" → mở circuit breaker.
_COOLDOWN_ERROR_CODES = ('timeout', 'connection', 'provider_down')

_provider_down_until = {}
_provider_state_lock = threading.Lock()


def _provider_cooling_down(name):
    """Provider có đang trong thời gian tạm bỏ qua (vừa lỗi khả dụng) không?"""
    if AI_FAILOVER_COOLDOWN <= 0:
        return False
    now = time.monotonic()
    with _provider_state_lock:
        until = _provider_down_until.get(name)
        if not until:
            return False
        if until <= now:
            _provider_down_until.pop(name, None)
            return False
        return True


def _mark_provider_down(name):
    """Ghi nhận provider vừa lỗi để tạm bỏ qua trong AI_FAILOVER_COOLDOWN giây."""
    if AI_FAILOVER_COOLDOWN <= 0:
        return
    with _provider_state_lock:
        _provider_down_until[name] = time.monotonic() + AI_FAILOVER_COOLDOWN
    app.logger.info('Provider "%s" tạm bỏ qua %.0fs sau lỗi khả dụng.', name, AI_FAILOVER_COOLDOWN)


def _mark_provider_up(name):
    """Provider vừa trả lời được → xoá trạng thái tạm bỏ qua."""
    with _provider_state_lock:
        _provider_down_until.pop(name, None)


def _reset_provider_health():
    """Xoá toàn bộ trạng thái circuit breaker (dùng cho test)."""
    with _provider_state_lock:
        _provider_down_until.clear()


def detect_available_providers():
    """Nhận diện các provider đã cấu hình API key, sắp theo thứ tự ưu tiên."""
    return [name for name in AI_PROVIDER_ORDER if (AI_PROVIDERS[name].get('key') or '').strip()]


def _build_provider_chain(wanted, available):
    """Dựng chuỗi provider để thử lần lượt.

    Provider `wanted` (nếu có) đứng đầu, sau đó tới các provider còn key theo
    thứ tự ưu tiên — nhờ vậy khi gateway chính (freellmapi / ai.studyverse.cloud)
    không khả dụng, request_ai tự chuyển sang Groq.
    """
    if wanted and wanted in available:
        return [wanted] + [name for name in available if name != wanted]
    return list(available)


def _get_provider_client(provider):
    """Tạo OpenAI client cho provider (dùng lại nếu đã tạo)."""
    cfg = AI_PROVIDERS[provider]
    client = cfg.get('_client')
    if client is None:
        client = OpenAI(api_key=cfg['key'].strip(), base_url=cfg['base_url'],
                       timeout=AI_REQUEST_TIMEOUT, max_retries=AI_MAX_RETRIES)
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
    'icons.js',
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
    # Provider được chọn luôn đứng đầu chuỗi; nếu nó không khả dụng (lỗi kết nối/
    # timeout/5xx...) thì vẫn tự động chuyển sang các provider dự phòng còn key.
    wanted = (provider or DEFAULT_PROVIDER or '').strip().lower() or None
    if wanted:
        if wanted not in AI_PROVIDERS:
            return None, ({'error': f'Không hỗ trợ provider "{wanted}". Các provider khả dụng: {", ".join(available)}.'}, 400)
        if wanted not in available:
            return None, ({'error': f'Provider "{wanted}" chưa được cấu hình API key.'}, 503)
    chain = _build_provider_chain(wanted, available)
    # Provider vừa lỗi khả dụng bị tạm bỏ qua để failover tức thì. Luôn giữ lại
    # ít nhất một lựa chọn để còn thử và báo lỗi thật cho người dùng.
    active = [name for name in chain if not _provider_cooling_down(name)] or list(chain)

    last_error = None
    streamed_any = False  # Đã gửi ít nhất một mảnh stream cho client chưa?
    for name in active:
        cfg = AI_PROVIDERS[name]
        try:
            client = _get_provider_client(name)
            stream = on_delta is not None
            budget = max(max_tokens, 512)
            reply = ''
            finish_reason = None
            chunks = []      # mọi mảnh content đã nhận của lượt hiện tại
            emitting = False  # đã bắt đầu gửi mảnh cho client chưa?
            # Model "suy luận trước" (reasoning, vd gpt-oss trên Groq) tiêu token vào
            # phần suy nghĩ trước khi viết câu trả lời. Hệ quả: content có thể rỗng,
            # bị cắt (finish_reason="length") hoặc chỉ đúng 1-2 token dù request thành
            # công — ví dụ chat chỉ trả về đúng chữ "C" hay "cổ". Vậy nên KHÔNG vội
            # gửi ra client cho tới khi tích lũy đủ _STREAM_FLUSH_CHARS ký tự; câu trả
            # lời ngắn bất thường hoặc bị cắt sẽ được thử lại khi còn có thể.
            for _attempt in range(3):
                response = client.chat.completions.create(
                    model=cfg['model'], messages=messages, temperature=0.7, max_tokens=budget,
                    stream=stream,
                )
                finish_reason = None
                chunks = []
                emitting = False
                held_chars = 0
                if stream:
                    for event in response:
                        if not getattr(event, 'choices', None):
                            continue
                        choice = event.choices[0]
                        if getattr(choice, 'finish_reason', None):
                            finish_reason = choice.finish_reason
                        piece = getattr(choice.delta, 'content', None)
                        if not piece:
                            continue
                        chunks.append(piece)
                        held_chars += len(piece)
                        if emitting:
                            streamed_any = True
                            on_delta(piece)
                        elif held_chars >= _STREAM_FLUSH_CHARS:
                            # Đủ độ tin cậy → gửi phần đang giữ rồi streaming tiếp.
                            emitting = True
                            for held in chunks:
                                streamed_any = True
                                on_delta(held)
                    reply = ''.join(chunks)
                else:
                    choice = response.choices[0]
                    reply = choice.message.content
                    finish_reason = getattr(choice, 'finish_reason', None)
                truncated = finish_reason == 'length'
                if reply and not truncated and len(reply) >= _MIN_REPLY_CHARS:
                    if stream and not emitting:
                        for held in chunks:
                            streamed_any = True
                            on_delta(held)
                    _mark_provider_up(name)
                    return reply, None
                if streamed_any:
                    # Đã gửi một phần cho client → thử lại sẽ làm nội dung bị lặp.
                    break
                if budget < AI_MAX_TOKENS:
                    budget = min(budget * 2, AI_MAX_TOKENS)
                elif not reply:
                    break  # rỗng ngay ở trần budget → chuyển provider thay vì thử lại
                # Còn lại: câu trả lời ngắn/bị cắt nhưng CHƯA gửi gì cho client →
                # thử lại với budget hiện tại (lượng suy luận thay đổi giữa các lượt).
            if reply and not emitting:
                # Đã thử hết lượt mà vẫn chưa đạt: gửi nốt phần đang giữ cho client.
                for held in chunks:
                    streamed_any = True
                    on_delta(held)
            if reply and (truncated or len(reply) < _MIN_REPLY_CHARS):
                app.logger.warning(
                    'AI provider "%s" trả lời bất thường (len=%d, finish_reason=%s) sau %d lượt.',
                    name, len(reply), finish_reason, _attempt + 1)
                _mark_provider_up(name)
                return reply, None
            raise ValueError('AI provider returned an empty reply')
        except Exception as exc:
            app.logger.warning('AI provider "%s" failed: %s', name, exc)
            last_error = exc
            code, _ = _classify_provider_error(exc)
            if code in _COOLDOWN_ERROR_CODES:
                _mark_provider_down(name)
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
        provider = data.get('provider')  # tùy chọn: 'freellmapi', 'groq', ...
        
        if not isinstance(user_message, str) or not user_message.strip():
            return jsonify({'success': False, 'error': 'Vui lòng nhập nội dung cần tư vấn'}), 400
        if len(user_message) > 2000 or not isinstance(history, list):
            return jsonify({'success': False, 'error': 'Nội dung gửi lên không hợp lệ'}), 400

        # Ngữ cảnh người dùng (todo/schedule/hồ sơ cá nhân) để AI tư vấn sát thực tế hơn
        user_context = _summarize_projects(data.get('projects'))
        schedule_ctx = _summarize_schedule(data.get('schedule'))
        user_profile = data.get('user_profile')
        messages = _build_career_messages(user_message, history, user_context, schedule_ctx, user_profile=user_profile)

        # Gọi AI (tự nhận diện provider nếu không chỉ định)
        ai_reply, error = request_ai(messages, AI_MAX_TOKENS, provider=provider)
        if error:
            return error
        return jsonify({'success': True, 'reply': ai_reply})
    except Exception:
        app.logger.exception('Invalid career AI request')
        return jsonify({'success': False, 'error': 'Yêu cầu không thể xử lý.'}), 500

# ==================== AI CAREER - STREAMING (SSE) ====================

# Hợp đồng "hành động" (actions): ngoài câu trả lời bằng lời, AI được phép đề xuất
# thay đổi cho Todo và Thời khóa biểu bằng một khối JSON duy nhất ở cuối câu trả lời.
# Server chịu trách nhiệm đọc/kiểm tra/chuẩn hóa khối này (xem /api/ai-actions) rồi
# trả cho client; client chỉ hiển thị và áp dụng sau khi người dùng bấm xác nhận.
ACTION_PROMPT = ("""

## CHỈNH SỬA DỮ LIỆU (TODO & THỜI KHÓA BIỂU)
Bạn CÓ THỂ đề xuất thay đổi cho dữ liệu thật của người dùng. Khi — và chỉ khi —
người dùng yêu cầu tạo/sửa/xóa công việc, dự án, môn học hay tiết học, hãy:
1. Viết 1-3 câu ngắn nói bạn định thay đổi gì (như bình thường).
2. Đặt ở CUỐI câu trả lời đúng một khối mã như sau:
```studyverse-actions
{"actions": [ ... ]}
```

Các `type` được phép:
- `todo.create_project`: {name, deadline?}
- `todo.update_project`: {project, name?, deadline?}
- `todo.create_task`: {project, name, deadline?, priority?, estimate?, repeat?, subtasks?}
- `todo.update_task`: {project, task, patch: {name?, deadline?, priority?, estimate?, repeat?, status?}}
- `todo.delete_task`: {project, task}
- `schedule.add_subject`: {name, sessions?}
- `schedule.remove_subject`: {name}
- `schedule.set_lesson`: {day, slot, subject}
- `schedule.clear_lesson`: {day, slot}

Quy tắc bắt buộc:
- Dùng đúng tên dự án/công việc/môn học đã có trong dữ liệu khi sửa hoặc xóa.
- `deadline` dạng `YYYY-MM-DD`; `priority` là `low|medium|high`; `repeat` là `none|daily|weekly`;
  `status` là `todo|doing|done`.
- Thời khóa biểu: `day` là chỉ số thứ (0 = Thứ 2 … 6 = Chủ nhật), `slot` là chỉ số khung
  giờ trong danh sách `slots` của dữ liệu người dùng; chỉ xếp vào khung `type` = `lesson`.
  Môn học phải có trong `subjects` — nếu chưa có, thêm `schedule.add_subject` TRƯỚC đó.
- Không bịa id, không thêm giải thích bên trong khối JSON, không đặt khối ở giữa câu trả lời.
- Người dùng chỉ hỏi tư vấn/chia sẻ thì KHÔNG tạo khối này. Mỗi câu trả lời tối đa một khối.
""")

CAREER_SYSTEM_PROMPT = ("""
    Bạn là kumalala của Studyverse, trợ lý hướng nghiệp và học tập thông minh,
hài hước, thân thiện và thực tế.

## VAI TRÒ & KHẢ NĂNG KẾT NỐI
Bạn được tích hợp trực tiếp với hệ sinh thái học tập của người dùng trong Studyverse:
1. Quản lý dự án & công việc (Todo / My Project): Bạn có quyền đọc toàn bộ danh sách dự án, các công việc (tasks), hạn chót (deadline), trạng thái (todo/doing/done), và tiến độ hoàn thành.
2. Thời khóa biểu tương tác (Schedule): Bạn có quyền đọc danh sách môn học, số tiết/tuần, các khung giờ học/nghỉ, và lịch học cụ thể từ Thứ 2 đến Chủ nhật.
3. Đề xuất hành động trực tiếp: Bạn có thể đề xuất thêm/sửa/xóa dự án, việc cần làm hoặc xếp tiết thời khóa biểu cho người dùng thông qua khối studyverse-actions ở cuối câu trả lời.

## MỤC TIÊU
Giúp người dùng (học sinh/sinh viên) tìm ra hướng đi, phương pháp học, giải quyết 
deadline, cân đối thời gian biểu, xây dựng thói quen tốt và cảm hứng hành động — 
mà không gây áp lực "phải hoàn hảo".

## QUY TẮC TRẢ LỜI
1. Mở đầu tự nhiên: Khi tư vấn chung hoặc khích lệ, có thể mở đầu bằng một câu ngạn ngữ, châm ngôn hoặc câu hỏi nhẹ nhàng. Khi người dùng hỏi trực tiếp về dữ liệu (Todo, Thời khóa biểu, deadline, việc cần làm, tiến độ) hoặc hỏi về tính năng/khả năng của AI, hãy trả lời thẳng thắn, rõ ràng vào trọng tâm trước.
2. Đưa ra 2-4 bước hành động cụ thể, mỗi bước kèm lý do ngắn gọn.
3. Thân thiện, hài hước, không phán xét. Dùng châm biếm nhẹ nếu phù hợp.
4. Không hứa hẹn phi thực tế (ví dụ: "chỉ cần 1 tháng là giỏi").
5. Tận dụng dữ liệu thật của Todo & Thời khóa biểu:
   - Khi có dữ liệu thật (dự án, việc dở dang, môn học, lịch học) → BẮT BUỘC tra cứu và nhắc tên cụ thể các dự án, công việc, hạn chót, môn học để trả lời sát thực tế nhất.
   - Khi người dùng hỏi về khả năng đọc Todo và Thời khóa biểu (ví dụ: "khả năng đọc todo và schedule của AI đâu rồi", "bạn có đọc được bài tập của tôi không"): BẮT BUỘC khẳng định rõ bạn hoàn toàn có khả năng này và đang kết nối trực tiếp với dữ liệu của họ, sau đó báo cáo tóm tắt tình trạng Todo và Thời khóa biểu hiện tại.
   - Nếu danh sách Todo hoặc Thời khóa biểu đang trống → nói rõ hệ thống đã kết nối nhưng danh sách hiện chưa có dữ liệu (0 việc / 0 môn), hướng dẫn người dùng vào trang My project hoặc Schedule để thêm, hoặc đề xuất tạo giúp họ.
6. Kết bằng câu hỏi mở để tiếp tục trò chuyện (ví dụ: "Bạn muốn bắt đầu từ đâu?").

## PHONG CÁCH
- Ngôn ngữ: tiếng Việt, gọn, rõ, không lan man.
- Hài hước nhẹ để tạo thiện cảm, nhưng KHÔNG đùa cợt về vấn đề nghiêm túc.
- Tránh lời khuyên chung chung kiểu "hãy cố gắng lên"."""
) + ACTION_PROMPT


def _build_career_messages(user_message, history, user_context, schedule_ctx, user_profile=None):
    """Dựng mảng messages dùng chung cho các endpoint career-ai."""
    system = CAREER_SYSTEM_PROMPT

    context_sections = []
    has_projects = bool(user_context and isinstance(user_context, list) and len(user_context) > 0)
    if has_projects:
        context_sections.append(
            f"### DỮ LIỆU TODO & DỰ ÁN ({len(user_context)} dự án hiện có):\n"
            + json.dumps(user_context, ensure_ascii=False, indent=2)
        )
    else:
        context_sections.append(
            "### DỮ LIỆU TODO & DỰ ÁN:\n"
            "Danh sách Todo/Dự án hiện tại đang TRỐNG (người dùng chưa tạo dự án nào)."
        )

    has_schedule = bool(
        schedule_ctx
        and isinstance(schedule_ctx, dict)
        and (schedule_ctx.get('subjects') or schedule_ctx.get('timetable'))
    )
    if has_schedule:
        context_sections.append(
            "### DỮ LIỆU THỜI KHÓA BIỂU:\n"
            + json.dumps(schedule_ctx, ensure_ascii=False, indent=2)
        )
    elif schedule_ctx and isinstance(schedule_ctx, dict):
        context_sections.append(
            "### DỮ LIỆU THỜI KHÓA BIỂU:\n"
            "Thời khóa biểu hiện tại đang TRỐNG (chưa có môn học hoặc tiết học nào được xếp).\n"
            + json.dumps({'slots': schedule_ctx.get('slots', [])}, ensure_ascii=False)
        )
    else:
        context_sections.append(
            "### DỮ LIỆU THỜI KHÓA BIỂU:\n"
            "Thời khóa biểu hiện tại chưa có dữ liệu."
        )

    system += (
        "\n\n## DỮ LIỆU HỌC TẬP THỰC TẾ HIỆN TẠI CỦA NGƯỜI DÙNG\n"
        "Dưới đây là dữ liệu học tập thực tế đang kết nối từ hệ thống Studyverse:\n\n"
        + "\n\n".join(context_sections)
        + "\n\nQUY TẮC:\n"
        "- Nếu người dùng hỏi về công việc, tiến độ, môn học, deadline, lịch rảnh, kế hoạch học tập, hoặc hỏi về khả năng đọc dữ liệu của AI: BẮT BUỘC xác nhận bạn đọc được và sử dụng chính xác thông tin trên để giải đáp cụ thể theo từng dự án/môn học.\n"
        "- Nếu người dùng yêu cầu lập kế hoạch tuần, hãy đối chiếu các công việc còn dở trong Todo với các khung giờ trống trong Thời khóa biểu để gợi ý khung thời gian học tối ưu."
    )

    if user_profile and isinstance(user_profile, dict):
        profile_lines = []
        name = user_profile.get('displayName') or user_profile.get('display_name') or user_profile.get('name')
        if name and isinstance(name, str) and name.strip():
            profile_lines.append(f"- Tên gọi của người dùng: {name.strip()} (Hãy xưng hô hoặc chào hỏi trực tiếp với người dùng bằng tên này để tạo cảm giác gần gũi cá nhân hoá).")
        calling = user_profile.get('aiCalling') or user_profile.get('ai_calling')
        if calling and isinstance(calling, str) and calling.strip():
            profile_lines.append(f"- Đại từ xưng hô mong muốn: xưng hô dạng {calling.strip()}.")
        style = user_profile.get('aiStyle') or user_profile.get('ai_style')
        if style and isinstance(style, str) and style.strip():
            profile_lines.append(f"- Phong cách phản hồi: {style.strip()}.")
        streak = user_profile.get('streak')
        if streak:
            profile_lines.append(f"- Chuỗi ngày học tập liên tục (streak): {streak} ngày (Hãy khen ngợi hoặc khích lệ người dùng duy trì streak khi phù hợp).")
        daily_goal = user_profile.get('dailyGoal') or user_profile.get('daily_goal')
        if daily_goal and isinstance(daily_goal, str) and daily_goal.strip():
            profile_lines.append(f"- Mục tiêu học tập hàng ngày: {daily_goal.strip()}.")

        if profile_lines:
            system += "\n\n## THÔNG TIN HỒ SƠ & TÙY CHỌN CỦA NGƯỜI DÙNG:\n" + "\n".join(profile_lines)

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
    user_profile = data.get('user_profile')
    messages = _build_career_messages(user_message, history, user_context, schedule_ctx, user_profile=user_profile)

    def generate():
        queue = Queue()

        def on_delta(piece):
            queue.put(('delta', piece))

        def worker():
            try:
                reply, err = request_ai(messages, AI_MAX_TOKENS, provider=provider, on_delta=on_delta)
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
        ], AI_MAX_TOKENS, provider=provider)
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
        # Provider vừa lỗi khả dụng và đang tạm bỏ qua (circuit breaker).
        'cooling_down': [name for name in available if _provider_cooling_down(name)],
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
            # Tên + trạng thái từng công việc để AI biết chính xác cần sửa/xóa cái nào.
            'tasks': [
                {
                    'name': _clamp_str(t.get('name'), 80),
                    'status': _task_status(t),
                    'deadline': _clamp_str(t.get('deadline'), 20) or None,
                }
                for t in tasks[:30]
                if isinstance(t, dict) and t.get('name')
            ],
        })
    return out


def _task_status(task):
    """Trạng thái công việc đã chuẩn hóa (todo | doing | done)."""
    status = task.get('status')
    if status in ('todo', 'doing', 'done'):
        return status
    return 'done' if task.get('completed') else 'todo'


def _summarize_schedule(raw):
    """Rút gọn dữ liệu thời khóa biểu thành ngữ cảnh gọn cho AI.

    Kèm chỉ số thứ/khung giờ (`dayIndex`, `slot`) để AI chỉ đúng ô cần sửa khi đề xuất
    thay đổi (xem ACTION_PROMPT).
    """
    if not isinstance(raw, dict):
        return None

    slots = []
    period = 0
    raw_slots = raw.get('slots') if isinstance(raw.get('slots'), list) else []
    for idx, slot in enumerate(raw_slots[:40]):
        if not isinstance(slot, dict):
            continue
        is_lesson = slot.get('type') != 'break'
        if is_lesson:
            period += 1
        slots.append({
            'index': idx,
            'type': 'lesson' if is_lesson else 'break',
            'period': period if is_lesson else None,
            'start': _clamp_str(slot.get('start'), 5),
            'end': _clamp_str(slot.get('end'), 5),
        })

    subjects = []
    raw_subjects = raw.get('subjects') if isinstance(raw.get('subjects'), list) else []
    for subj in raw_subjects[:20]:
        if isinstance(subj, dict):
            name = _clamp_str(subj.get('name'), 40)
            if not name:
                continue
            entry = {'name': name}
            sessions = subj.get('sessions')
            if isinstance(sessions, (int, float)) and not isinstance(sessions, bool):
                entry['sessions'] = int(sessions)
            subjects.append(entry)
        elif isinstance(subj, str) and subj.strip():
            subjects.append({'name': _clamp_str(subj, 40)})

    grid = raw.get('timetableData') if isinstance(raw.get('timetableData'), list) else []
    timetable = []
    for day_idx, day_slots in enumerate(grid[:7]):
        if not isinstance(day_slots, list):
            continue
        lessons = [
            {'slot': slot_idx, 'name': _clamp_str(cell.get('name'), 40)}
            for slot_idx, cell in enumerate(day_slots[:40])
            if isinstance(cell, dict) and cell.get('type') == 'subject' and cell.get('name')
        ]
        if lessons:
            timetable.append({'dayIndex': day_idx, 'day': DAYS_EN[day_idx], 'lessons': lessons})

    disabled = raw.get('disabledDays') if isinstance(raw.get('disabledDays'), list) else []
    return {
        'subjects': subjects,
        'slots': slots,
        'timetable': timetable,
        'disabled_days': [DAYS_EN[i] for i, off in enumerate(disabled[:7]) if off is True],
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


# ==================== HÀNH ĐỘNG AI (ĐỀ XUẤT SỬA TODO / THỜI KHÓA BIỂU) ====================
# AI trả lời xong có thể kèm một khối JSON ở cuối (xem ACTION_PROMPT). Việc đọc,
# kiểm tra và chuẩn hóa khối đó do server làm — client chỉ hiển thị bản xem trước rồi
# ghi vào LocalStorage khi người dùng bấm xác nhận (xem svApplyAIActions trong shared.js).
ACTION_FENCE_LABELS = ('studyverse-actions', 'json-actions')
_ACTION_BLOCK_RE = re.compile(
    r'```[ \t]*(?P<label>[A-Za-z0-9_-]*)[ \t]*\r?\n(?P<body>.*?)```',
    re.DOTALL,
)
_SV_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')

MAX_ACTIONS = 20
MAX_ACTION_NAME = 120
MAX_DEADLINE_CHARS = 20
MAX_ESTIMATE_MINUTES = 1440
MAX_SUBJECT_SESSIONS = 20
TODO_PRIORITIES = ('low', 'medium', 'high')
TODO_REPEATS = ('none', 'daily', 'weekly')
TODO_STATUSES = ('todo', 'doing', 'done')


class _ActionProblem(Exception):
    """Một hành động AI đề xuất không hợp lệ hoặc không áp dụng được."""

    def __init__(self, code, params=None):
        super().__init__(code)
        self.code = code
        self.params = {k: v for k, v in (params or {}).items() if v is not None}


def _problem_payload(problem):
    return {'code': problem.code, 'params': problem.params}


def extract_action_payload(reply):
    """Tách khối JSON hành động khỏi câu trả lời của AI.

    Trả về (payload, parse_error). Không có khối nào → (None, None).
    """
    if not isinstance(reply, str):
        return None, None

    for match in _ACTION_BLOCK_RE.finditer(reply):
        label = (match.group('label') or '').strip().lower()
        body = match.group('body').strip()
        if not body:
            continue
        if label and label not in ACTION_FENCE_LABELS:
            continue
        try:
            parsed = json.loads(body)
        except (TypeError, ValueError):
            if label:
                return None, 'invalid_json'
            continue
        if isinstance(parsed, dict) and isinstance(parsed.get('actions'), list):
            return parsed, None
        if label:
            return None, 'invalid_shape'

    # Phòng hờ model trả JSON trần (không bọc trong ```): chỉ nhận khi cả câu trả lời
    # đúng là một object có khóa "actions", tránh nhầm với dấu ngoặc trong văn xuôi.
    stripped = reply.strip()
    if stripped.startswith('{') and stripped.endswith('}'):
        try:
            parsed = json.loads(stripped)
        except (TypeError, ValueError):
            return None, None
        if isinstance(parsed, dict) and isinstance(parsed.get('actions'), list):
            return parsed, None
    return None, None


def _action_int(value, low, high, code='badValue'):
    """Ép giá trị về số nguyên trong khoảng [low, high] (bool không tính là số)."""
    number = None
    if isinstance(value, int) and not isinstance(value, bool):
        number = value
    elif isinstance(value, float) and value.is_integer():
        number = int(value)
    elif isinstance(value, str) and value.strip().lstrip('-').isdigit():
        number = int(value.strip())
    if number is None or not low <= number <= high:
        raise _ActionProblem(code)
    return number


def _action_name(value, limit=MAX_ACTION_NAME):
    name = _clamp_str(value, limit)
    if not name:
        raise _ActionProblem('missingName')
    return name


def _action_deadline(value):
    """Đọc hạn chót (YYYY-MM-DD). Trả về: None = không đổi, '' = xoá hạn, chuỗi = hạn mới."""
    if value is None:
        return ''
    text = _clamp_str(value, MAX_DEADLINE_CHARS)
    if not text:
        return ''
    if not _SV_DATE_RE.match(text):
        raise _ActionProblem('badDeadline', {'value': text})
    return text


def _action_enum(action, key, allowed, default=None):
    value = action.get(key)
    if value is None or (isinstance(value, str) and not value.strip()):
        return default
    text = _clamp_str(value, 20).lower()
    if text not in allowed:
        raise _ActionProblem('badValue', {'field': key})
    return text


def _resolve_project(value, ctx):
    name = _action_name(value, 80)
    entry = ctx['projects'].get(name.lower())
    if entry is None:
        raise _ActionProblem('noProject', {'name': name})
    return entry


def _resolve_task(action, ctx, project):
    task_name = _action_name(action.get('task'))
    if task_name.lower() not in project['tasks']:
        raise _ActionProblem('noTask', {'name': task_name, 'project': project['name']})
    return project['tasks'][task_name.lower()]


def _resolve_subject(action, ctx):
    name = _action_name(action.get('name', action.get('subject')), 40)
    if name.lower() not in ctx['subjects']:
        raise _ActionProblem('noSubject', {'name': name})
    return name


def _resolve_slot(action, ctx):
    day = _action_int(action.get('day'), 0, 6, code='badDay')
    slot = _action_int(action.get('slot'), 0, max(len(ctx['slots']) - 1, 0), code='badSlot')
    slot_info = ctx['slots'][slot] if slot < len(ctx['slots']) else None
    if not slot_info or slot_info.get('type') == 'break':
        raise _ActionProblem('notLessonSlot', {'slot': slot})
    return day, slot, slot_info


def _slot_label(slot_info, slot_index):
    """Giờ + số tiết của một khung (để hiển thị trong bản xem trước)."""
    start = _clamp_str(slot_info.get('start'), 5)
    end = _clamp_str(slot_info.get('end'), 5)
    return {
        'slot': slot_index,
        'time': f'{start} - {end}' if start and end else '',
        'period': slot_info.get('period') or slot_index + 1,
    }


def _build_action_context(raw_projects, raw_schedule):
    """Ngữ cảnh để kiểm tra hành động: dự án/công việc/môn học đang có + khung giờ."""
    projects = {}
    if isinstance(raw_projects, list):
        for proj in raw_projects[:50]:
            if not isinstance(proj, dict):
                continue
            name = _clamp_str(proj.get('name'), 80)
            if not name:
                continue
            tasks = {}
            if isinstance(proj.get('tasks'), list):
                for task in proj['tasks']:
                    if not isinstance(task, dict):
                        continue
                    task_name = _clamp_str(task.get('name'), MAX_ACTION_NAME)
                    if task_name:
                        tasks[task_name.lower()] = task_name
            projects[name.lower()] = {'name': name, 'tasks': tasks}

    schedule = raw_schedule if isinstance(raw_schedule, dict) else {}
    slots = []
    raw_slots = schedule.get('slots')
    if isinstance(raw_slots, list):
        for idx, slot in enumerate(raw_slots[:40]):
            if not isinstance(slot, dict):
                continue
            is_lesson = slot.get('type') != 'break'
            slots.append({
                'index': idx,
                'type': 'lesson' if is_lesson else 'break',
                'start': _clamp_str(slot.get('start'), 5),
                'end': _clamp_str(slot.get('end'), 5),
                'period': None,
            })
    period = 0
    for slot in slots:
        if slot['type'] == 'lesson':
            period += 1
            slot['period'] = period

    subjects = set()
    raw_subjects = schedule.get('subjects')
    if isinstance(raw_subjects, list):
        for subj in raw_subjects:
            name = subj.get('name') if isinstance(subj, dict) else subj
            if isinstance(name, str) and name.strip():
                subjects.add(name.strip().lower())

    grid = schedule.get('timetableData') if isinstance(schedule.get('timetableData'), list) else []
    return {'projects': projects, 'slots': slots, 'subjects': subjects, 'grid': grid}


def _grid_cell(ctx, day, slot):
    row = ctx['grid'][day] if day < len(ctx['grid']) and isinstance(ctx['grid'][day], list) else []
    cell = row[slot] if slot < len(row) else None
    return cell if isinstance(cell, dict) else None


# ----- từng loại hành động: trả về (hành động đã chuẩn hóa, [dòng mô tả thay đổi]) -----
def _norm_create_project(action, ctx):
    name = _action_name(action.get('name'), 80)
    if name.lower() in ctx['projects']:
        raise _ActionProblem('projectExists', {'name': name})
    deadline = _action_deadline(action.get('deadline'))
    ctx['projects'][name.lower()] = {'name': name, 'tasks': {}}
    return (
        {'type': 'todo.create_project', 'target': 'todo', 'name': name, 'deadline': deadline},
        [{'key': 'aiAct.sum.projectCreate', 'target': 'todo', 'params': {'name': name, 'deadline': deadline}}],
    )


def _norm_update_project(action, ctx):
    project = _resolve_project(action.get('project'), ctx)
    lines = []
    new_name = None
    if action.get('name') is not None:
        new_name = _action_name(action.get('name'), 80)
        if new_name.lower() != project['name'].lower() and new_name.lower() in ctx['projects']:
            raise _ActionProblem('projectExists', {'name': new_name})
        lines.append({'key': 'aiAct.sum.projectRename', 'target': 'todo',
                      'params': {'project': project['name'], 'name': new_name}})
    deadline = None
    if 'deadline' in action:
        deadline = _action_deadline(action.get('deadline'))
        lines.append({'key': 'aiAct.sum.projectDeadline', 'target': 'todo',
                      'params': {'project': new_name or project['name'], 'deadline': deadline}})
    if not lines:
        raise _ActionProblem('nothingToChange')
    if new_name:
        ctx['projects'].pop(project['name'].lower(), None)
        project['name'] = new_name
        ctx['projects'][new_name.lower()] = project
    normalized = {'type': 'todo.update_project', 'target': 'todo', 'project': project['name']}
    if new_name:
        normalized['name'] = new_name
    if 'deadline' in action:
        normalized['deadline'] = deadline
    return normalized, lines


def _norm_create_task(action, ctx):
    project = _resolve_project(action.get('project'), ctx)
    name = _action_name(action.get('name'))
    if name.lower() in project['tasks']:
        raise _ActionProblem('taskExists', {'name': name, 'project': project['name']})
    deadline = _action_deadline(action.get('deadline'))
    priority = _action_enum(action, 'priority', TODO_PRIORITIES, 'medium')
    repeat = _action_enum(action, 'repeat', TODO_REPEATS, 'none')
    estimate = 25 if action.get('estimate') is None else _action_int(
        action.get('estimate'), 1, MAX_ESTIMATE_MINUTES, code='badEstimate')
    subtasks = []
    raw_subtasks = action.get('subtasks')
    if isinstance(raw_subtasks, list):
        for subtask in raw_subtasks[:10]:
            label = _clamp_str(subtask.get('name') if isinstance(subtask, dict) else subtask, 80)
            if label:
                subtasks.append(label)
    normalized = {
        'type': 'todo.create_task', 'target': 'todo', 'project': project['name'], 'name': name,
        'deadline': deadline, 'priority': priority, 'estimate': estimate, 'repeat': repeat,
        'subtasks': subtasks,
    }
    project['tasks'][name.lower()] = name
    return normalized, [{'key': 'aiAct.sum.taskCreate', 'target': 'todo',
                         'params': {'project': project['name'], 'name': name, 'deadline': deadline}}]


def _norm_update_task(action, ctx):
    project = _resolve_project(action.get('project'), ctx)
    task_name = _resolve_task(action, ctx, project)
    raw_patch = action.get('patch') if isinstance(action.get('patch'), dict) else {}
    patch = {}
    lines = []
    if raw_patch.get('name') is not None:
        new_name = _action_name(raw_patch.get('name'))
        if new_name.lower() != task_name.lower() and new_name.lower() in project['tasks']:
            raise _ActionProblem('taskExists', {'name': new_name, 'project': project['name']})
        patch['name'] = new_name
        lines.append({'key': 'aiAct.sum.taskRename', 'target': 'todo',
                      'params': {'task': task_name, 'name': new_name}})
    if 'deadline' in raw_patch:
        patch['deadline'] = _action_deadline(raw_patch.get('deadline'))
        lines.append({'key': 'aiAct.sum.taskDeadline', 'target': 'todo',
                      'params': {'task': task_name, 'deadline': patch['deadline']}})
    for field, allowed, key in (
        ('priority', TODO_PRIORITIES, 'aiAct.sum.taskPriority'),
        ('repeat', TODO_REPEATS, 'aiAct.sum.taskRepeat'),
        ('status', TODO_STATUSES, 'aiAct.sum.taskStatus'),
    ):
        if field in raw_patch:
            value = _action_enum(raw_patch, field, allowed)
            if value is None:
                continue
            patch[field] = value
            lines.append({'key': key, 'target': 'todo', 'params': {'task': task_name, field: value}})
    if 'estimate' in raw_patch:
        patch['estimate'] = _action_int(raw_patch.get('estimate'), 1, MAX_ESTIMATE_MINUTES,
                                       code='badEstimate')
        lines.append({'key': 'aiAct.sum.taskEstimate', 'target': 'todo',
                      'params': {'task': task_name, 'minutes': patch['estimate']}})
    if not patch:
        raise _ActionProblem('nothingToChange')
    if 'name' in patch:
        project['tasks'].pop(task_name.lower(), None)
        project['tasks'][patch['name'].lower()] = patch['name']
        task_name = patch['name']
    return (
        {'type': 'todo.update_task', 'target': 'todo', 'project': project['name'],
         'task': task_name, 'patch': patch},
        lines,
    )


def _norm_delete_task(action, ctx):
    project = _resolve_project(action.get('project'), ctx)
    task_name = _resolve_task(action, ctx, project)
    project['tasks'].pop(task_name.lower(), None)
    return (
        {'type': 'todo.delete_task', 'target': 'todo', 'project': project['name'], 'task': task_name},
        [{'key': 'aiAct.sum.taskDelete', 'target': 'todo',
          'params': {'project': project['name'], 'name': task_name}}],
    )


def _norm_add_subject(action, ctx):
    name = _action_name(action.get('name'), 40)
    if name.lower() in ctx['subjects']:
        raise _ActionProblem('subjectExists', {'name': name})
    sessions = 1
    if action.get('sessions') is not None:
        sessions = _action_int(action.get('sessions'), 1, MAX_SUBJECT_SESSIONS, code='badSessions')
    ctx['subjects'].add(name.lower())
    return (
        {'type': 'schedule.add_subject', 'target': 'schedule', 'name': name, 'sessions': sessions},
        [{'key': 'aiAct.sum.subjectAdd', 'target': 'schedule', 'params': {'name': name, 'sessions': sessions}}],
    )


def _norm_remove_subject(action, ctx):
    name = _resolve_subject(action, ctx)
    ctx['subjects'].discard(name.lower())
    removed = 0
    for row in ctx['grid']:
        if not isinstance(row, list):
            continue
        removed += sum(1 for cell in row if isinstance(cell, dict)
                       and cell.get('type') == 'subject' and str(cell.get('name', '')).strip().lower() == name.lower())
    return (
        {'type': 'schedule.remove_subject', 'target': 'schedule', 'name': name, 'removed_lessons': removed},
        [{'key': 'aiAct.sum.subjectRemove', 'target': 'schedule', 'params': {'name': name}}],
    )


def _norm_set_lesson(action, ctx):
    subject = _resolve_subject(action, ctx)
    day, slot, slot_info = _resolve_slot(action, ctx)
    cell = _grid_cell(ctx, day, slot)
    replaced = None
    if cell and cell.get('type') == 'subject' and str(cell.get('name', '')).strip():
        current = str(cell['name']).strip()
        if current.lower() == subject.lower():
            raise _ActionProblem('lessonAlreadySet', {'name': current})
        replaced = current
    label = _slot_label(slot_info, slot)
    return (
        {'type': 'schedule.set_lesson', 'target': 'schedule', 'day': day, 'slot': slot,
         'subject': subject, 'replaced': replaced},
        [{'key': 'aiAct.sum.lessonSet', 'target': 'schedule',
          'params': {'dayIndex': day, 'time': label['time'], 'period': label['period'],
                     'name': subject, 'replaced': replaced}}],
    )


def _norm_clear_lesson(action, ctx):
    day, slot, slot_info = _resolve_slot(action, ctx)
    cell = _grid_cell(ctx, day, slot)
    if not cell or cell.get('type') != 'subject' or not str(cell.get('name', '')).strip():
        raise _ActionProblem('lessonEmpty', {})
    removed = str(cell['name']).strip()
    label = _slot_label(slot_info, slot)
    return (
        {'type': 'schedule.clear_lesson', 'target': 'schedule', 'day': day, 'slot': slot},
        [{'key': 'aiAct.sum.lessonClear', 'target': 'schedule',
          'params': {'dayIndex': day, 'time': label['time'], 'period': label['period'], 'name': removed}}],
    )


ACTION_NORMALIZERS = {
    'todo.create_project': _norm_create_project,
    'todo.update_project': _norm_update_project,
    'todo.create_task': _norm_create_task,
    'todo.update_task': _norm_update_task,
    'todo.delete_task': _norm_delete_task,
    'schedule.add_subject': _norm_add_subject,
    'schedule.remove_subject': _norm_remove_subject,
    'schedule.set_lesson': _norm_set_lesson,
    'schedule.clear_lesson': _norm_clear_lesson,
}


def normalize_actions(raw_actions, raw_projects, raw_schedule):
    """Kiểm tra + chuẩn hóa danh sách hành động AI đề xuất.

    Trả về (actions, summary, problems): `actions` là thay đổi đã chuẩn hóa để client
    áp dụng theo đúng thứ tự, `summary` là các dòng mô tả (khóa i18n) cho bản xem trước,
    `problems` là các hành động bị bỏ kèm lý do.
    """
    ctx = _build_action_context(raw_projects, raw_schedule)
    actions, summary, problems = [], [], []

    if not isinstance(raw_actions, list):
        return actions, summary, [{'code': 'invalid_shape', 'params': {}}]

    for index, item in enumerate(raw_actions):
        if len(actions) >= MAX_ACTIONS:
            problems.append({'code': 'tooManyActions', 'params': {'max': MAX_ACTIONS}})
            break
        if not isinstance(item, dict):
            problems.append({'code': 'invalid_shape', 'params': {'index': index + 1}})
            continue
        action_type = _clamp_str(item.get('type'), 40)
        normalizer = ACTION_NORMALIZERS.get(action_type)
        if normalizer is None:
            problems.append({'code': 'unknownType', 'params': {'type': action_type or '?'}})
            continue
        try:
            normalized, lines = normalizer(item, ctx)
        except _ActionProblem as problem:
            problems.append(_problem_payload(problem))
            continue
        except Exception:  # hành động dị dạng không được làm hỏng cả phản hồi
            app.logger.exception('normalize action failed (%s)', action_type)
            problems.append({'code': 'invalid_shape', 'params': {'index': index + 1}})
            continue
        actions.append(normalized)
        summary.extend(lines)

    return actions, summary, problems


@app.route('/api/ai-actions', methods=['POST'])
def ai_actions_preview():
    """Đọc khối hành động ở cuối câu trả lời AI → thay đổi đã kiểm tra cho Todo/TKB.

    Body: {reply, projects?, schedule?}. Trả về {actions, summary, problems}; server
    KHÔNG lưu dữ liệu và không tự áp dụng — client hiển thị cho người dùng duyệt trước.
    """
    data, error = get_json_body()
    if error:
        return error

    reply = data.get('reply')
    if not isinstance(reply, str) or len(reply) > 20000:
        return jsonify({'error': 'Dữ liệu không hợp lệ'}), 400

    payload, parse_error = extract_action_payload(reply)
    if parse_error:
        return jsonify({'actions': [], 'summary': [], 'problems': [{'code': parse_error, 'params': {}}]})
    if payload is None:
        return jsonify({'actions': [], 'summary': [], 'problems': []})

    actions, summary, problems = normalize_actions(
        payload.get('actions'), data.get('projects'), data.get('schedule')
    )
    return jsonify({'actions': actions, 'summary': summary, 'problems': problems})


# khởi chạy app
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
