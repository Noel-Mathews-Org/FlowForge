import asyncio
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

class EmailSettings:
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "noreply@flowforge.local")
    smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "FlowForge")

settings = EmailSettings()


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

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as server:
            server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, [to_email], msg.as_string())
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)

async def send_notification_email(to_email: str, subject: str, message: str) -> None:
    loop = asyncio.get_running_loop()
    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Task Update</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">You have a new notification</p>
    <div style="background-color:#f8f9fb; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; color:#3d4f5f; line-height:24px;">{message}</p>
    </div>
    """
    html_body = _base_template(content, preview_text=subject)
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, message
        )
        logger.info("Notification email sent to %s", to_email)
    except Exception as exc:
        logger.exception("Failed to send notification email to %s: %s", to_email, exc)
