"""
AI Summary endpoints for FlowForge analysis-service.
  POST /ai/summarize-project   → manager, platform_admin
  POST /ai/summarize-org       → org_owner, platform_admin
  GET  /ai/usage               → platform_admin

Guardrails:
  - max_tokens=150, temperature=0.3
  - timeout=8.0s with fallback summary on timeout
  - MAX_PROMPT_CHARS=5000 — reject if exceeded
  - Rate limit: 50 summaries/minute per user
  - Prompt: "Only use supplied data, max 3 sentences, under 100 words"
  - Backend fetches metrics from DB (never trusts frontend data)

Graceful degradation: if AI not configured, returns basic stats summary.
"""
import logging
import os
import time
import uuid as _uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import AiUsageLog, DailyTaskStats

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])

# ─── AI Config (all from env) ────────────────────────────────────────────────
AZURE_ENDPOINT = os.getenv("AZURE_FOUNDRY_ENDPOINT", "")
AZURE_KEY = os.getenv("AZURE_FOUNDRY_KEY", "")
AZURE_DEPLOYMENT = os.getenv("AZURE_FOUNDRY_DEPLOYMENT", "summary-agent")
AZURE_USE_MANAGED_IDENTITY = os.getenv("AZURE_FOUNDRY_USE_MANAGED_IDENTITY", "false").lower() == "true"
OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
AI_CONFIGURED = bool(AZURE_KEY or OPENAI_KEY or (AZURE_USE_MANAGED_IDENTITY and AZURE_ENDPOINT))

# ─── Guardrail Constants ─────────────────────────────────────────────────────
AI_MAX_TOKENS = 150
AI_TEMPERATURE = 0.3
AI_TIMEOUT = 8.0
MAX_PROMPT_CHARS = 5000
AI_RATE_LIMIT_PER_MINUTE = 50

# gpt-4.1-mini pricing (input + output averaged)
COST_PER_1K_INPUT_TOKENS = 0.0004
COST_PER_1K_OUTPUT_TOKENS = 0.0016

SYSTEM_PROMPT = (
    "You are a concise project management assistant for FlowForge. "
    "Rules you MUST follow:\n"
    "1. Only use the data supplied in the user message. Do NOT invent project names, numbers, or details.\n"
    "2. Do NOT make assumptions about data not provided.\n"
    "3. Return a maximum of 3 sentences.\n"
    "4. Keep your response under 100 words.\n"
    "5. Focus on progress, momentum, and actionable insights."
)

# ─── Rate Limiter (in-memory, per-user) ──────────────────────────────────────
_rate_limiter: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(user_id: str) -> None:
    now = time.time()
    window = _rate_limiter[user_id]
    _rate_limiter[user_id] = [t for t in window if now - t < 60]
    if len(_rate_limiter[user_id]) >= AI_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Rate limit exceeded: max {AI_RATE_LIMIT_PER_MINUTE} AI requests per minute",
        )
    _rate_limiter[user_id].append(now)


# ─── Persistent Usage Logging ────────────────────────────────────────────────

async def _log_usage(
    db: AsyncSession,
    resp_json: dict,
    model: str,
    endpoint: str,
    user_id: str,
    org_id: str,
    project_id: str | None = None,
) -> None:
    usage = resp_json.get("usage", {})
    prompt_tokens = usage.get("prompt_tokens", 0)
    completion_tokens = usage.get("completion_tokens", 0)
    total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
    cost = round(
        prompt_tokens / 1000 * COST_PER_1K_INPUT_TOKENS
        + completion_tokens / 1000 * COST_PER_1K_OUTPUT_TOKENS,
        6,
    )
    log_entry = AiUsageLog(
        organization_id=org_id,
        project_id=project_id,
        user_id=user_id,
        endpoint=endpoint,
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        cost_usd=cost,
    )
    db.add(log_entry)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning("Failed to persist AI usage log")


# ─── Request / Response Models ───────────────────────────────────────────────

class ProjectSummaryRequest(BaseModel):
    project_id: str


class OrgSummaryRequest(BaseModel):
    """No frontend data accepted — backend fetches everything."""
    pass


class SummaryResponse(BaseModel):
    summary: str
    generated_by: str             # "ai" | "fallback"
    model: Optional[str] = None


# ─── AI Call ─────────────────────────────────────────────────────────────────

async def _get_azure_token() -> str:
    """Get access token via Managed Identity for Azure AI Foundry."""
    try:
        from azure.identity.aio import DefaultAzureCredential
        credential = DefaultAzureCredential()
        token = await credential.get_token("https://cognitiveservices.azure.com/.default")
        await credential.close()
        return token.token
    except Exception as exc:
        logger.error("Failed to get Managed Identity token: %s", exc)
        raise RuntimeError("Managed Identity authentication failed") from exc


async def _call_ai(prompt: str, db: AsyncSession, user_id: str, org_id: str, endpoint: str, project_id: str | None = None) -> str:
    """Call Azure Foundry or OpenAI with guardrails. Returns response text."""
    if len(prompt) > MAX_PROMPT_CHARS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Prompt too large ({len(prompt)} chars). Maximum is {MAX_PROMPT_CHARS}.",
        )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    payload = {"messages": messages, "max_tokens": AI_MAX_TOKENS, "temperature": AI_TEMPERATURE}

    model_name = "unknown"
    try:
        if AZURE_ENDPOINT and (AZURE_KEY or AZURE_USE_MANAGED_IDENTITY):
            url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version=2024-02-15-preview"

            if AZURE_USE_MANAGED_IDENTITY:
                token = await _get_azure_token()
                headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            else:
                headers = {"api-key": AZURE_KEY, "Content-Type": "application/json"}

            model_name = f"azure/{AZURE_DEPLOYMENT}"
            async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                await _log_usage(db, data, model_name, endpoint, user_id, org_id, project_id)
                return data["choices"][0]["message"]["content"].strip()

        if OPENAI_KEY:
            headers = {"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"}
            payload["model"] = OPENAI_MODEL
            model_name = OPENAI_MODEL
            async with httpx.AsyncClient(timeout=AI_TIMEOUT) as client:
                resp = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                await _log_usage(db, data, model_name, endpoint, user_id, org_id, project_id)
                return data["choices"][0]["message"]["content"].strip()

        raise RuntimeError("No AI provider configured")

    except httpx.TimeoutException:
        logger.warning("AI call timed out after %.1fs", AI_TIMEOUT)
        raise  # Let caller handle with fallback
    except httpx.HTTPStatusError as exc:
        logger.warning("AI API error %s: %s", exc.response.status_code, exc.response.text[:200])
        raise


# ─── Fallback Summaries ──────────────────────────────────────────────────────

def _project_fallback(name: str, total: int, completed: int, in_progress: int, blocked: int) -> str:
    pct = round(completed / total * 100) if total else 0
    parts = [f"Project '{name}' is {pct}% complete with {completed}/{total} tasks done."]
    if in_progress:
        parts.append(f"{in_progress} task(s) in progress.")
    if blocked:
        parts.append(f"⚠️ {blocked} task(s) blocked — attention required.")
    return " ".join(parts)


def _org_fallback(total_tasks: int, total_completed: int, project_count: int) -> str:
    pct = round(total_completed / total_tasks * 100) if total_tasks else 0
    return (
        f"Organization is {pct}% complete across {project_count} project(s) "
        f"({total_completed}/{total_tasks} tasks)."
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/summarize-project", response_model=SummaryResponse)
async def summarize_project(payload: ProjectSummaryRequest, request: Request, db: AsyncSession = Depends(get_db)):
    role = (getattr(request.state, "user_role", "") or "").lower()
    if role not in {"manager", "platform_admin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Manager or platform_admin required")

    user_id = getattr(request.state, "user_id", "") or ""
    org_id = getattr(request.state, "org_id", "") or ""
    _check_rate_limit(user_id)

    # ── Fetch real metrics from analytics DB ──
    stats = await db.execute(
        select(
            func.coalesce(func.sum(DailyTaskStats.tasks_created), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_completed), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_in_progress), 0),
        ).where(DailyTaskStats.project_id == payload.project_id)
    )
    created, completed, in_progress = stats.one()
    created, completed, in_progress = int(created), int(completed), int(in_progress)
    blocked = 0  # blocked is not tracked in DailyTaskStats currently
    pending = max(created - completed - in_progress, 0)

    if not AI_CONFIGURED:
        return SummaryResponse(
            summary=_project_fallback("Project", created, completed, in_progress, blocked),
            generated_by="fallback",
        )

    pct = round(completed / created * 100) if created else 0
    prompt = (
        f"Summarize this project status:\n\n"
        f"Project ID: {payload.project_id}\n"
        f"Total Tasks: {created}\n"
        f"Completed: {completed} ({pct}%)\n"
        f"In Progress: {in_progress}\n"
        f"Pending: {pending}\n"
    )
    try:
        text = await _call_ai(prompt, db, user_id, org_id, "summarize-project", payload.project_id)
        model_name = f"azure/{AZURE_DEPLOYMENT}" if (AZURE_KEY or AZURE_USE_MANAGED_IDENTITY) else OPENAI_MODEL
        return SummaryResponse(summary=text, generated_by="ai", model=model_name)
    except Exception as exc:
        logger.warning("AI call failed, using fallback: %s", exc)
        return SummaryResponse(
            summary=_project_fallback("Project", created, completed, in_progress, blocked),
            generated_by="fallback",
        )


@router.post("/summarize-org", response_model=SummaryResponse)
async def summarize_org(request: Request, db: AsyncSession = Depends(get_db)):
    role = (getattr(request.state, "user_role", "") or "").lower()
    if role not in {"org_owner", "platform_admin"}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "org_owner or platform_admin required")

    user_id = getattr(request.state, "user_id", "") or ""
    org_id = getattr(request.state, "org_id", "") or ""
    _check_rate_limit(user_id)

    # ── Fetch real org-wide metrics from DB ──
    totals = await db.execute(
        select(
            func.coalesce(func.sum(DailyTaskStats.tasks_created), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_completed), 0),
            func.coalesce(func.sum(DailyTaskStats.tasks_in_progress), 0),
        )
    )
    total_created, total_completed, total_in_progress = totals.one()
    total_created, total_completed = int(total_created), int(total_completed)

    # Per-project breakdown
    proj_rows = (await db.execute(
        select(
            DailyTaskStats.project_id,
            func.sum(DailyTaskStats.tasks_completed).label("completed"),
            func.sum(DailyTaskStats.tasks_created).label("created"),
        )
        .group_by(DailyTaskStats.project_id)
        .order_by(func.sum(DailyTaskStats.tasks_completed).desc())
        .limit(10)
    )).all()

    project_count = len(proj_rows)

    if not AI_CONFIGURED:
        return SummaryResponse(
            summary=_org_fallback(total_created, total_completed, project_count),
            generated_by="fallback",
        )

    project_lines = "\n".join(
        f"- Project {r.project_id}: {int(r.completed)}/{int(r.created)} tasks done"
        for r in proj_rows
    )
    prompt = (
        f"Summarize this organization's health:\n\n"
        f"Projects ({project_count} total):\n{project_lines}\n\n"
        f"Overall: {total_completed}/{total_created} tasks completed\n"
    )
    try:
        text = await _call_ai(prompt, db, user_id, org_id, "summarize-org")
        model_name = f"azure/{AZURE_DEPLOYMENT}" if (AZURE_KEY or AZURE_USE_MANAGED_IDENTITY) else OPENAI_MODEL
        return SummaryResponse(summary=text, generated_by="ai", model=model_name)
    except Exception as exc:
        logger.warning("AI org call failed, using fallback: %s", exc)
        return SummaryResponse(
            summary=_org_fallback(total_created, total_completed, project_count),
            generated_by="fallback",
        )


# ─── AI Usage / Cost Endpoint (now DB-backed) ───────────────────────────────

@router.get("/usage")
async def ai_usage(request: Request, db: AsyncSession = Depends(get_db)):
    role = (getattr(request.state, "user_role", "") or "").lower()
    if role != "platform_admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "platform_admin required")

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Aggregate from DB
    agg = await db.execute(
        select(
            func.coalesce(func.sum(AiUsageLog.total_tokens), 0),
            func.coalesce(func.sum(AiUsageLog.cost_usd), 0),
            func.count(AiUsageLog.id),
        ).where(AiUsageLog.created_at >= month_start)
    )
    total_tokens, total_cost, total_requests = agg.one()

    # Recent entries
    recent = (await db.execute(
        select(AiUsageLog)
        .where(AiUsageLog.created_at >= month_start)
        .order_by(AiUsageLog.created_at.desc())
        .limit(50)
    )).scalars().all()

    entries = [
        {
            "timestamp": e.created_at.isoformat(),
            "tokens_used": e.total_tokens,
            "prompt_tokens": e.prompt_tokens,
            "completion_tokens": e.completion_tokens,
            "cost_usd": float(e.cost_usd),
            "model": e.model,
            "endpoint": e.endpoint,
        }
        for e in recent
    ]

    return {
        "total_tokens_this_month": int(total_tokens),
        "estimated_cost_usd": round(float(total_cost), 4),
        "total_requests": int(total_requests),
        "entries": entries,
        "ai_configured": AI_CONFIGURED,
    }
