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
            <!-- Header -->
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
            <!-- Body -->
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;">
              <tr>
                <td style="padding: 40px 48px;">
                  {content}
                </td>
              </tr>
            </table>
            <!-- Footer -->
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


async def send_member_added_email(
    to_email: str, project_name: str, inviter_name: str,
    login_url: str, temp_password: str | None = None, is_new_user: bool = False
) -> None:
    """Notify a user they've been added to a project."""
    await send_project_invite_email(to_email, inviter_name, login_url, temp_password, is_new_user)


async def send_invite_email(to_email: str, invite_url: str, inviter_name: str, role: str = "member") -> None:
    role_display = role.replace("_", " ").title()
    subject = "You've been invited to FlowForge"
    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">You're Invited!</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">Join your team on FlowForge</p>
    <div style="background-color:#f8f9fb; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; color:#3d4f5f; line-height:24px;">
        <strong style="color:#1a1a2e;">{inviter_name}</strong> has invited you to join <strong style="color:#1a1a2e;">FlowForge</strong> — a powerful project management platform built for modern teams.
      </p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
          <a href="{invite_url}" style="display:inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.3px;">Accept Invitation</a>
        </td>
      </tr>
    </table>
    <p style="margin:0; font-size:13px; color:#8993a4; line-height:20px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="margin:4px 0 0 0; font-size:13px; color:#667eea; word-break:break-all;">{invite_url}</p>
    """
    html_body = _base_template(content, preview_text=f"{inviter_name} invited you to join FlowForge")
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
    status_text = "Approved" if approved else "Rejected"
    status_color = "#10b981" if approved else "#ef4444"
    status_icon = "&#10003;" if approved else "&#10007;"
    subject = f"Your FlowForge access request was {status_text.lower()}"
    next_step = (
        "You can now sign in and start collaborating with your team."
        if approved
        else "Please contact your project administrator for more details."
    )

    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Hello {full_name},</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">Your access request has been reviewed</p>
    <div style="background-color:#f8f9fb; border-radius:8px; padding:24px; margin-bottom:24px; text-align:center;">
      <div style="display:inline-block; width:48px; height:48px; line-height:48px; border-radius:50%; background-color:{status_color}; color:#ffffff; font-size:24px; font-weight:700; margin-bottom:12px;">{status_icon}</div>
      <p style="margin:8px 0 4px 0; font-size:18px; font-weight:600; color:{status_color};">Request {status_text}</p>
      <p style="margin:0; font-size:14px; color:#3d4f5f;">Project: <strong>{project_name}</strong></p>
    </div>
    <p style="margin:0; font-size:15px; color:#3d4f5f; line-height:24px;">{next_step}</p>
    """
    html_body = _base_template(content, preview_text=f"Access request for {project_name} was {status_text.lower()}")
    text_body = (
        f"Hello {full_name}, your access request for {project_name} was {status_text.lower()}. {next_step}"
    )

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, text_body
        )
        logger.info("Approval result email sent to %s", to_email)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to send approval result email to %s: %s", to_email, exc)


async def send_project_invite_email(
    to_email: str, inviter_name: str, login_url: str,
    temp_password: str | None = None, is_new_user: bool = False
) -> None:
    """Professional email for when a user is added to a project via invite-to-project."""
    subject = "Welcome to FlowForge" if is_new_user else "You've been added to a FlowForge project"

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
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Welcome to FlowForge!</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">{inviter_name} has invited you to collaborate</p>
    <div style="background-color:#f8f9fb; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; color:#3d4f5f; line-height:24px;">
        {"An account has been automatically created for you." if is_new_user else "You have been added to a new project."}
        Sign in to start collaborating with your team.
      </p>
    </div>
    {credentials_block}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
          <a href="{login_url}" style="display:inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.3px;">Sign In to FlowForge</a>
        </td>
      </tr>
    </table>
    """
    html_body = _base_template(content, preview_text=f"{inviter_name} invited you to collaborate on FlowForge")
    text_body = f"{inviter_name} has invited you to collaborate on FlowForge.\nLogin at: {login_url}"
    if is_new_user and temp_password:
        text_body += f"\nEmail: {to_email}\nTemporary Password: {temp_password}\nPlease change your password after logging in."

    await send_notification_email(to_email, subject, html_body)

async def send_admin_user_created_email(
    to_email: str, login_url: str, temp_password: str
) -> None:
    """Professional email for when an administrator creates a user."""
    subject = "Your FlowForge Account"

    credentials_block = f"""
    <div style="background-color:#fef3c7; border: 1px solid #f59e0b; border-radius:8px; padding:16px 20px; margin-bottom:24px;">
      <p style="margin:0 0 8px 0; font-size:13px; font-weight:600; color:#92400e;">&#128274; Your Login Credentials</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="padding:4px 0; font-size:14px; color:#78350f; width:120px;"><strong>Username:</strong></td>
          <td style="padding:4px 0; font-size:14px; color:#78350f;">{to_email}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; font-size:14px; color:#78350f;"><strong>Password:</strong></td>
          <td style="padding:4px 0; font-size:14px; color:#78350f; font-family:monospace;">{temp_password}</td>
        </tr>
      </table>
      <p style="margin:8px 0 0 0; font-size:12px; color:#92400e;">Please log in and change your password immediately.</p>
    </div>
    """

    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Welcome to FlowForge!</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">An administrator has created an account for you</p>
    {credentials_block}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
          <a href="{login_url}" style="display:inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600; letter-spacing:0.3px;">Log in to FlowForge</a>
        </td>
      </tr>
    </table>
    """
    html_body = _base_template(content, preview_text="An administrator has created an account for you")
    text_body = f"Welcome to FlowForge.\nYour username is {to_email}\nTemporary password: {temp_password}\nLog in at {login_url}"

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None, _send_email_sync, to_email, subject, html_body, text_body
        )
        logger.info("Admin user created email sent to %s", to_email)
    except Exception as exc:
        logger.exception("Failed to send admin user created email to %s: %s", to_email, exc)


async def send_user_revoked_email(to_email: str, full_name: str) -> None:
    """Email sent when a user's account is revoked."""
    subject = "FlowForge Account Access Revoked"
    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Hello {full_name},</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">Your account access has been updated</p>
    <div style="background-color:#fef2f2; border: 1px solid #fecaca; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; color:#991b1b; line-height:24px;">
        Your FlowForge account access has been revoked by an administrator. You will no longer be able to sign in.
      </p>
    </div>
    <p style="margin:0; font-size:14px; color:#3d4f5f;">If you believe this is an error, please contact your organization administrator.</p>
    """
    html_body = _base_template(content, preview_text="Your FlowForge account access has been revoked")
    text_body = f"Hello {full_name}, your FlowForge account access has been revoked. Contact your organization administrator if this is unexpected."
    await send_notification_email(to_email, subject, html_body)


async def send_user_activated_email(to_email: str, full_name: str, login_url: str) -> None:
    """Email sent when a user's account is re-activated."""
    subject = "FlowForge Account Reactivated"
    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Welcome Back, {full_name}!</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">Your account has been reactivated</p>
    <div style="background-color:#f0fdf4; border: 1px solid #86efac; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; color:#166534; line-height:24px;">
        Your FlowForge account has been reactivated. You can now sign in and access your projects and tasks.
      </p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding: 8px 0 24px 0;">
        <a href="{login_url}" style="display:inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:8px; font-size:15px; font-weight:600;">Sign In Now</a>
      </td></tr>
    </table>
    """
    html_body = _base_template(content, preview_text="Your FlowForge account has been reactivated")
    text_body = f"Hello {full_name}, your FlowForge account has been reactivated. Sign in at {login_url}"
    await send_notification_email(to_email, subject, html_body)


async def send_member_transferred_email(
    to_email: str, full_name: str, new_manager_name: str
) -> None:
    """Email sent when a member is transferred to a new manager."""
    subject = "FlowForge: Manager Reassignment"
    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Hello {full_name},</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">Your reporting manager has been updated</p>
    <div style="background-color:#eff6ff; border: 1px solid #93c5fd; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; color:#1e40af; line-height:24px;">
        You have been reassigned to a new manager: <strong>{new_manager_name}</strong>
      </p>
    </div>
    <p style="margin:0; font-size:14px; color:#3d4f5f;">Your existing projects and tasks remain unchanged.</p>
    """
    html_body = _base_template(content, preview_text=f"You now report to {new_manager_name}")
    text_body = f"Hello {full_name}, you have been reassigned to {new_manager_name}."
    await send_notification_email(to_email, subject, html_body)


async def send_report_generated_email(to_email: str, report_name: str) -> None:
    """Email sent to org owner / admin when a report is generated."""
    subject = f"FlowForge Report Ready: {report_name}"
    content = f"""
    <h1 style="margin:0 0 8px 0; font-size:24px; font-weight:700; color:#1a1a2e;">Report Generated</h1>
    <p style="margin:0 0 24px 0; font-size:15px; color:#8993a4;">Your executive report is ready for download</p>
    <div style="background-color:#f8f9fb; border-radius:8px; padding:20px 24px; margin-bottom:24px;">
      <p style="margin:0; font-size:15px; color:#3d4f5f; line-height:24px;">
        <strong>{report_name}</strong> has been generated successfully and is ready for viewing.
      </p>
    </div>
    <p style="margin:0; font-size:13px; color:#8993a4;">View your reports in the FlowForge dashboard under Reports section.</p>
    """
    html_body = _base_template(content, preview_text=f"Report ready: {report_name}")
    text_body = f"Your FlowForge report '{report_name}' has been generated and is ready for viewing."
    await send_notification_email(to_email, subject, html_body)
