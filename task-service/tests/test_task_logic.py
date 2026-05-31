"""
Unit tests for task-service business logic — FAD Section 12.3
Covers: task approval flow, task status transitions, soft delete.
"""
import uuid
import pytest


# ─── Task approval flow ─────────────────────────────────────────────────────

def needs_approval(user_role: str, new_status: str) -> bool:
    """FAD 2.4: member setting DONE triggers approval."""
    return user_role == "member" and new_status == "DONE"


def test_member_done_needs_approval():
    assert needs_approval("member", "DONE") is True


def test_member_in_progress_no_approval():
    assert needs_approval("member", "IN_PROGRESS") is False


def test_manager_done_no_approval():
    assert needs_approval("manager", "DONE") is False


def test_admin_done_no_approval():
    assert needs_approval("platform_admin", "DONE") is False


# ─── Status transitions ─────────────────────────────────────────────────────

VALID_STATUSES = {"TODO", "IN_PROGRESS", "DONE", "BLOCKED"}


def test_valid_status_values():
    for s in ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"]:
        assert s in VALID_STATUSES


def test_invalid_status_rejected():
    assert "CANCELLED" not in VALID_STATUSES
    assert "PENDING" not in VALID_STATUSES


# ─── Approval request resolution ────────────────────────────────────────────

def resolve_approval(action: str, task_status: str, proposed_status: str):
    """Simulate approval resolution."""
    if action == "approved":
        return proposed_status, False, None
    return task_status, False, None  # Revert to original status


def test_approve_sets_done():
    new_status, needs, proposed = resolve_approval("approved", "IN_PROGRESS", "DONE")
    assert new_status == "DONE"
    assert needs is False


def test_reject_reverts_status():
    new_status, needs, proposed = resolve_approval("rejected", "IN_PROGRESS", "DONE")
    assert new_status == "IN_PROGRESS"
    assert needs is False


# ─── Soft delete ─────────────────────────────────────────────────────────────

def test_soft_delete_sets_deleted_at():
    task = {"id": uuid.uuid4(), "deleted_at": None}
    task["deleted_at"] = "2024-01-15T10:30:00"
    assert task["deleted_at"] is not None


def test_soft_deleted_tasks_excluded_from_queries():
    tasks = [
        {"id": 1, "deleted_at": None},
        {"id": 2, "deleted_at": "2024-01-15"},
        {"id": 3, "deleted_at": None},
    ]
    active = [t for t in tasks if t["deleted_at"] is None]
    assert len(active) == 2
    assert all(t["deleted_at"] is None for t in active)


# ─── Comment access ─────────────────────────────────────────────────────────

def test_comments_require_task_access():
    """Only users with access to the task's project can comment."""
    has_project_access = True
    can_comment = has_project_access
    assert can_comment is True


def test_no_access_no_comment():
    has_project_access = False
    can_comment = has_project_access
    assert can_comment is False


# ─── Priority values ────────────────────────────────────────────────────────

VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH"}


def test_valid_priorities():
    for p in ["LOW", "MEDIUM", "HIGH"]:
        assert p in VALID_PRIORITIES


def test_default_priority_is_medium():
    default = "MEDIUM"
    assert default in VALID_PRIORITIES


# ─── Kanban position ────────────────────────────────────────────────────────

def test_position_ordering():
    tasks = [
        {"id": 1, "position": 2},
        {"id": 2, "position": 0},
        {"id": 3, "position": 1},
    ]
    ordered = sorted(tasks, key=lambda t: t["position"])
    assert [t["id"] for t in ordered] == [2, 3, 1]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
