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


async def send_notification_email(to_email: str, subject: str, html_body: str) -> None:
    loop = asyncio.get_running_loop()
    text_body = "Please view this message in an HTML-capable email client."
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, text_body
        )
        logger.info("Notification email sent to %s", to_email)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to send notification email to %s: %s", to_email, exc)


async def send_invite_email(to_email: str, invite_url: str, inviter_name: str) -> None:
    subject = "You've been invited to FlowForge"
    html_body = f"""
    <html>
      <body>
        <h2>You're invited to FlowForge</h2>
        <p>{inviter_name} invited you to join FlowForge.</p>
        <p><a href="{invite_url}" style="font-size:16px;font-weight:bold;">Accept Invite</a></p>
        <p>If the button does not work, use this link:</p>
        <p>{invite_url}</p>
      </body>
    </html>
    """
    text_body = f"{inviter_name} invited you to FlowForge.\nRegister here: {invite_url}"

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, text_body
        )
        logger.info("Invite email sent to %s", to_email)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to send invite email to %s: %s", to_email, exc)


async def send_approval_result_email(
    to_email: str, full_name: str, project_name: str, approved: bool
) -> None:
    status = "approved" if approved else "rejected"
    subject = f"Your FlowForge access request was {status}"
    next_step = (
        "You can now sign in and start collaborating."
        if approved
        else "Please contact your administrator for details."
    )

    html_body = f"""
    <html>
      <body>
        <h2>Hello {full_name},</h2>
        <p>Your access request for <strong>{project_name}</strong> was <strong>{status}</strong>.</p>
        <p>{next_step}</p>
      </body>
    </html>
    """
    text_body = (
        f"Hello {full_name}, your access request for {project_name} was {status}. {next_step}"
    )

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, text_body
        )
        logger.info("Approval result email sent to %s", to_email)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to send approval result email to %s: %s", to_email, exc)
