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
    html_body = f"<html><body><p>{message}</p></body></html>"
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, message
        )
        logger.info("Notification email sent to %s", to_email)
    except Exception as exc:
        logger.exception("Failed to send notification email to %s: %s", to_email, exc)
