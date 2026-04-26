import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import settings

logger = logging.getLogger(__name__)


def _base_template(content: str, preview_text: str = "") -> str:
    """Wraps content in a professional, branded FlowForge email layout."""
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FlowForge</title>
      <style>
        body {{ margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }}
        .preheader {{ display: none !important; visibility: hidden; mso-hide: all; font-size: 1px; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; }}
      </style>
    </head>
    <body style="margin:0; padding:0; background-color:#f4f5f7;">
      <span class="preheader">{preview_text}</span>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding: 40px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
              <tr>
                <td align="center" style="padding: 24px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 10px 24px;">
                        <span style="color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">&#9670; FlowForge</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;">
              <tr>
                <td style="padding: 40px 48px;">
                  {content}
                </td>
              </tr>
            </table>
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
              <tr>
                <td align="center" style="padding: 24px 48px; color: #8993a4; font-size: 12px; line-height: 18px;">
                  <p style="margin: 0;">This email was sent by <strong>FlowForge</strong>.</p>
                  <p style="margin: 4px 0 0 0;">If you did not expect this email, you can safely ignore it.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """


def _send_email_sync(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        logger.error("SMTP is not fully configured. Skipping send to %s", to_email)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
        server.starttls()
        server.login(settings.smtp_username, settings.smtp_password)
        server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())


async def send_task_notification_email(to_email: str, subject: str, html_body: str, text_body: str) -> None:
    """Send a task notification with the professional FlowForge template."""
    loop = asyncio.get_running_loop()

    # Wrap the raw html_body in the branded template
    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Project Update</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">Activity in your project</p>
    <div style="background-color:#f8f9fb; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; color:#3d4f5f; line-height:24px;">{text_body}</p>
    </div>
    """
    branded_html = _base_template(content, preview_text=subject)

    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, branded_html, text_body
        )
        logger.info("Notification email sent to %s", to_email)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to send notification email to %s: %s", to_email, exc)


async def send_member_added_email(
    to_email: str, project_name: str, inviter_name: str,
    login_url: str, temp_password: str | None = None, is_new_user: bool = False
) -> None:
    """Professional email for when a member is added to a project."""
    subject = f"Welcome to FlowForge - You've been added to {project_name}" if is_new_user else f"You've been added to project {project_name}"
    name = to_email.split("@")[0]

    credentials_block = ""
    if is_new_user and temp_password:
        credentials_block = f"""
        <div style="background-color:#fef3c7; border: 1px solid #f59e0b; border-radius:8px; padding:16px 20px; margin-bottom:24px;">
          <p style="margin:0 0 8px 0; font-size:13px; font-weight:600; color:#92400e;">&#128274; Your Login Credentials</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
            <tr>
              <td style="padding:4px 0; font-size:14px; color:#78350f; width:120px;"><strong>Email:</strong></td>
              <td style="padding:4px 0; font-size:14px; color:#78350f;">{to_email}</td>
            </tr>
            <tr>
              <td style="padding:4px 0; font-size:14px; color:#78350f;"><strong>Password:</strong></td>
              <td style="padding:4px 0; font-size:14px; color:#78350f; font-family:monospace;">{temp_password}</td>
            </tr>
          </table>
          <p style="margin:8px 0 0 0; font-size:12px; color:#92400e;">Please change your password after your first login.</p>
        </div>
        """

    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Hi {name}!</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">{inviter_name} added you to a project</p>
    <div style="background-color:#f8f9fb; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0 0 4px 0; font-size:13px; color:#8993a4; text-transform:uppercase; letter-spacing:0.5px;">Project</p>
      <p style="margin:0; font-size:18px; font-weight:600; color:#1a1a2e;">{project_name}</p>
    </div>
    {credentials_block}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
          <a href="{login_url}" style="display:inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.3px;">Open FlowForge</a>
        </td>
      </tr>
    </table>
    """
    html_body = _base_template(content, preview_text=f"You've been added to {project_name}")
    text_body = f"Hi {name}, {inviter_name} added you to the project '{project_name}' on FlowForge. Login at {login_url}"
    if is_new_user and temp_password:
        text_body += f"\nEmail: {to_email}\nTemporary Password: {temp_password}\nPlease change your password."

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, text_body
        )
        logger.info("Member added email sent to %s", to_email)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to send member added email to %s: %s", to_email, exc)
