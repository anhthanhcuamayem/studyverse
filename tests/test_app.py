"""Test backend Flask (app.py): static, validation, AI endpoints (đã mock), provider errors.

Chạy: .venv/bin/pytest
Không test nào gọi mạng tới nhà cung cấp AI — request_ai luôn được mock.
"""
import json

import pytest

import app as app_module
from app import PUBLIC_FILES, app as flask_app


@pytest.fixture
def client():
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def _reset_provider_state():
    """Circuit breaker / client cache không được rò rỉ giữa các test."""
    def clean():
        app_module._reset_provider_health()
        for cfg in app_module.AI_PROVIDERS.values():
            cfg.pop('_client', None)
    clean()
    yield
    clean()


# ===================== FILE TĨNH =====================
def test_public_files_are_served(client):
    for path in sorted(PUBLIC_FILES):
        response = client.get('/' + path)
        assert response.status_code == 200, path


def test_index_root_serves_home(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'<html' in response.data.lower()


def test_route_aliases_are_served(client):
    for alias in ['account', 'career', 'schedule', 'todo', 'flashcard']:
        res1 = client.get(f'/{alias}')
        assert res1.status_code == 200, f'GET /{alias} failed'
        res2 = client.get(f'/{alias}/')
        assert res2.status_code == 200, f'GET /{alias}/ failed'



@pytest.mark.parametrize('path', [
    'app.py', 'schedule/schedule_utils.py', '.env', '.env.example',
    'README.md', 'requirements.txt', 'conftest.py', 'pytest.ini',
    '.git/config', 'shared.js.bak', 'nope.js',
])
def test_private_and_unknown_paths_404(client, path):
    assert client.get('/' + path).status_code == 404


# ===================== ENDPOINTS CƠ BẢN =====================
def test_health(client):
    data = client.get('/api/health').get_json()
    assert data['status'] == 'ok'
    assert isinstance(data['ai_configured'], bool)
    assert isinstance(data['providers'], list)


def test_ai_providers_shape(client):
    data = client.get('/api/ai-providers').get_json()
    assert set(['available', 'default', 'supported']).issubset(data)
    assert 'freellmapi' in data['supported']
    assert 'groq' in data['supported']
    assert isinstance(data['available'], list)


def test_ai_providers_probe_shape(client, monkeypatch):
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['groq'])
    monkeypatch.setattr(app_module, 'probe_provider', lambda name, timeout=8.0: {
        'configured': True, 'healthy': False, 'code': 'invalid_key', 'message': 'x',
    })
    data = client.get('/api/ai-providers?probe=1').get_json()
    assert data['health']['groq']['code'] == 'invalid_key'


def test_public_config(client):
    data = client.get('/api/public-config').get_json()
    assert 'supabaseUrl' in data and 'supabasePublishableKey' in data


# ===================== VALIDATION =====================
def test_career_ai_rejects_bad_json(client):
    response = client.post('/api/career-ai', data='not json', content_type='application/json')
    assert response.status_code == 400


@pytest.mark.parametrize('payload', [
    {},
    {'message': '   '},
    {'message': 'x' * 2001},
    {'message': 'hi', 'history': 'not-a-list'},
    {'message': 123},
])
def test_career_ai_validation(client, payload):
    response = client.post('/api/career-ai', json=payload)
    assert response.status_code == 400


def test_career_ai_success(client, monkeypatch):
    monkeypatch.setattr(app_module, 'request_ai', lambda *a, **k: ('Xin chào', None))
    response = client.post('/api/career-ai', json={'message': 'Tư vấn giúp em'})
    assert response.status_code == 200
    assert response.get_json() == {'success': True, 'reply': 'Xin chào'}


@pytest.mark.parametrize('payload', [
    {},
    {'topic': ''},
    {'topic': 'x' * 1001},
    {'topic': 42},
])
def test_suggest_validation(client, payload):
    assert client.post('/api/suggest', json=payload).status_code == 400


def test_suggest_success(client, monkeypatch):
    monkeypatch.setattr(app_module, 'request_ai', lambda *a, **k: ('Học đều mỗi ngày', None))
    response = client.post('/api/suggest', json={'topic': 'Toán'})
    assert response.status_code == 200
    assert response.get_json()['suggestion'] == 'Học đều mỗi ngày'


def test_ai_endpoints_use_full_token_budget(client, monkeypatch):
    """Mọi endpoint phải cho AI tối đa AI_MAX_TOKENS token, không cắt ngắn budget."""
    seen = []

    def fake_request_ai(messages, max_tokens, provider=None, on_delta=None):
        seen.append(max_tokens)
        if on_delta:
            on_delta('ok')
        return 'ok', None

    monkeypatch.setattr(app_module, 'request_ai', fake_request_ai)

    assert app_module.AI_MAX_TOKENS == 4096
    assert client.post('/api/career-ai', json={'message': 'hi'}).status_code == 200
    assert client.post('/api/suggest', json={'topic': 'Toán'}).status_code == 200
    assert client.post('/api/career-ai-stream', json={'message': 'hi'}).status_code == 200
    assert seen == [app_module.AI_MAX_TOKENS] * 3


# ===================== STREAMING =====================
def test_career_stream_success(client, monkeypatch):
    def fake_stream(messages, max_tokens, provider=None, on_delta=None):
        if on_delta:
            for piece in ['Xin ', 'chào ', 'bạn']:
                on_delta(piece)
        return 'Xin chào bạn', None

    monkeypatch.setattr(app_module, 'request_ai', fake_stream)
    response = client.post('/api/career-ai-stream', json={'message': 'hi'})
    assert response.status_code == 200
    assert response.mimetype == 'text/event-stream'
    body = response.get_data(as_text=True)
    assert '"delta": "Xin "' in body
    assert '"success": true' in body
    assert body.rstrip().endswith('data: [DONE]')


def test_career_stream_error_is_reported(client, monkeypatch):
    def fake_error(messages, max_tokens, provider=None, on_delta=None):
        return None, ({'error': 'Tài khoản hết số dư', 'code': 'no_balance'}, 502)

    monkeypatch.setattr(app_module, 'request_ai', fake_error)
    body = client.post('/api/career-ai-stream', json={'message': 'hi'}).get_data(as_text=True)
    assert '"success": false' in body
    assert 'no_balance' in body
    assert body.rstrip().endswith('data: [DONE]')


def test_career_stream_validation(client):
    assert client.post('/api/career-ai-stream', json={'message': ''}).status_code == 400


# ===================== SCHEDULE OPTIMIZE =====================
def _valid_schedule_payload():
    return {
        'subjects': [{'name': 'Toán', 'sessions': 2}, {'name': 'Lý', 'sessions': 1}],
        'availability': {
            '0': [{'start': '07:00', 'end': '11:00'}],
            '2': [{'start': '13:00', 'end': '17:00'}],
        },
        'breaks': [{'start': '11:30', 'end': '12:30'}],
        'preferences': {'preferred_slots': ['morning'], 'avoid_days': []},
        'lesson_duration': 45,
    }


def test_schedule_optimize_success(client):
    data = client.post('/api/schedule-optimize', json=_valid_schedule_payload()).get_json()
    assert len(data['timetable']) == 7
    placed = [lesson for day in data['timetable'] for lesson in day]
    assert len(placed) == 3
    assert all(lesson['subject'] in ('Toán', 'Lý') for lesson in placed)


@pytest.mark.parametrize('mutate', [
    lambda p: p.update(subjects='x'),
    lambda p: p.update(availability=[]),
    lambda p: p.update(lesson_duration=0),
    lambda p: p.update(lesson_duration=True),
    lambda p: p.update(lesson_duration=500),
    lambda p: p.update(lesson_duration=45.5),
])
def test_schedule_optimize_validation(client, mutate):
    payload = _valid_schedule_payload()
    mutate(payload)
    assert client.post('/api/schedule-optimize', json=payload).status_code == 400


def test_schedule_optimize_rejects_too_many_subjects(client):
    payload = _valid_schedule_payload()
    payload['subjects'] = [{'name': f'M{i}', 'sessions': 1} for i in range(51)]
    assert client.post('/api/schedule-optimize', json=payload).status_code == 400


def test_schedule_optimize_rejects_too_many_sessions(client):
    payload = _valid_schedule_payload()
    payload['subjects'] = [{'name': 'Toán', 'sessions': 501}]
    assert client.post('/api/schedule-optimize', json=payload).status_code == 400


# ===================== AI CONTEXT =====================
def test_ai_context_summarizes(client):
    payload = {
        'projects': [{
            'name': 'Ôn thi', 'deadline': '30/04/2026',
            'tasks': [{'name': 'Đọc bài', 'completed': True}, {'name': 'Làm đề', 'completed': False}],
        }],
        'schedule': {
            'subjects': ['Toán'],
            'timetableData': [[{'type': 'subject', 'name': 'Toán'}]],
        },
    }
    data = client.post('/api/ai-context', json=payload).get_json()
    project = data['projects'][0]
    assert project['total_tasks'] == 2 and project['completed_tasks'] == 1
    assert project['open_tasks'] == ['Làm đề']
    assert data['schedule']['timetable'][0]['day'] == 'Monday'


def test_ai_context_handles_junk(client):
    data = client.post('/api/ai-context', json={'projects': 'x', 'schedule': 3}).get_json()
    assert data == {'projects': [], 'schedule': None}


def test_ai_context_projects_include_task_status(client):
    payload = {'projects': [{
        'name': 'Ôn thi',
        'tasks': [
            {'name': 'Đọc bài', 'status': 'doing'},
            {'name': 'Làm đề', 'completed': True},
        ],
    }]}
    data = client.post('/api/ai-context', json=payload).get_json()
    assert data['projects'][0]['tasks'] == [
        {'name': 'Đọc bài', 'status': 'doing', 'deadline': None},
        {'name': 'Làm đề', 'status': 'done', 'deadline': None},
    ]


def test_ai_context_schedule_keeps_slot_indices(client):
    """AI cần chỉ số thứ/khung giờ và số tiết để đề xuất thay đổi đúng ô."""
    data = client.post('/api/ai-context', json={'schedule': _schedule_fixture()}).get_json()
    schedule = data['schedule']
    assert schedule['subjects'] == [{'name': 'Toán', 'sessions': 2}]
    assert [slot['type'] for slot in schedule['slots']] == ['lesson', 'break', 'lesson']
    assert [slot['period'] for slot in schedule['slots']] == [1, None, 2]
    assert schedule['timetable'][0] == {
        'dayIndex': 0,
        'day': 'Monday',
        'lessons': [{'slot': 0, 'name': 'Toán'}, {'slot': 2, 'name': 'Lý'}],
    }


# ===================== AI ACTIONS (ĐỀ XUẤT SỬA TODO / TKB) =====================
def _schedule_fixture():
    return {
        'subjects': [{'name': 'Toán', 'sessions': 2, 'color': '#007AFF'}],
        'slots': [
            {'id': 'p1', 'type': 'lesson', 'start': '07:00', 'end': '07:45'},
            {'id': 'b-big', 'type': 'break', 'start': '07:45', 'end': '08:05'},
            {'id': 'p2', 'type': 'lesson', 'start': '08:05', 'end': '08:50'},
        ],
        'timetableData': [
            [{'type': 'subject', 'name': 'Toán'}, None, {'type': 'subject', 'name': 'Lý'}],
            [None, None, None],
        ],
    }


def _projects_fixture():
    return [{'name': 'Ôn thi', 'deadline': '2026-04-30', 'tasks': [
        {'id': 1, 'name': 'Đọc bài', 'status': 'todo', 'completed': False},
    ]}]


def _reply_with(actions):
    block = json.dumps({'actions': actions}, ensure_ascii=False)
    return f'Dạ đây là kế hoạch của bạn nhé.\n```studyverse-actions\n{block}\n```\n'


def _plan(client, reply, projects=None, schedule=None):
    payload = {'reply': reply}
    if projects is not None:
        payload['projects'] = projects
    if schedule is not None:
        payload['schedule'] = schedule
    return client.post('/api/ai-actions', json=payload)


def test_ai_actions_without_block_returns_empty_plan(client):
    data = _plan(client, 'Bạn nên học đều mỗi ngày nhé!').get_json()
    assert data == {'actions': [], 'summary': [], 'problems': []}


def test_ai_actions_requires_reply(client):
    assert client.post('/api/ai-actions', json={'projects': []}).status_code == 400
    assert client.post('/api/ai-actions', json={'reply': 5}).status_code == 400


def test_ai_actions_normalizes_new_task(client):
    data = _plan(client, _reply_with([{
        'type': 'todo.create_task', 'project': 'Ôn thi', 'name': 'Làm đề 1',
        'deadline': '2026-04-20', 'priority': 'high', 'estimate': 60,
        'repeat': 'weekly', 'subtasks': ['Đề số 1', 'Đề số 2'],
    }]), projects=_projects_fixture()).get_json()

    assert data['problems'] == []
    action = data['actions'][0]
    assert action == {
        'type': 'todo.create_task', 'target': 'todo', 'project': 'Ôn thi', 'name': 'Làm đề 1',
        'deadline': '2026-04-20', 'priority': 'high', 'estimate': 60, 'repeat': 'weekly',
        'subtasks': ['Đề số 1', 'Đề số 2'],
    }
    assert data['summary'][0]['key'] == 'aiAct.sum.taskCreate'
    assert data['summary'][0]['params']['project'] == 'Ôn thi'


def test_ai_actions_defaults_and_enum_validation(client):
    data = _plan(client, _reply_with([
        {'type': 'todo.create_task', 'project': 'Ôn thi', 'name': 'Việc mới'},
        {'type': 'todo.create_task', 'project': 'Ôn thi', 'name': 'Việc sai', 'priority': 'urgent'},
        {'type': 'todo.create_task', 'project': 'Ôn thi', 'name': 'Việc sai hạn', 'deadline': '20/04/2026'},
    ]), projects=_projects_fixture()).get_json()

    assert data['actions'][0]['priority'] == 'medium'
    assert data['actions'][0]['estimate'] == 25
    assert data['actions'][0]['repeat'] == 'none'
    assert [p['code'] for p in data['problems']] == ['badValue', 'badDeadline']


def test_ai_actions_reports_unknown_project_and_task(client):
    data = _plan(client, _reply_with([
        {'type': 'todo.create_task', 'project': 'Không có', 'name': 'X'},
        {'type': 'todo.update_task', 'project': 'Ôn thi', 'task': 'Không có', 'patch': {'status': 'done'}},
    ]), projects=_projects_fixture()).get_json()

    assert data['actions'] == []
    assert [p['code'] for p in data['problems']] == ['noProject', 'noTask']
    assert data['problems'][0]['params']['name'] == 'Không có'


def test_ai_actions_update_and_delete_task(client):
    data = _plan(client, _reply_with([
        {'type': 'todo.update_task', 'project': 'Ôn thi', 'task': 'Đọc bài',
         'patch': {'name': 'Đọc kỹ bài', 'status': 'done', 'priority': 'low', 'estimate': 45}},
        {'type': 'todo.delete_task', 'project': 'Ôn thi', 'task': 'Đọc kỹ bài'},
    ]), projects=_projects_fixture()).get_json()

    assert data['problems'] == []
    assert data['actions'][0]['task'] == 'Đọc kỹ bài'
    assert data['actions'][0]['patch'] == {
        'name': 'Đọc kỹ bài', 'status': 'done', 'priority': 'low', 'estimate': 45,
    }
    # Sau khi đổi tên, hành động xóa phải resolve theo tên MỚI (thứ tự áp dụng quan trọng).
    assert data['actions'][1] == {
        'type': 'todo.delete_task', 'target': 'todo', 'project': 'Ôn thi', 'task': 'Đọc kỹ bài',
    }
    keys = [entry['key'] for entry in data['summary']]
    assert keys[:4] == ['aiAct.sum.taskRename', 'aiAct.sum.taskPriority',
                        'aiAct.sum.taskStatus', 'aiAct.sum.taskEstimate']


def test_ai_actions_project_create_then_task(client):
    data = _plan(client, _reply_with([
        {'type': 'todo.create_project', 'name': 'Học tiếng Anh', 'deadline': '2026-05-01'},
        {'type': 'todo.create_task', 'project': 'Học tiếng Anh', 'name': 'Học 30 phút'},
        {'type': 'todo.create_project', 'name': 'Ôn thi'},
    ]), projects=_projects_fixture()).get_json()

    assert [a['type'] for a in data['actions']] == ['todo.create_project', 'todo.create_task']
    assert [p['code'] for p in data['problems']] == ['projectExists']


def test_ai_actions_schedule_needs_subject_before_lesson(client):
    data = _plan(client, _reply_with([
        {'type': 'schedule.set_lesson', 'day': 0, 'slot': 2, 'subject': 'Văn'},
    ]), schedule=_schedule_fixture()).get_json()
    assert data['actions'] == []
    assert data['problems'][0]['code'] == 'noSubject'

    data = _plan(client, _reply_with([
        {'type': 'schedule.add_subject', 'name': 'Văn', 'sessions': 4},
        {'type': 'schedule.set_lesson', 'day': 0, 'slot': 2, 'subject': 'Văn'},
    ]), schedule=_schedule_fixture()).get_json()

    assert data['problems'] == []
    assert data['actions'][0] == {'type': 'schedule.add_subject', 'target': 'schedule',
                                  'name': 'Văn', 'sessions': 4}
    lesson = data['actions'][1]
    assert lesson == {'type': 'schedule.set_lesson', 'target': 'schedule', 'day': 0, 'slot': 2,
                      'subject': 'Văn', 'replaced': 'Lý'}
    # Ô đang có môn khác → bản xem trước nói rõ thay môn nào.
    assert data['summary'][1]['key'] == 'aiAct.sum.lessonSet'
    assert data['summary'][1]['params']['replaced'] == 'Lý'


def test_ai_actions_schedule_rejects_break_slot_and_bad_day(client):
    data = _plan(client, _reply_with([
        {'type': 'schedule.set_lesson', 'day': 0, 'slot': 1, 'subject': 'Toán'},
        {'type': 'schedule.set_lesson', 'day': 9, 'slot': 0, 'subject': 'Toán'},
        {'type': 'schedule.clear_lesson', 'day': 1, 'slot': 0},
        {'type': 'schedule.set_lesson', 'day': 0, 'slot': 0, 'subject': 'Toán'},
    ]), schedule=_schedule_fixture()).get_json()

    assert [p['code'] for p in data['problems']] == ['notLessonSlot', 'badDay', 'lessonEmpty', 'lessonAlreadySet']
    assert data['actions'] == []


def test_ai_actions_remove_subject_counts_lessons(client):
    data = _plan(client, _reply_with([
        {'type': 'schedule.remove_subject', 'name': 'Toán'},
    ]), schedule=_schedule_fixture()).get_json()
    assert data['actions'][0] == {'type': 'schedule.remove_subject', 'target': 'schedule',
                                  'name': 'Toán', 'removed_lessons': 1}


def test_ai_actions_skips_unknown_type_and_junk_items(client):
    data = _plan(client, _reply_with([
        'không phải object',
        {'type': 'todo.explode', 'name': 'x'},
    ])).get_json()
    assert data['actions'] == []
    assert [p['code'] for p in data['problems']] == ['invalid_shape', 'unknownType']


def test_ai_actions_caps_number_of_changes(client):
    actions = [{'type': 'todo.create_project', 'name': f'Dự án {i}'} for i in range(30)]
    data = _plan(client, _reply_with(actions)).get_json()
    assert len(data['actions']) == app_module.MAX_ACTIONS
    assert data['problems'][-1]['code'] == 'tooManyActions'


def test_ai_actions_accepts_bare_json_reply(client):
    reply = json.dumps({'actions': [{'type': 'todo.create_project', 'name': 'Mới'}]})
    data = _plan(client, reply).get_json()
    assert data['actions'][0]['name'] == 'Mới'


def test_ai_actions_reports_broken_block(client):
    data = _plan(client, 'Chào bạn\n```studyverse-actions\n{không phải json}\n```').get_json()
    assert data['actions'] == []
    assert data['problems'][0]['code'] == 'invalid_json'


def test_ai_actions_ignores_other_code_blocks(client):
    reply = 'Xem ví dụ:\n```json\n{"foo": 1}\n```\n'
    assert _plan(client, reply).get_json()['actions'] == []


def test_ai_actions_accepts_json_actions_fence(client):
    reply = 'Đây:\n```json-actions\n{"actions": [{"type": "todo.create_project", "name": "A"}]}\n```'
    data = _plan(client, reply).get_json()
    assert data['actions'][0]['name'] == 'A'


def test_ai_actions_handles_junk_projects_and_schedule(client):
    data = _plan(client, _reply_with([
        {'type': 'todo.create_project', 'name': 'A'},
        {'type': 'schedule.add_subject', 'name': 'Toán'},
    ]), projects='x', schedule=3).get_json()
    assert [a['type'] for a in data['actions']] == ['todo.create_project', 'schedule.add_subject']


def test_career_prompt_documents_action_block(client, monkeypatch):
    """AI phải được dạy đúng định dạng khối hành động, nếu không tính năng không chạy."""
    captured = {}

    def fake_request_ai(messages, max_tokens, provider=None, on_delta=None):
        captured['system'] = messages[0]['content']
        return 'ok', None

    monkeypatch.setattr(app_module, 'request_ai', fake_request_ai)
    client.post('/api/career-ai', json={'message': 'Thêm việc giúp tôi'})

    system = captured['system']
    assert 'studyverse-actions' in system
    assert 'todo.create_task' in system
    assert 'schedule.set_lesson' in system


# ===================== PHÂN LOẠI LỖI PROVIDER =====================
class AuthenticationError(Exception):
    def __init__(self, status_code=401):
        super().__init__('auth')
        self.status_code = status_code


class PermissionDeniedError(Exception):
    def __init__(self, status_code=403):
        super().__init__('perm')
        self.status_code = status_code


class RateLimitError(Exception):
    def __init__(self, status_code=429):
        super().__init__('rate')
        self.status_code = status_code


class APIConnectionError(Exception):
    pass


class APIStatusError(Exception):
    def __init__(self, status_code):
        super().__init__('status')
        self.status_code = status_code


@pytest.mark.parametrize('exc, expected', [
    (AuthenticationError(401), 'invalid_key'),
    (APIStatusError(402), 'no_balance'),
    (PermissionDeniedError(403), 'permission'),
    (APIStatusError(404), 'model_not_found'),
    (RateLimitError(429), 'rate_limit'),
    (APIStatusError(503), 'provider_down'),
    (APIConnectionError('failed'), 'connection'),
    (ValueError('whatever'), 'unknown'),
])
def test_classify_provider_error(exc, expected):
    code, message = app_module._classify_provider_error(exc)
    assert code == expected
    assert message


# ===================== request_ai (KHÔNG app context) =====================
def test_request_ai_no_providers(monkeypatch):
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: [])
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
    assert reply is None
    assert err[1] == 503


def test_request_ai_all_failed_returns_plain_dict(monkeypatch):
    """Fallback cuối phải trả dict thuần (an toàn cho thread SSE), kèm code lỗi."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['groq'])

    def boom(name):
        raise AuthenticationError(401)

    monkeypatch.setattr(app_module, '_get_provider_client', boom)
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
    assert reply is None
    body, status = err
    assert status == 502
    assert isinstance(body, dict)
    assert body['code'] == 'invalid_key'


def _fake_client(reply_text):
    """Client OpenAI giả: chỉ cần .chat.completions.create() trả về text."""
    class _Msg:
        content = reply_text

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class _Completions:
        def create(self, **kwargs):
            return _Resp()

    class _Chat:
        completions = _Completions()

    class _Client:
        chat = _Chat()

    return _Client()


def test_provider_client_disables_sdk_retries(monkeypatch):
    """Client phải tắt retry mặc định của SDK, nếu không failover bị nhân lên 3x timeout."""
    monkeypatch.setitem(app_module.AI_PROVIDERS['groq'], 'key', 'gsk_test')
    monkeypatch.setattr(app_module, 'AI_MAX_RETRIES', 0)
    client = app_module._get_provider_client('groq')
    assert client.max_retries == 0
    assert client.timeout == app_module.AI_REQUEST_TIMEOUT


def test_request_ai_skips_provider_in_cooldown(monkeypatch):
    """Gateway chính vừa lỗi → request sau đi thẳng Groq, không chờ timeout lần nữa."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['freellmapi', 'groq'])
    monkeypatch.setattr(app_module, 'AI_FAILOVER_COOLDOWN', 60.0)
    called = []

    def fake_client(name):
        called.append(name)
        if name == 'freellmapi':
            raise APIConnectionError('gateway down')
        return _fake_client('Từ Groq')

    monkeypatch.setattr(app_module, '_get_provider_client', fake_client)
    first, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
    assert err is None and first == 'Từ Groq'
    assert called == ['freellmapi', 'groq']

    called.clear()
    second, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
    assert err is None and second == 'Từ Groq'
    assert called == ['groq']  # bỏ qua gateway đang chết


def test_request_ai_cooldown_zero_always_tries_primary(monkeypatch):
    """AI_FAILOVER_COOLDOWN=0 → tắt circuit breaker, luôn thử gateway chính trước."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['freellmapi', 'groq'])
    monkeypatch.setattr(app_module, 'AI_FAILOVER_COOLDOWN', 0.0)
    called = []

    def fake_client(name):
        called.append(name)
        if name == 'freellmapi':
            raise APIConnectionError('gateway down')
        return _fake_client('Từ Groq')

    monkeypatch.setattr(app_module, '_get_provider_client', fake_client)
    for _ in range(2):
        reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
        assert err is None and reply == 'Từ Groq'
    assert called == ['freellmapi', 'groq', 'freellmapi', 'groq']


def test_request_ai_only_provider_still_tried_while_cooling_down(monkeypatch):
    """Provider duy nhất đang cooldown vẫn phải được thử để báo lỗi thật."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['freellmapi'])
    monkeypatch.setattr(app_module, 'AI_FAILOVER_COOLDOWN', 60.0)
    called = []

    def fake_client(name):
        called.append(name)
        raise APIConnectionError('gateway down')

    monkeypatch.setattr(app_module, '_get_provider_client', fake_client)
    for _ in range(2):
        reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
        assert reply is None and err[1] == 502
    assert called == ['freellmapi', 'freellmapi']


def test_request_ai_unknown_provider(monkeypatch):
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['groq'])
    _, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10, provider='nope')
    assert err[1] == 400


def test_request_ai_falls_back_to_groq(monkeypatch):
    """Gateway chính (freellmapi/ai.studyverse.cloud) lỗi → tự chuyển sang Groq."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['freellmapi', 'groq'])
    called = []

    class _Msg:
        content = 'Xin chào từ fallback'

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class _Completions:
        def create(self, **kwargs):
            return _Resp()

    class _Chat:
        completions = _Completions()

    class _Client:
        chat = _Chat()

    def fake_client(name):
        called.append(name)
        if name == 'freellmapi':
            raise APIConnectionError('gateway down')
        return _Client()

    monkeypatch.setattr(app_module, '_get_provider_client', fake_client)
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
    assert err is None
    assert reply == 'Xin chào từ fallback'
    assert called == ['freellmapi', 'groq']


def _stream_client(pieces, exc_after=None, finish_reason=None):
    """Client giả trả về stream các `pieces`, ném `exc_after` sau khi phát hết.

    `finish_reason` (nếu có) được gắn vào event cuối, mô phỏng "length" khi bị cắt.
    """
    class _Delta:
        def __init__(self, content):
            self.content = content

    class _Choice:
        def __init__(self, content, finish_reason=None):
            self.delta = _Delta(content)
            self.finish_reason = finish_reason

    class _Event:
        def __init__(self, content, finish_reason=None):
            self.choices = [_Choice(content, finish_reason)]

    class _Completions:
        def create(self, **kwargs):
            def gen():
                last = len(pieces) - 1
                for index, piece in enumerate(pieces):
                    yield _Event(piece, finish_reason if index == last else None)
                if exc_after is not None:
                    raise exc_after
            return gen()

    class _Chat:
        completions = _Completions()

    class _Client:
        chat = _Chat()

    return _Client()


def test_stream_failover_before_first_chunk(monkeypatch):
    """Gateway chính chết trước khi phát mảnh nào → Groq stream tiếp bình thường."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['freellmapi', 'groq'])
    called = []

    def fake_client(name):
        called.append(name)
        if name == 'freellmapi':
            raise APIConnectionError('gateway down')
        return _stream_client(['Xin ', 'chào'])

    monkeypatch.setattr(app_module, '_get_provider_client', fake_client)
    deltas = []
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10, on_delta=deltas.append)
    assert err is None
    assert reply == 'Xin chào'
    assert deltas == ['Xin ', 'chào']
    assert called == ['freellmapi', 'groq']


def test_stream_partial_then_fail_does_not_failover(monkeypatch):
    """Đã stream một phần rồi lỗi → dừng, KHÔNG thử provider khác (tránh văn bản trùng)."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['freellmapi', 'groq'])
    called = []
    sent = 'Đây là phần đầu của câu trả lời, đủ dài để được gửi cho người dùng ngay.'

    def fake_client(name):
        called.append(name)
        return _stream_client([sent], exc_after=APIConnectionError('đứt giữa stream'))

    monkeypatch.setattr(app_module, '_get_provider_client', fake_client)
    deltas = []
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10, on_delta=deltas.append)
    assert reply is None
    body, status = err
    assert status == 502
    assert body['partial'] is True
    assert deltas == [sent]
    assert called == ['freellmapi']


def test_request_ai_groq_only_used_directly(monkeypatch):
    """Không có gateway chính (chỉ cấu hình Groq) → dùng Groq ngay, không lỗi."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['groq'])
    called = []

    class _Msg:
        content = 'Trả lời từ Groq'

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    class _Completions:
        def create(self, **kwargs):
            return _Resp()

    class _Chat:
        completions = _Completions()

    class _Client:
        chat = _Chat()

    def fake_client(name):
        called.append(name)
        return _Client()

    monkeypatch.setattr(app_module, '_get_provider_client', fake_client)
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
    assert err is None
    assert reply == 'Trả lời từ Groq'
    assert called == ['groq']


# ===================== TRẢ LỜI BỊ CẮT (reasoning model) =====================
def _text_client(scripted):
    """Client giả trả về lần lượt các (content, finish_reason) trong `scripted`,
    đồng thời ghi lại `max_tokens` của từng lời gọi."""
    budgets = []

    class _Msg:
        def __init__(self, content):
            self.content = content

    class _Choice:
        def __init__(self, content, finish_reason):
            self.message = _Msg(content)
            self.finish_reason = finish_reason

    class _Resp:
        def __init__(self, content, finish_reason):
            self.choices = [_Choice(content, finish_reason)]

    class _Completions:
        def create(self, **kwargs):
            budgets.append(kwargs['max_tokens'])
            content, finish_reason = scripted[min(len(budgets) - 1, len(scripted) - 1)]
            return _Resp(content, finish_reason)

    class _Chat:
        completions = _Completions()

    class _Client:
        chat = _Chat()

    return _Client(), budgets


def test_request_ai_retries_truncated_reply_with_bigger_budget(monkeypatch):
    """Reply bị cắt (finish_reason=length) phải được thử lại với budget lớn hơn,
    thay vì trả về một cụt (đôi khi chỉ vài chữ) như thể thành công."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['groq'])
    fake, budgets = _text_client([
        ('Chào', 'length'),                                  # bị cắt ở budget nhỏ
        ('Chào bạn, đây là câu trả lời đầy đủ.', 'stop'),   # lần hai đủ chỗ
    ])
    monkeypatch.setattr(app_module, '_get_provider_client', lambda name: fake)

    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 64)
    assert err is None
    assert reply == 'Chào bạn, đây là câu trả lời đầy đủ.'
    assert budgets == [512, 1024]  # max(64, 512) rồi nhân đôi


def test_request_ai_truncated_at_cap_returns_partial(monkeypatch, caplog):
    """Ra trần budget mà vẫn bị cắt/rất ngắn: thử lại vài lượt rồi trả phần đã có,
    kèm cảnh báo trong log (tốt hơn là báo lỗi cho người dùng)."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['groq'])
    fake, budgets = _text_client([('Chào', 'length')])
    monkeypatch.setattr(app_module, '_get_provider_client', lambda name: fake)

    with caplog.at_level('WARNING'):
        reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}],
                                           app_module.AI_MAX_TOKENS)
    assert err is None
    assert reply == 'Chào'
    # Ở trần budget vẫn thử lại (lượng suy luận thay đổi giữa các lượt) rồi dừng.
    assert budgets == [app_module.AI_MAX_TOKENS] * 3
    assert any('bất thường' in rec.message for rec in caplog.records)


def test_stream_truncated_keeps_partial_and_does_not_retry(monkeypatch):
    """Đã phát đủ mảnh cho client rồi mà bị cắt → giữ phần đã phát, không thử lại
    (thử lại sẽ khiến nội dung bị lặp)."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['groq'])
    calls = []
    sent = 'Đây là phần đầu của câu trả lời, đủ dài để được gửi cho người dùng ngay.'

    def fake_client(name):
        calls.append(name)
        return _stream_client([sent], finish_reason='length')

    monkeypatch.setattr(app_module, '_get_provider_client', fake_client)
    deltas = []
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}],
                                       app_module.AI_MAX_TOKENS, on_delta=deltas.append)
    assert err is None
    assert reply == sent
    assert deltas == [sent]
    assert calls == ['groq']  # chỉ một lời gọi


def test_stream_single_token_reply_is_retried(monkeypatch):
    """Provider chỉ trả đúng 1 token (vd "C") → KHÔNG gửi cho client; thử lại cho tới
    khi có câu trả lời đủ dài. Đây là triệu chứng "chat chỉ trả lời 1 chữ"."""
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['groq'])
    full = 'Cảm ơn bạn rất nhiều! Chúc bạn học tốt và sớm đạt được mục tiêu nhé.'
    calls = []

    class _Delta:
        def __init__(self, content):
            self.content = content

    class _Choice:
        def __init__(self, content, finish):
            self.delta = _Delta(content)
            self.finish_reason = finish

    class _Event:
        def __init__(self, content, finish):
            self.choices = [_Choice(content, finish)]

    class _Completions:
        def create(self, **kwargs):
            calls.append(kwargs['max_tokens'])
            pieces = ['C'] if len(calls) == 1 else [full]
            def gen():
                for piece in pieces:
                    yield _Event(piece, 'stop')
            return gen()

    class _Chat:
        completions = _Completions()

    class _Client:
        chat = _Chat()

    monkeypatch.setattr(app_module, '_get_provider_client', lambda name: _Client())
    deltas = []
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}],
                                       app_module.AI_MAX_TOKENS, on_delta=deltas.append)
    assert err is None
    assert reply == full
    assert deltas == [full]   # không bao giờ thấy mảnh "C" lẻ
    assert len(calls) == 2    # đã thử lại đúng một lần


# ===================== CAREER AI CONTEXT AWARENESS =====================
def test_career_messages_empty_context_declares_capabilities():
    """Khi người dùng chưa có dự án/thời khóa biểu, AI vẫn phải được dạy rõ về khả năng đọc dữ liệu."""
    messages = app_module._build_career_messages(
        user_message="khả năng đọc todo và schedule của AI đâu rồi",
        history=[],
        user_context=[],
        schedule_ctx=None,
    )
    system = messages[0]['content']
    assert 'khả năng đọc todo và schedule' in system.lower() or 'todo / my project' in system.lower()
    assert 'TRỐNG' in system
    assert 'BẮT BUỘC khẳng định rõ bạn hoàn toàn có khả năng này' in system
    assert messages[-1]['content'] == 'khả năng đọc todo và schedule của AI đâu rồi'


def test_career_messages_includes_actual_projects_and_schedule():
    """Khi có dữ liệu dự án và TKB, prompt phải truyền dữ liệu thật rõ ràng cho AI."""
    projects = [{'name': 'Ôn thi THPT', 'deadline': '2026-06-25', 'total_tasks': 3, 'completed_tasks': 1, 'open_tasks': ['Toán hình'], 'tasks': []}]
    schedule = {
        'subjects': [{'name': 'Toán', 'sessions': 3}],
        'slots': [{'index': 0, 'type': 'lesson', 'period': 1, 'start': '07:00', 'end': '07:45'}],
        'timetable': [{'dayIndex': 0, 'day': 'Monday', 'lessons': [{'slot': 0, 'name': 'Toán'}]}],
        'disabled_days': [],
    }
    messages = app_module._build_career_messages(
        user_message="Kế hoạch tuần này thế nào?",
        history=[],
        user_context=projects,
        schedule_ctx=schedule,
    )
    system = messages[0]['content']
    assert 'Ôn thi THPT' in system
    assert 'Toán hình' in system
    assert 'Monday' in system
    assert '1 dự án hiện có' in system


def test_career_messages_includes_user_profile():
    """Hồ sơ cá nhân và streak của người dùng phải được đưa vào system prompt để AI xưng hô đúng."""
    profile = {
        'displayName': 'Thành',
        'aiCalling': 'Cậu - Tớ',
        'aiStyle': 'Nhiệt tình & truyền cảm hứng',
        'streak': 7,
        'dailyGoal': 'Hoàn thành 3 việc mỗi ngày'
    }
    messages = app_module._build_career_messages(
        user_message="Chào bạn, hôm nay tôi nên học gì?",
        history=[],
        user_context=[],
        schedule_ctx=None,
        user_profile=profile
    )
    system = messages[0]['content']
    assert 'Thành' in system
    assert 'Cậu - Tớ' in system
    assert 'Nhiệt tình & truyền cảm hứng' in system
    assert '7 ngày' in system
    assert 'Hoàn thành 3 việc mỗi ngày' in system


def test_career_messages_includes_interests_and_focus():
    """System prompt của AI phải chứa sở thích/ngành học và trọng tâm hỗ trợ của người dùng."""
    profile = {
        'displayName': 'Linh',
        'aiCalling': 'Em - Anh/Chị',
        'aiStyle': 'Tỉ mỉ & hướng dẫn chi tiết',
        'streak': 14,
        'dailyGoal': '45 phút học tập tập trung',
        'interests': 'Công nghệ thông tin & Trí tuệ nhân tạo',
        'aiFocus': 'Phương pháp học & Xử lý deadline'
    }
    messages = app_module._build_career_messages(
        user_message="Tư vấn lộ trình học AI",
        history=[],
        user_context=[],
        schedule_ctx=None,
        user_profile=profile
    )
    system = messages[0]['content']
    assert 'Linh' in system
    assert 'Em - Anh/Chị' in system
    assert 'Tỉ mỉ & hướng dẫn chi tiết' in system
    assert '14 ngày' in system
    assert '45 phút học tập tập trung' in system
    assert 'Công nghệ thông tin & Trí tuệ nhân tạo' in system
    assert 'Phương pháp học & Xử lý deadline' in system


def test_career_ai_accepts_user_profile_payload(client, monkeypatch):
    """Endpoint /api/career-ai và /api/career-ai-stream nhận payload chứa user_profile hợp lệ."""
    called_messages = []

    def mock_request_ai(messages, max_tokens, provider=None, on_delta=None):
        called_messages.extend(messages)
        if on_delta:
            on_delta("Chào bạn, mình là kumalala")
        return "Chào bạn, mình là kumalala", None

    monkeypatch.setattr(app_module, 'request_ai', mock_request_ai)

    payload = {
        'message': 'Xin chào',
        'user_profile': {
            'displayName': 'Nam',
            'streak': 5,
            'interests': 'Kinh tế & Marketing',
            'dailyGoal': '3 việc mỗi ngày'
        }
    }
    res = client.post('/api/career-ai', json=payload)
    assert res.status_code == 200
    assert any('Nam' in m.get('content', '') for m in called_messages)
    assert any('Kinh tế & Marketing' in m.get('content', '') for m in called_messages)


def test_account_page_contains_interactive_features(client):
    """Trang account.html phải có đầy đủ các thành phần đổi tên, streak, huy hiệu và cấu hình."""
    res = client.get('/account.html')
    assert res.status_code == 200
    html = res.data.decode('utf-8')
    assert 'id="profileDisplayName"' in html
    assert 'id="streakCount"' in html
    assert 'id="streakLevelPill"' in html
    assert 'id="badgesGrid"' in html
    assert 'id="weekDaysContainer"' in html
    assert 'id="profileInterests"' in html
    assert 'id="profileDailyGoal"' in html
    assert 'id="accountThemeSwatches"' in html
    assert 'id="saveProfileBtn"' in html
    assert 'id="accountTabs"' in html
    assert 'id="profileNotifyStreak"' in html
    assert 'id="profileNotifyDeadline"' in html
    assert 'id="profileSoundEnabled"' in html


def test_ai_context_includes_user_profile(client):
    """POST /api/ai-context trả về user_profile khi được cung cấp."""
    payload = {
        'projects': [],
        'schedule': None,
        'user_profile': {
            'displayName': 'Khánh',
            'interests': 'Khoa học dữ liệu',
            'streak': 9,
            'dailyGoal': 'Học 60 phút'
        }
    }
    res = client.post('/api/ai-context', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert 'user_profile' in data
    assert data['user_profile']['displayName'] == 'Khánh'
    assert data['user_profile']['streak'] == 9


def test_suggest_includes_user_profile_in_prompt(client, monkeypatch):
    """POST /api/suggest làm giàu system prompt khi có user_profile."""
    captured_messages = []

    def mock_request_ai(messages, max_tokens, provider=None, on_delta=None):
        captured_messages.extend(messages)
        return "Gợi ý lộ trình cho bạn", None

    monkeypatch.setattr(app_module, 'request_ai', mock_request_ai)

    payload = {
        'topic': 'Machine Learning',
        'user_profile': {
            'displayName': 'Minh',
            'interests': 'Trí tuệ nhân tạo'
        }
    }
    res = client.post('/api/suggest', json=payload)
    assert res.status_code == 200
    sys_content = captured_messages[0]['content']
    assert 'Minh' in sys_content
    assert 'Trí tuệ nhân tạo' in sys_content


def test_career_messages_identity_instruction():
    """System prompt yêu cầu AI trả lời chính xác tên, streak, mục tiêu khi được hỏi."""
    messages = app_module._build_career_messages(
        user_message="Bạn có biết tên mình không?",
        history=[],
        user_context=[],
        schedule_ctx=None,
        user_profile={'displayName': 'Hương', 'streak': 12}
    )
    system = messages[0]['content']
    assert 'Hương' in system
    assert '12 ngày' in system
    assert 'BẮT BUỘC nhận diện và trả lời chính xác theo THÔNG TIN HỒ SƠ' in system


def test_shared_js_streak_and_helpers_execution():
    """Chạy kiểm thử logic streak, lịch ngày, svSetLang, svSaveUserProfile bằng Node.js."""
    import subprocess
    js_code = r'''
    const fs = require('fs');
    const code = fs.readFileSync('shared.js', 'utf8');
    const storage = {};
    global.localStorage = {
        getItem: k => storage[k] !== undefined ? storage[k] : null,
        setItem: (k, v) => { storage[k] = String(v); },
        removeItem: k => { delete storage[k]; }
    };
    global.location = { search: '', pathname: '/' };
    global.window = {
        location: global.location,
        SV_CONFIG: { storage: { streak: 'studyverse_streak_data', lang: 'sv-lang', theme: 'sv-theme', userProfile: 'studyverse_user_profile' } }
    };
    global.document = {
        documentElement: { lang: 'vi', dataset: {}, classList: { remove: () => {} } },
        dispatchEvent: () => true,
        addEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    };
    global.CustomEvent = class CustomEvent { constructor(name, opts) { this.name = name; this.opts = opts; } };

    eval(code);

    // Ngày 1: Ghi nhận và lưu vào localStorage
    const d1 = svRecordStreakActivity();
    if (d1.currentStreak !== 1 || d1.bestStreak !== 1) process.exit(1);
    if (!storage['studyverse_streak_data']) process.exit(2);

    // Tính ngày trước đó
    const prev = svGetPreviousDateStr('2026-10-15');
    if (prev !== '2026-10-14') process.exit(3);

    // Ngôn ngữ & theme
    svSetLang('en');
    if (localStorage.getItem('sv-lang') !== 'en') process.exit(4);
    svSaveUserProfile({ displayName: 'Thanh', lang: 'vi' });
    if (localStorage.getItem('sv-lang') !== 'vi') process.exit(5);

    process.exit(0);
    '''
    result = subprocess.run(['node', '-e', js_code], capture_output=True, text=True)
    assert result.returncode == 0, f"Node test failed: {result.stderr}"




