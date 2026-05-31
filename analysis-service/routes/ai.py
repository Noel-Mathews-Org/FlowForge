"""
AI Summary endpoints for FlowForge analysis-service.
  POST /ai/summarize-project   → manager, platform_admin
  POST /ai/summarize-org       → org_owner, platform_admin

Graceful degradation: if AI not configured, returns basic stats summary.
"""
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])

# ─── In-memory AI cost tracker ───────────────────────────────────────────────
_ai_usage: list[dict] = []   # [{timestamp, tokens_used, cost_usd, model}]
COST_PER_1K_TOKENS = 0.002   # gpt-3.5-turbo pricing

def _track_usage(resp_json: dict, model: str) -> None:
    usage = resp_json.get("usage", {})
    total_tokens = usage.get("total_tokens", 0)
    cost = round(total_tokens / 1000 * COST_PER_1K_TOKENS, 6)
    _ai_usage.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tokens_used": total_tokens,
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "cost_usd": cost,
        "model": model,
    })

# ─── AI Config ───────────────────────────────────────────────────────────────
AZURE_ENDPOINT = os.getenv("AZURE_FOUNDRY_ENDPOINT", "")
AZURE_KEY = os.getenv("AZURE_FOUNDRY_KEY", "")
AZURE_DEPLOYMENT = os.getenv("AZURE_FOUNDRY_DEPLOYMENT", "gpt-35-turbo")
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
AI_CONFIGURED = bool(AZURE_KEY or OPENAI_KEY)


class ProjectSummaryRequest(BaseModel):
    project_id: str
    project_name: str
    total_tasks: int
    completed: int
    in_progress: int
    blocked: int
    pending: int
    completed_this_week: int = 0
    created_this_week: int = 0


class OrgSummaryRequest(BaseModel):
    projects: list[dict]          # [{name, total, completed, in_progress}]
    total_tasks: int
    total_completed: int


class SummaryResponse(BaseModel):
    summary: str
    generated_by: str             # "ai" | "fallback"
    model: Optional[str] = None


# ─── AI Call ─────────────────────────────────────────────────────────────────

async def _call_ai(prompt: str) -> str:
    """Call Azure Foundry or OpenAI. Returns response text."""
    messages = [{"role": "user", "content": prompt}]

    if AZURE_KEY and AZURE_ENDPOINT:
        url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview"
        headers = {"api-key": AZURE_KEY, "Content-Type": "application/json"}
        payload = {"messages": messages, "max_tokens": 200, "temperature": 0.7}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            _track_usage(data, f"azure/{AZURE_DEPLOYMENT}")
            return data["choices"][0]["message"]["content"].strip()

    if OPENAI_KEY:
        headers = {"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"}
        payload = {"model": OPENAI_MODEL, "messages": messages, "max_tokens": 200, "temperature": 0.7}
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            _track_usage(data, OPENAI_MODEL)
            return data["choices"][0]["message"]["content"].strip()

    raise RuntimeError("No AI provider configured")


def _project_fallback(req: ProjectSummaryRequest) -> str:
    pct = round(req.completed / req.total_tasks * 100) if req.total_tasks else 0
    parts = [f"Project '{req.project_name}' is {pct}% complete with {req.completed}/{req.total_tasks} tasks done."]
    if req.in_progress:
        parts.append(f"{req.in_progress} task(s) in progress.")
    if req.blocked:
        parts.append(f"⚠️ {req.blocked} task(s) blocked — attention required.")
    if req.completed_this_week:
        parts.append(f"{req.completed_this_week} task(s) completed this week.")
    return " ".join(parts)


def _org_fallback(req: OrgSummaryRequest) -> str:
    pct = round(req.total_completed / req.total_tasks * 100) if req.total_tasks else 0
    top = sorted(req.projects, key=lambda p: p.get("completed", 0) / max(p.get("total", 1), 1), reverse=True)
    summary = f"Organization is {pct}% complete across {len(req.projects)} project(s) ({req.total_completed}/{req.total_tasks} tasks)."
    if top:
        best = top[0]
        summary += f" Top performer: '{best.get('name', 'Unknown')}' with {best.get('completed', 0)} tasks completed."
    return summary


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/summarize-project", response_model=SummaryResponse)
async def summarize_project(payload: ProjectSummaryRequest, request: Request):
    role = (getattr(request.state, "user_role", "") or "").lower()
    if role not in {"manager", "platform_admin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Manager or platform_admin required")

    if not AI_CONFIGURED:
        return SummaryResponse(summary=_project_fallback(payload), generated_by="fallback")

    pct = round(payload.completed / payload.total_tasks * 100) if payload.total_tasks else 0
    prompt = (
        f"You are a project management assistant. Summarize this project status concisely:\n\n"
        f"Project Name: {payload.project_name}\n"
        f"Total Tasks: {payload.total_tasks}\n"
        f"Completed: {payload.completed} ({pct}%)\n"
        f"In Progress: {payload.in_progress}\n"
        f"Blocked: {payload.blocked}\n"
        f"Pending: {payload.pending}\n\n"
        f"Recent activity (last 7 days):\n"
        f"- Tasks completed: {payload.completed_this_week}\n"
        f"- Tasks created: {payload.created_this_week}\n\n"
        f"Provide 2-3 sentences focusing on progress, recent momentum, and any blockers."
    )
    try:
        text = await _call_ai(prompt)
        model_name = f"azure/{AZURE_DEPLOYMENT}" if AZURE_KEY else OPENAI_MODEL
        return SummaryResponse(summary=text, generated_by="ai", model=model_name)
    except Exception as exc:
        logger.warning("AI call failed, using fallback: %s", exc)
        return SummaryResponse(summary=_project_fallback(payload), generated_by="fallback")


@router.post("/summarize-org", response_model=SummaryResponse)
async def summarize_org(payload: OrgSummaryRequest, request: Request):
    role = (getattr(request.state, "user_role", "") or "").lower()
    if role not in {"org_owner", "platform_admin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "org_owner or platform_admin required")

    if not AI_CONFIGURED:
        return SummaryResponse(summary=_org_fallback(payload), generated_by="fallback")

    project_lines = "\n".join(
        f"- {p.get('name', 'Unknown')}: {p.get('completed', 0)}/{p.get('total', 0)} tasks done"
        for p in payload.projects[:10]
    )
    prompt = (
        f"You are an executive assistant. Summarize this organization's health:\n\n"
        f"Projects:\n{project_lines}\n\n"
        f"Overall completion: {payload.total_completed}/{payload.total_tasks} tasks\n\n"
        f"Provide 3-4 sentences: highlight top performing projects, struggling projects, and overall trends. Be actionable."
    )
    try:
        text = await _call_ai(prompt)
        model_name = f"azure/{AZURE_DEPLOYMENT}" if AZURE_KEY else OPENAI_MODEL
        return SummaryResponse(summary=text, generated_by="ai", model=model_name)
    except Exception as exc:
        logger.warning("AI org call failed, using fallback: %s", exc)
        return SummaryResponse(summary=_org_fallback(payload), generated_by="fallback")


# ─── AI Usage / Cost Endpoint ────────────────────────────────────────────────

@router.get("/usage")
async def ai_usage(request: Request):
    role = (getattr(request.state, "user_role", "") or "").lower()
    if role != "platform_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "platform_admin required")
    from datetime import datetime as dt
    now = dt.now(timezone.utc)
    # Filter to current month
    month_entries = [e for e in _ai_usage if e["timestamp"][:7] == now.strftime("%Y-%m")]
    total_tokens = sum(e["tokens_used"] for e in month_entries)
    total_cost = round(sum(e["cost_usd"] for e in month_entries), 4)
    return {
        "total_tokens_this_month": total_tokens,
        "estimated_cost_usd": total_cost,
        "total_requests": len(month_entries),
        "entries": month_entries[-50:],  # last 50 entries
        "ai_configured": AI_CONFIGURED,
    }
