import json
import pytest
from app import app
import mailer


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_mailer_config():
    """Kiểm tra đọc cấu hình Resend và Supabase từ mailer."""
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
