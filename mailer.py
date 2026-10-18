"""
mailer.py — Module gửi email tập trung cho Studyverse qua Resend (resend.com)
Hỗ trợ 3 nhóm tính năng:
1. Xác thực tài khoản khi Đăng ký (Sign-up Verification & Welcome)
2. Quên mật khẩu & Đặt lại mật khẩu (Password Reset via Supabase Admin Action Link)
3. Thông báo nhắc việc (Todo Deadline, Chuỗi Streak, Lịch học)
"""

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger('studyverse.mailer')

try:
    import resend
except ImportError:
    resend = None


def get_resend_api_key() -> str:
    return (os.environ.get('RESEND_API_KEY') or '').strip()


def get_mail_sender() -> str:
    return (os.environ.get('MAIL_SENDER') or 'Studyverse <noreply@studyverse.cloud>').strip()


def get_supabase_credentials() -> Tuple[str, str]:
    url = (os.environ.get('SUPABASE_URL') or '').strip().rstrip('/')
    key = (os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_SECRET_KEY') or '').strip()
    return url, key


def get_app_base_url() -> str:
    return (os.environ.get('APP_BASE_URL') or 'http://localhost:5000').strip().rstrip('/')


def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    sender: Optional[str] = None
) -> Tuple[bool, Dict[str, Any]]:
    api_key = get_resend_api_key()
    if not api_key:
        msg = "Chưa cấu hình RESEND_API_KEY trong file .env."
        logger.error(msg)
        return False, {'error': msg}

    from_address = sender or get_mail_sender()
    to_list = [to.strip()] if isinstance(to, str) else list(to)

    if resend is not None:
        try:
            resend.api_key = api_key
            payload = {
                'from': from_address,
                'to': to_list,
                'subject': subject,
                'html': html,
            }
            if text:
                payload['text'] = text
            resp = resend.Emails.send(payload)
            return True, resp
        except Exception as e:
            logger.warning(f"Resend SDK lỗi ({e}), chuyển sang gửi REST API.")

    url = "https://api.resend.com/emails"
    req_body = {
        'from': from_address,
        'to': to_list,
        'subject': subject,
        'html': html,
    }
    if text:
        req_body['text'] = text

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'User-Agent': 'Studyverse-Mailer/2.0',
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(req_body).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=20) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return True, res_data
    except urllib.error.HTTPError as http_err:
        err_content = http_err.read().decode('utf-8')
        try:
            err_json = json.loads(err_content)
            err_msg = err_json.get('message') or err_json.get('error') or err_content
        except Exception:
            err_msg = err_content
        logger.error(f"Resend HTTPError {http_err.code}: {err_msg}")
        return False, {'error': err_msg, 'status_code': http_err.code}
    except Exception as exc:
        logger.error(f"Lỗi gửi email Resend: {exc}")
        return False, {'error': str(exc)}


def generate_supabase_link(
    email: str,
    link_type: str = 'recovery',
    redirect_to: Optional[str] = None,
    password: Optional[str] = None
) -> Tuple[bool, Dict[str, Any]]:
    sb_url, sb_key = get_supabase_credentials()
    if not sb_url or not sb_key:
        return False, {'error': 'Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong .env'}

    endpoint = f"{sb_url}/auth/v1/admin/generate_link"
    body: Dict[str, Any] = {
        'type': link_type,
        'email': email.strip(),
    }
    if redirect_to:
        body['redirect_to'] = redirect_to
    if password and link_type == 'signup':
        body['password'] = password

    headers = {
        'apikey': sb_key,
        'Authorization': f'Bearer {sb_key}',
        'Content-Type': 'application/json',
    }

    try:
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(body).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return True, data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            err_json = json.loads(err_body)
            msg = err_json.get('msg') or err_json.get('message') or err_body
        except Exception:
            msg = err_body
        return False, {'error': msg, 'status_code': e.code}
    except Exception as e:
        return False, {'error': str(e)}


def _build_html_wrapper(title: str, preheader: str, body_content: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title}</title>
  <style>
    body {{ margin: 0; padding: 0; width: 100% !important; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f1f5f9; }}
    .container {{ max-width: 600px; margin: 0 auto; padding: 32px 20px; }}
    .card {{ background: linear-gradient(180deg, #131b2e 0%, #0f172a 100%); border: 1px solid #1e293b; border-radius: 16px; padding: 36px 28px; }}
    .logo {{ font-size: 26px; font-weight: 800; color: #ffffff; text-decoration: none; }}
    .logo-blue {{ color: #38bdf8; }}
    .btn {{ display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; border-radius: 10px; margin: 24px 0 16px 0; }}
    .otp-box {{ background: #1e293b; border: 1px dashed #38bdf8; border-radius: 10px; padding: 16px; text-align: center; font-size: 28px; font-weight: 800; letter-spacing: 8px; color: #38bdf8; margin: 20px 0; font-family: monospace; }}
    .footer {{ text-align: center; font-size: 12px; color: #64748b; margin-top: 28px; line-height: 1.6; }}
    p {{ line-height: 1.65; font-size: 15px; color: #cbd5e1; }}
  </style>
</head>
<body style="background-color: #0b0f19; margin: 0; padding: 0;">
  <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">{preheader}</div>
  <div class="container">
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="https://studyverse.cloud" class="logo">Study<span class="logo-blue">verse</span></a>
    </div>
    <div class="card">
      {body_content}
    </div>
    <div class="footer">
      <p>© 2026 Studyverse. Tất cả quyền được bảo lưu.<br>
      Email tự động từ hệ thống Studyverse (studyverse.cloud)</p>
    </div>
  </div>
</body>
</html>"""


def send_password_reset_email(email: str, redirect_to: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
    base_url = get_app_base_url()
    target_redirect = redirect_to or f"{base_url}/account.html?mode=recovery"

    ok, link_data = generate_supabase_link(
        email=email,
        link_type='recovery',
        redirect_to=target_redirect
    )

    if not ok:
        err = link_data.get('error', 'Không thể tạo liên kết đặt lại mật khẩu.')
        return False, {'error': f"Lỗi Supabase Admin: {err}"}

    action_link = link_data.get('action_link')
    email_otp = link_data.get('email_otp')

    if not action_link:
        return False, {'error': 'Supabase không trả về action_link hợp lệ.'}

    otp_snippet = ""
    if email_otp:
        otp_snippet = f"""
        <p style="margin-top: 20px; font-size: 14px; color: #94a3b8;">Hoặc nếu được yêu cầu mã OTP, hãy nhập:</p>
        <div class="otp-box">{email_otp}</div>
        """

    content = f"""
      <h2 style="font-size: 22px; color: #ffffff;">Yêu cầu đặt lại mật khẩu 🔐</h2>
      <p>Xin chào,</p>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Studyverse (<strong style="color: #38bdf8;">{email}</strong>).</p>
      <p>Vui lòng bấm vào nút bên dưới để tiến hành tạo mật khẩu mới. Liên kết này có thời hạn trong <strong>60 phút</strong>:</p>
      <div style="text-align: center;">
        <a href="{action_link}" class="btn">Đặt lại Mật khẩu ngay</a>
      </div>
      {otp_snippet}
      <p style="font-size: 13px; color: #94a3b8; margin-top: 20px;">
        Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email. Mật khẩu của bạn vẫn an toàn tuyệt đối.
      </p>
    """

    html = _build_html_wrapper(
        title="[Studyverse] Đặt lại mật khẩu tài khoản",
        preheader="Bấm vào đây để đặt lại mật khẩu tài khoản Studyverse của bạn.",
        body_content=content
    )

    return send_email(
        to=email,
        subject="[Studyverse] Yêu cầu đặt lại mật khẩu tài khoản",
        html=html,
        text=f"Yêu cầu đặt lại mật khẩu Studyverse: {action_link}"
    )


def send_signup_verification_email(
    email: str,
    redirect_to: Optional[str] = None,
    display_name: Optional[str] = None
) -> Tuple[bool, Dict[str, Any]]:
    base_url = get_app_base_url()
    target_redirect = redirect_to or f"{base_url}/account.html?confirmed=1"
    name = display_name or email.split('@')[0]

    ok, link_data = generate_supabase_link(
        email=email,
        link_type='signup',
        redirect_to=target_redirect
    )

    action_link = link_data.get('action_link') if ok else None
    email_otp = link_data.get('email_otp') if ok else None

    btn_html = ""
    if action_link:
        btn_html = f"""
        <div style="text-align: center;">
          <a href="{action_link}" class="btn">Xác nhận & Kích hoạt Tài khoản</a>
        </div>
        """

    otp_html = ""
    if email_otp:
        otp_html = f"""
        <p style="font-size: 14px; color: #94a3b8; text-align: center;">Mã xác thực tài khoản của bạn:</p>
        <div class="otp-box">{email_otp}</div>
        """

    content = f"""
      <h2 style="font-size: 22px; color: #ffffff;">Chào mừng bạn đến với Studyverse! 🎉</h2>
      <p>Xin chào <strong style="color: #38bdf8;">{name}</strong>,</p>
      <p>Cảm ơn bạn đã tham gia Studyverse. Nhấn vào nút bên dưới để hoàn tất kích hoạt tài khoản:</p>
      {btn_html}
      {otp_html}
    """

    html = _build_html_wrapper(
        title="[Studyverse] Chào mừng & Kích hoạt tài khoản",
        preheader="Xác nhận tài khoản Studyverse của bạn để bắt đầu.",
        body_content=content
    )

    return send_email(
        to=email,
        subject="[Studyverse] Chào mừng bạn! Kích hoạt tài khoản của bạn",
        html=html,
        text=f"Chào mừng {name}! Bấm vào liên kết sau để kích hoạt: {action_link or target_redirect}"
    )


def send_reminder_email(
    to: str,
    reminder_type: str,
    data: Optional[Dict[str, Any]] = None
) -> Tuple[bool, Dict[str, Any]]:
    data = data or {}
    base_url = get_app_base_url()

    if reminder_type == 'todo':
        task_title = data.get('taskTitle') or data.get('title') or 'Nhiệm vụ học tập'
        deadline = data.get('deadline') or 'Hôm nay'
        project_name = data.get('projectName') or 'Mục tiêu'

        content = f"""
          <h2 style="font-size: 22px; color: #ffffff;">⏰ Nhắc nhở Deadline: {task_title}</h2>
          <p>Bạn có một công việc sắp đến hạn cần hoàn thành:</p>
          <div style="background: #1e293b; border-radius: 12px; padding: 18px; margin: 18px 0;">
            <p style="margin: 0; font-size: 17px; font-weight: 700; color: #f8fafc;">📝 {task_title}</p>
            <p style="margin: 6px 0; font-size: 14px; color: #cbd5e1;">📁 Dự án: <strong style="color: #38bdf8;">{project_name}</strong></p>
            <p style="margin: 6px 0; font-size: 14px; color: #fca5a5;">⏳ Hạn chót: <strong>{deadline}</strong></p>
          </div>
          <div style="text-align: center;">
            <a href="{base_url}/todo/mylist.html" class="btn">Mở Danh sách Todo</a>
          </div>
        """
        subject = f"[Studyverse] ⏰ Sắp đến hạn: {task_title}"
        preheader = f"Hạn chót cho '{task_title}' là {deadline}."

    elif reminder_type == 'streak':
        streak_count = data.get('streak') or data.get('count') or 1
        content = f"""
          <h2 style="font-size: 22px; color: #f97316;">🔥 Giữ vững chuỗi Streak {streak_count} ngày!</h2>
          <p>Bạn đang có chuỗi học tập liên tục <strong style="color: #f97316;">{streak_count} ngày</strong> rất tuyệt vời!</p>
          <p>Hãy dành 5 phút vào ôn Flashcard hoặc hoàn thành 1 việc Todo hôm nay để không bị gián đoạn chuỗi ngày học tập nhé.</p>
          <div style="text-align: center;">
            <a href="{base_url}/flashcard/flashcard.html" class="btn" style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%);">
              Ôn bài 5 phút để giữ Streak ngay
            </a>
          </div>
        """
        subject = f"[Studyverse] 🔥 Giữ chuỗi Streak {streak_count} ngày hôm nay!"
        preheader = f"Đừng để mất chuỗi {streak_count} ngày học tập liên tục!"

    else:
        title = data.get('title') or 'Thông báo học tập'
        body = data.get('message') or data.get('content') or 'Bạn có thông báo mới từ Studyverse.'
        link = data.get('link') or f"{base_url}/index.html"
        btn_text = data.get('buttonText') or 'Mở Studyverse'

        content = f"""
          <h2 style="font-size: 22px; color: #ffffff;">📢 {title}</h2>
          <p>{body}</p>
          <div style="text-align: center;">
            <a href="{link}" class="btn">{btn_text}</a>
          </div>
        """
        subject = f"[Studyverse] {title}"
        preheader = title

    html = _build_html_wrapper(title=subject, preheader=preheader, body_content=content)
    return send_email(to=to, subject=subject, html=html)
