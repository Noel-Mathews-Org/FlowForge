# This file is deprecated. Routes have been moved to projects.py 
# to ensure correct literal route precedence over parameterized routes.
from fastapi import APIRouter

router = APIRouter(prefix="/projects", tags=["approvals"])