"""
admin.py — Deprecated. Superseded by routes/users.py.
Kept as an empty router to avoid import errors in case any external code still references it.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/auth/admin", tags=["admin-legacy"])
