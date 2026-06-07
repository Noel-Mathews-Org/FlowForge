"""
Entra ID (Azure AD) integration service for FlowForge.

Responsibilities:
- Validate Entra ID tokens from the MSAL frontend
- Map Entra security group memberships to FlowForge roles
- Graph API operations: invite users, manage group membership

All configuration comes from environment variables via config.settings.
"""
import logging
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

# Microsoft Graph API base URL
GRAPH_API = "https://graph.microsoft.com/v1.0"


# ─── Token Validation ────────────────────────────────────────────────────────

async def validate_entra_token(access_token: str) -> dict | None:
    """
    Validate an Entra ID access token by calling Microsoft Graph /me endpoint.
    Returns user profile dict or None if invalid.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{GRAPH_API}/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code != 200:
                logger.warning("Entra token validation failed: %s", resp.text[:200])
                return None
            return resp.json()
    except Exception as exc:
        logger.error("Error validating Entra token: %s", exc)
        return None


async def get_user_groups(access_token: str) -> list[str]:
    """Get the group IDs the user belongs to via Microsoft Graph."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{GRAPH_API}/me/getMemberObjects",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json={"securityEnabledOnly": True},
            )
            if resp.status_code == 200:
                return resp.json().get("value", [])
    except Exception as exc:
        logger.error("Error fetching user groups: %s", exc)
    return []


def get_role_from_groups(group_ids: list[str]) -> str | None:
    """
    Map Entra ID security group IDs to a FlowForge role.
    Priority: platform_admin > org_owner > manager > member
    Returns None if user is not in any known group.
    """
    group_set = set(group_ids)

    if settings.entra_group_platform_admin and settings.entra_group_platform_admin in group_set:
        return "platform_admin"
    if settings.entra_group_org_owner and settings.entra_group_org_owner in group_set:
        return "org_owner"
    if settings.entra_group_manager and settings.entra_group_manager in group_set:
        return "manager"
    if settings.entra_group_member and settings.entra_group_member in group_set:
        return "member"
    return None


# ─── Graph API Admin Operations (using client credentials) ───────────────────

async def _get_app_token() -> str | None:
    """Get an application-level token using client credentials flow."""
    if not settings.entra_tenant_id or not settings.entra_client_id or not settings.entra_client_secret:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"https://login.microsoftonline.com/{settings.entra_tenant_id}/oauth2/v2.0/token",
                data={
                    "client_id": settings.entra_client_id,
                    "client_secret": settings.entra_client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                },
            )
            if resp.status_code == 200:
                return resp.json().get("access_token")
            logger.error("Failed to get app token: %s", resp.text[:200])
    except Exception as exc:
        logger.error("Error getting app token: %s", exc)
    return None


async def add_user_to_group(user_oid: str, group_id: str) -> bool:
    """Add a user to an Entra security group."""
    token = await _get_app_token()
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{GRAPH_API}/groups/{group_id}/members/$ref",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={"@odata.id": f"{GRAPH_API}/directoryObjects/{user_oid}"},
            )
            return resp.status_code in (200, 204)
    except Exception as exc:
        logger.error("Error adding user to group: %s", exc)
    return False


async def remove_user_from_group(user_oid: str, group_id: str) -> bool:
    """Remove a user from an Entra security group."""
    token = await _get_app_token()
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(
                f"{GRAPH_API}/groups/{group_id}/members/{user_oid}/$ref",
                headers={"Authorization": f"Bearer {token}"},
            )
            return resp.status_code in (200, 204)
    except Exception as exc:
        logger.error("Error removing user from group: %s", exc)
    return False


async def change_user_group(user_oid: str, old_group_id: str, new_group_id: str) -> bool:
    """Move a user from one group to another (role change)."""
    removed = await remove_user_from_group(user_oid, old_group_id)
    added = await add_user_to_group(user_oid, new_group_id)
    return removed and added


def get_group_id_for_role(role: str) -> str:
    """Get the Entra security group ID for a given FlowForge role."""
    mapping = {
        "platform_admin": settings.entra_group_platform_admin,
        "org_owner": settings.entra_group_org_owner,
        "manager": settings.entra_group_manager,
        "member": settings.entra_group_member,
    }
    return mapping.get(role, "")


async def invite_user_to_entra(email: str, role: str) -> tuple[bool, str | None]:
    """
    Send a B2B guest invitation via Graph API and add to the appropriate group.
    Returns (success: bool, error_detail: str | None).
    """
    token = await _get_app_token()
    if not token:
        logger.warning("Cannot invite to Entra — no app token available")
        return False, "Entra ID is not configured correctly (missing client credentials)."
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{GRAPH_API}/invitations",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "invitedUserEmailAddress": email,
                    "inviteRedirectUrl": settings.frontend_url,
                    "sendInvitationMessage": True,
                },
            )
            if resp.status_code in (200, 201):
                invited_user = resp.json().get("invitedUser", {})
                user_oid = invited_user.get("id")
                if user_oid:
                    group_id = get_group_id_for_role(role)
                    if group_id:
                        await add_user_to_group(user_oid, group_id)
                return True, None

            # Parse Microsoft Graph error for a user-friendly message
            error_body = resp.text[:500]
            logger.error("Entra invite failed (HTTP %s): %s", resp.status_code, error_body)

            if resp.status_code in (401, 403) or "Insufficient privileges" in error_body:
                return False, (
                    "Azure App Registration lacks the 'User.Invite.All' permission. "
                    "An admin must grant this permission and provide admin consent in the Azure Portal."
                )
            if resp.status_code == 400:
                try:
                    msg = resp.json().get("error", {}).get("message", error_body)
                except Exception:
                    msg = error_body
                return False, f"Bad request from Microsoft Graph: {msg}"

            return False, f"Microsoft Graph API returned HTTP {resp.status_code}."
    except httpx.TimeoutException:
        logger.error("Timeout inviting user to Entra")
        return False, "Microsoft Graph API request timed out. Please try again."
    except Exception as exc:
        logger.error("Error inviting user to Entra: %s", exc)
        return False, f"Unexpected error: {exc}"
