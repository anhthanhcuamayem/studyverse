"""Test backend Flask (app.py): static, validation, AI endpoints (đã mock), provider errors.

Chạy: .venv/bin/pytest
Không test nào gọi mạng tới nhà cung cấp AI — request_ai luôn được mock.
"""
import pytest

import app as app_module
from app import PUBLIC_FILES, app as flask_app


@pytest.fixture
def client():
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as test_client:
        yield test_client


# ===================== FILE TĨNH =====================
def test_public_files_are_served(client):
    for path in sorted(PUBLIC_FILES):
        response = client.get('/' + path)
        assert response.status_code == 200, path


def test_index_root_serves_home(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'<html' in response.data.lower()


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
    assert 'deepseek' in data['supported']
    assert isinstance(data['available'], list)


def test_ai_providers_probe_shape(client, monkeypatch):
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['deepseek'])
    monkeypatch.setattr(app_module, 'probe_provider', lambda name, timeout=8.0: {
        'configured': True, 'healthy': False, 'code': 'invalid_key', 'message': 'x',
    })
    data = client.get('/api/ai-providers?probe=1').get_json()
    assert data['health']['deepseek']['code'] == 'invalid_key'


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
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['deepseek'])

    def boom(name):
        raise AuthenticationError(401)

    monkeypatch.setattr(app_module, '_get_provider_client', boom)
    reply, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10)
    assert reply is None
    body, status = err
    assert status == 502
    assert isinstance(body, dict)
    assert body['code'] == 'invalid_key'


def test_request_ai_unknown_provider(monkeypatch):
    monkeypatch.setattr(app_module, 'detect_available_providers', lambda: ['deepseek'])
    _, err = app_module.request_ai([{'role': 'user', 'content': 'hi'}], 10, provider='nope')
    assert err[1] == 400
