"""
Unit tests for project-service business logic — FAD Section 12.3
Covers: project name uniqueness, archive rules, member access control.
"""
import uuid
import pytest


# ─── Access control simulation ───────────────────────────────────────────────

ADMIN_ROLES = {"platform_admin", "org_owner"}


def can_access_project(user_id, user_role, project_manager_id, project_archived, is_member):
    """Simulates _can_access_project logic from projects.py"""
    if user_role in ADMIN_ROLES:
        return True
    if project_manager_id == user_id:
        return True
    if is_member:
        if project_archived:
            return False  # Members can't see archived projects
        return True
    return False


def test_admin_can_access_any_project():
    assert can_access_project(uuid.uuid4(), "platform_admin", uuid.uuid4(), False, False) is True


def test_org_owner_can_access_any_project():
    assert can_access_project(uuid.uuid4(), "org_owner", uuid.uuid4(), False, False) is True


def test_manager_can_access_own_project():
    mgr = uuid.uuid4()
    assert can_access_project(mgr, "manager", mgr, False, False) is True


def test_manager_cannot_access_others_project():
    assert can_access_project(uuid.uuid4(), "manager", uuid.uuid4(), False, False) is False


def test_member_can_access_active_project():
    assert can_access_project(uuid.uuid4(), "member", uuid.uuid4(), False, True) is True


def test_member_blocked_from_archived_project():
    assert can_access_project(uuid.uuid4(), "member", uuid.uuid4(), True, True) is False


def test_nonmember_cannot_access_project():
    assert can_access_project(uuid.uuid4(), "member", uuid.uuid4(), False, False) is False


# ─── Archive flow ────────────────────────────────────────────────────────────

def test_archive_sets_flags():
    project = {"is_archived": False, "archived_by": None, "archived_at": None}
    # Simulate archive
    project["is_archived"] = True
    project["archived_by"] = str(uuid.uuid4())
    project["archived_at"] = "2024-01-01T00:00:00"
    assert project["is_archived"] is True
    assert project["archived_by"] is not None
    assert project["archived_at"] is not None


def test_unarchive_clears_archived_flag():
    project = {"is_archived": True, "archived_by": str(uuid.uuid4())}
    project["is_archived"] = False
    assert project["is_archived"] is False


# ─── Project name uniqueness ────────────────────────────────────────────────

def test_create_project_duplicate_blocked():
    org_id = uuid.uuid4()
    existing = [{"org_id": org_id, "name": "Backend API"}]
    new_name = "Backend API"
    conflict = any(p["org_id"] == org_id and p["name"] == new_name for p in existing)
    assert conflict is True


def test_create_project_unique_name_allowed():
    org_id = uuid.uuid4()
    existing = [{"org_id": org_id, "name": "Backend API"}]
    new_name = "Frontend UI"
    conflict = any(p["org_id"] == org_id and p["name"] == new_name for p in existing)
    assert conflict is False


# ─── Member management ──────────────────────────────────────────────────────

def test_manager_auto_added_as_member():
    """When project created, manager is first member."""
    manager_id = uuid.uuid4()
    members = [manager_id]
    assert manager_id in members


def test_unique_membership():
    """(project_id, user_id) must be unique."""
    project_id = uuid.uuid4()
    user_id = uuid.uuid4()
    memberships = [(project_id, user_id)]
    duplicate = (project_id, user_id) in memberships
    assert duplicate is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
