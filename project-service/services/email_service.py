import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import settings

logger = logging.getLogger(__name__)

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
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, text_body
        )
        logger.info("Notification email sent to %s", to_email)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to send notification email to %s: %s", to_email, exc)
