import json
import pytest
from app import app
import mailer


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_mailer_config(monkeypatch):
    """Kiểm tra đọc cấu hình Resend và Supabase từ mailer."""
    if not mailer.get_resend_api_key():
        monkeypatch.setenv('RESEND_API_KEY', 're_mock_test_key_12345')
    assert mailer.get_resend_api_key().startswith('re_')
    assert 'studyverse.cloud' in mailer.get_mail_sender()
    assert mailer.get_app_base_url() != ''


def test_build_html_wrapper():
    """Kiểm tra tạo khung HTML email thương hiệu Studyverse."""
    html = mailer._build_html_wrapper(
        title="Tiêu đề thử nghiệm",
        preheader="Xem trước email",
        body_content="<p>Nội dung thử nghiệm</p>"
    )
    assert "<!DOCTYPE html>" in html
    assert "Studyverse" in html
    assert "Nội dung thử nghiệm" in html
    assert "Xem trước email" in html


def test_forgot_password_validation(client):
    """Kiểm tra validation thiếu email khi gọi API quên mật khẩu."""
    resp = client.post('/api/auth/forgot-password', json={})
    assert resp.status_code == 400
    data = json.loads(resp.data)
    assert data['ok'] is False
    assert 'email' in data['error'].lower()


def test_send_verification_validation(client):
    """Kiểm tra validation thiếu email khi gọi API gửi mail xác thực."""
    resp = client.post('/api/auth/send-verification', json={})
    assert resp.status_code == 400
    data = json.loads(resp.data)
    assert data['ok'] is False


def test_notify_reminder_validation(client):
    """Kiểm tra validation thiếu email khi gọi API nhắc việc."""
    resp = client.post('/api/notify/reminder', json={})
    assert resp.status_code == 400
    data = json.loads(resp.data)
    assert data['ok'] is False


def test_send_email_validation(client):
    """Kiểm tra validation thiếu trường người nhận của /api/send-email."""
    resp = client.post('/api/send-email', json={})
    assert resp.status_code == 400
    data = json.loads(resp.data)
    assert data['ok'] is False


def test_send_reminder_email_5min_urgent(monkeypatch):
    """Kiểm tra nội dung email cảnh báo gấp 5 phút trước deadline khi chưa làm."""
    captured = {}

    def fake_send(to, subject, html, text=None, sender=None):
        captured['to'] = to
        captured['subject'] = subject
        captured['html'] = html
        return True, {'id': 'msg_test_123'}

    monkeypatch.setattr(mailer, 'send_email', fake_send)

    ok, res = mailer.send_reminder_email(
        to='student@studyverse.cloud',
        reminder_type='todo',
        data={
            'taskTitle': 'Ôn tập Giải tích 1',
            'projectName': 'Kỳ thi giữa kỳ',
            'deadline': '18:00',
            'minutesLeft': 5
        }
    )
    assert ok is True
    assert '5 phút' in captured['subject']
    assert 'Chưa hoàn thành' in captured['subject']
    assert 'Cảnh báo khẩn cấp' in captured['html']
    assert '5 phút' in captured['html']
    assert 'Chưa hoàn thành' in captured['html']
    assert 'Ôn tập Giải tích 1' in captured['html']


def test_api_notify_check_deadlines_5min(client, monkeypatch):
    """Kiểm tra endpoint /api/notify/check-deadlines tự lọc task chưa làm tới trước 5 phút."""
    from datetime import datetime, timedelta

    captured = []

    def fake_send(to, reminder_type, data=None):
        captured.append(data)
        return True, {'id': 'msg_mock'}

    monkeypatch.setattr(mailer, 'send_reminder_email', fake_send)

    now = datetime.now()
    due_in_4min = (now + timedelta(minutes=4)).strftime('%Y-%m-%d %H:%M')
    due_in_60min = (now + timedelta(minutes=60)).strftime('%Y-%m-%d %H:%M')

    payload = {
        'to': 'student@studyverse.cloud',
        'projects': [
            {
                'name': 'Dự án A',
                'tasks': [
                    {'id': 't1', 'name': 'Task gấp 4 phút', 'deadline': due_in_4min, 'status': 'todo'},
                    {'id': 't2', 'name': 'Task đã làm xong', 'deadline': due_in_4min, 'status': 'done'},
                    {'id': 't3', 'name': 'Task còn lâu', 'deadline': due_in_60min, 'status': 'todo'}
                ]
            }
        ]
    }

    res = client.post('/api/notify/check-deadlines', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data['ok'] is True
    assert data['remindedCount'] == 1
    assert data['reminded'] == ['Task gấp 4 phút']
    assert len(captured) == 1
    assert captured[0]['taskTitle'] == 'Task gấp 4 phút'
    assert 1 <= captured[0]['minutesLeft'] <= 5
