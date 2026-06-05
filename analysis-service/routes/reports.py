import os
import uuid
import logging
import httpx
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from rbac import require_role

# Conditionally import reporting tools so the service doesn't crash if they fail to install
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_REPORTING = True
except ImportError:
    HAS_REPORTING = False

# Conditionally import Azure
try:
    from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
    HAS_AZURE = True
except ImportError:
    HAS_AZURE = False

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics/reports", tags=["reports"])

AZURE_CONN_STR = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
CONTAINER_NAME = "flowforge-reports"
LOCAL_REPORTS_DIR = "/tmp/flowforge_reports"
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")
PROJECT_SERVICE_URL = os.getenv("PROJECT_SERVICE_URL", "http://project-service:8002")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_KEY", "")

# Ensure local fallback directory exists
os.makedirs(LOCAL_REPORTS_DIR, exist_ok=True)

class GenerateReportRequest(BaseModel):
    project_id: str | None = None
    project_name: str | None = None
    executive_summary: str
    chart_labels: list[str] = []
    chart_values: list[int] = []


def _build_bar_chart(labels, values, title, colors_list=None):
    """Create a bar chart and return as BytesIO."""
    buf = BytesIO()
    if not labels or not values:
        return None
    fig, ax = plt.subplots(figsize=(6, 3.5))
    bar_colors = colors_list or ['#6366f1', '#a78bfa', '#10b981', '#f59e0b', '#ef4444']
    bar_colors = (bar_colors * ((len(labels) // len(bar_colors)) + 1))[:len(labels)]
    bars = ax.bar(labels, values, color=bar_colors, width=0.5, edgecolor='white', linewidth=0.5)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.3,
                str(val), ha='center', va='bottom', fontsize=8, fontweight='bold')
    ax.set_title(title, fontsize=11, fontweight='bold', pad=10)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.tick_params(axis='x', labelsize=8)
    ax.tick_params(axis='y', labelsize=8)
    plt.tight_layout()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return buf


def _build_pie_chart(labels, values, title):
    """Create a pie chart and return as BytesIO."""
    buf = BytesIO()
    if not labels or not values or sum(values) == 0:
        return None
    fig, ax = plt.subplots(figsize=(5, 3.5))
    pie_colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']
    pie_colors = (pie_colors * ((len(labels) // len(pie_colors)) + 1))[:len(labels)]
    wedges, texts, autotexts = ax.pie(values, labels=labels, autopct='%1.1f%%',
                                       colors=pie_colors, startangle=90, textprops={'fontsize': 8})
    for t in autotexts:
        t.set_fontsize(7)
        t.set_fontweight('bold')
    ax.set_title(title, fontsize=11, fontweight='bold', pad=10)
    plt.tight_layout()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)
    return buf


async def _fetch_org_data():
    """Fetch users and projects data from internal services for the report."""
    users = []
    projects = []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Fetch all users
            resp = await client.get(f"{AUTH_SERVICE_URL}/auth/users",
                                     headers={"X-User-Role": "org_owner"})
            if resp.status_code == 200:
                data = resp.json()
                users = data.get("users", data) if isinstance(data, dict) else data

            # Fetch projects
            resp = await client.get(f"{PROJECT_SERVICE_URL}/projects",
                                     headers={"X-User-Role": "org_owner", "X-User-ID": "system"})
            if resp.status_code == 200:
                data = resp.json()
                projects = data.get("active", []) + data.get("archived", []) if isinstance(data, dict) else data
    except Exception as e:
        logger.warning(f"Failed to fetch org data for report: {e}")
    return users, projects


@router.post("/generate", dependencies=[require_role("org_owner", "platform_admin")])
async def generate_report(payload: GenerateReportRequest, request: Request):
    if not HAS_REPORTING:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Reporting libraries not installed")

    now = datetime.utcnow()
    display_name = f"AnalysisReport-({now.strftime('%Y-%m-%d %H:%M')})"
    file_id = f"AnalysisReport-{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.pdf"

    # Fetch org data for enriched report
    users, projects = await _fetch_org_data()

    # Classify users
    managers = [u for u in users if u.get("role") == "manager" and u.get("is_active", True)]
    members = [u for u in users if u.get("role") == "member" and u.get("is_active", True)]
    active_users = [u for u in users if u.get("is_active", True)]
    total_users = len(users)
    total_active = len(active_users)
    total_managers = len(managers)
    total_members = len(members)

    active_projects = [p for p in projects if not p.get("is_archived", False)]
    archived_projects = [p for p in projects if p.get("is_archived", False)]

    # Build PDF
    pdf_buffer = BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter, leftMargin=50, rightMargin=50, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle('ReportTitle', parent=styles['Title'], fontSize=22, textColor=colors.HexColor('#1e1b4b'), spaceAfter=4)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#6b7280'), spaceAfter=16)
    heading_style = ParagraphStyle('SectionHeading', parent=styles['Heading2'], fontSize=14, textColor=colors.HexColor('#312e81'), spaceBefore=16, spaceAfter=8,
                                    borderColor=colors.HexColor('#6366f1'), borderWidth=0, borderPadding=0)
    body_style = ParagraphStyle('BodyText', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#374151'), leading=16)
    small_style = ParagraphStyle('SmallText', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#9ca3af'))

    story = []

    # ── Title Page ────────────────────────────────────────────────────────
    story.append(Spacer(1, 60))
    story.append(Paragraph("FlowForge Executive Report", title_style))
    story.append(Paragraph(display_name, subtitle_style))
    story.append(Paragraph(f"Generated on: {now.strftime('%Y-%m-%d %H:%M:%S UTC')}", small_style))
    story.append(Spacer(1, 8))

    # Org summary line
    story.append(Paragraph(f"Organization: {payload.project_name or 'FlowForge'}", body_style))
    story.append(Spacer(1, 30))

    # ── Executive Summary ─────────────────────────────────────────────────
    story.append(Paragraph("Executive Summary", heading_style))
    for p in payload.executive_summary.split('\n'):
        if p.strip():
            story.append(Paragraph(p.strip(), body_style))
            story.append(Spacer(1, 6))
    story.append(Spacer(1, 12))

    # ── Organization Overview ─────────────────────────────────────────────
    story.append(Paragraph("Organization Overview", heading_style))

    overview_data = [
        ["Metric", "Value"],
        ["Total Users", str(total_users)],
        ["Active Users", str(total_active)],
        ["Managers", str(total_managers)],
        ["Members", str(total_members)],
        ["Active Projects", str(len(active_projects))],
        ["Archived Projects", str(len(archived_projects))],
    ]
    overview_table = Table(overview_data, colWidths=[3 * inch, 2 * inch])
    overview_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6366f1')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9fafb')]),
    ]))
    story.append(overview_table)
    story.append(Spacer(1, 20))

    # ── Task Status Distribution (from payload or computed) ───────────────
    if payload.chart_labels and payload.chart_values:
        story.append(Paragraph("Task Status Distribution", heading_style))
        pie_buf = _build_pie_chart(payload.chart_labels, payload.chart_values, "Task Status Breakdown")
        if pie_buf:
            story.append(Image(pie_buf, width=320, height=220))
        story.append(Spacer(1, 8))

        bar_buf = _build_bar_chart(payload.chart_labels, payload.chart_values, "Task Counts by Status")
        if bar_buf:
            story.append(Image(bar_buf, width=380, height=220))
        story.append(Spacer(1, 20))

    # ── Projects Section ──────────────────────────────────────────────────
    if active_projects:
        story.append(Paragraph("Active Projects", heading_style))
        proj_data = [["Project Name", "Members", "Created"]]
        for p in active_projects[:15]:
            proj_data.append([
                p.get("name", "—"),
                str(p.get("member_count", 0)),
                str(p.get("created_at", "—"))[:10],
            ])
        proj_table = Table(proj_data, colWidths=[3 * inch, 1.2 * inch, 1.5 * inch])
        proj_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#10b981')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f0fdf4')]),
        ]))
        story.append(proj_table)
        story.append(Spacer(1, 20))

    # ── Manager Breakdown Sections ────────────────────────────────────────
    if managers:
        story.append(PageBreak())
        story.append(Paragraph("Manager &amp; Team Breakdown", heading_style))
        story.append(Paragraph("Detailed view of each manager and their assigned team members.", body_style))
        story.append(Spacer(1, 12))

        # Manager overview chart
        mgr_names = [m.get("full_name", "?")[:15] for m in managers]
        mgr_member_counts = []
        for mgr in managers:
            count = sum(1 for mem in members if mem.get("manager_id") == mgr.get("id"))
            mgr_member_counts.append(count)

        mgr_chart = _build_bar_chart(mgr_names, mgr_member_counts, "Team Size per Manager",
                                      ['#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981'])
        if mgr_chart:
            story.append(Image(mgr_chart, width=400, height=230))
            story.append(Spacer(1, 16))

        # Per-manager detail tables
        for mgr in managers:
            mgr_id = mgr.get("id")
            mgr_members = [m for m in members if m.get("manager_id") == mgr_id]
            mgr_projects = [p for p in active_projects if str(p.get("manager_id")) == str(mgr_id)]

            story.append(Spacer(1, 10))
            story.append(Paragraph(f"Manager: {mgr.get('full_name', '—')}", ParagraphStyle(
                'MgrName', parent=styles['Heading3'], fontSize=12, textColor=colors.HexColor('#4338ca'), spaceBefore=8, spaceAfter=4)))
            story.append(Paragraph(f"Email: {mgr.get('email', '—')} &nbsp;|&nbsp; Projects: {len(mgr_projects)} &nbsp;|&nbsp; Team Size: {len(mgr_members)}", small_style))
            story.append(Spacer(1, 6))

            if mgr_members:
                mem_data = [["Member Name", "Email", "Status"]]
                for mem in mgr_members:
                    mem_data.append([
                        mem.get("full_name", "—"),
                        mem.get("email", "—"),
                        "Active" if mem.get("is_active") else "Inactive",
                    ])
                mem_table = Table(mem_data, colWidths=[2.2 * inch, 2.5 * inch, 1 * inch])
                mem_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7c3aed')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e5e7eb')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#faf5ff')]),
                ]))
                story.append(mem_table)
            else:
                story.append(Paragraph("No team members assigned.", small_style))

            story.append(Spacer(1, 10))

    # ── Footer ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 30))
    story.append(Paragraph("— End of Report —", ParagraphStyle(
        'Footer', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#9ca3af'), alignment=1)))
    story.append(Paragraph(f"Generated by FlowForge Analytics Engine on {now.strftime('%Y-%m-%d %H:%M:%S UTC')}", ParagraphStyle(
        'FooterSmall', parent=styles['Normal'], fontSize=7, textColor=colors.HexColor('#d1d5db'), alignment=1)))

    doc.build(story)
    pdf_bytes = pdf_buffer.getvalue()

    # 3. Upload to Azure or save locally
    if HAS_AZURE and AZURE_CONN_STR:
        try:
            blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONN_STR)
            container_client = blob_service_client.get_container_client(CONTAINER_NAME)
            if not container_client.exists():
                container_client.create_container()

            blob_client = container_client.get_blob_client(file_id)
            blob_client.upload_blob(pdf_bytes, overwrite=True)

            sas_token = generate_blob_sas(
                account_name=blob_service_client.account_name,
                container_name=CONTAINER_NAME,
                blob_name=file_id,
                account_key=blob_service_client.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + __import__('datetime').timedelta(hours=24)
            )
            url = f"{blob_client.url}?{sas_token}"
            return {"success": True, "report_id": file_id, "name": display_name, "url": url, "storage": "azure"}
        except Exception as e:
            logger.error(f"Azure upload failed: {e}")

    # Local fallback
    local_path = os.path.join(LOCAL_REPORTS_DIR, file_id)
    with open(local_path, "wb") as f:
        f.write(pdf_bytes)

    url = f"/api/analytics/reports/download/{file_id}"
    return {"success": True, "report_id": file_id, "name": display_name, "url": url, "storage": "local"}

@router.get("", dependencies=[require_role("org_owner", "platform_admin")])
async def list_reports():
    reports = []

    if HAS_AZURE and AZURE_CONN_STR:
        try:
            blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONN_STR)
            container_client = blob_service_client.get_container_client(CONTAINER_NAME)
            if container_client.exists():
                for blob in container_client.list_blobs():
                    if blob.name.endswith(".pdf"):
                        sas_token = generate_blob_sas(
                            account_name=blob_service_client.account_name,
                            container_name=CONTAINER_NAME,
                            blob_name=blob.name,
                            account_key=blob_service_client.credential.account_key,
                            permission=BlobSasPermissions(read=True),
                            expiry=datetime.utcnow() + __import__('datetime').timedelta(hours=24)
                        )
                        url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{CONTAINER_NAME}/{blob.name}?{sas_token}"
                        # Derive display name from filename
                        display = blob.name.replace(".pdf", "").replace("_", " ")
                        reports.append({
                            "id": blob.name,
                            "name": display,
                            "created_at": blob.creation_time.isoformat() if blob.creation_time else datetime.utcnow().isoformat(),
                            "url": url,
                            "storage": "azure"
                        })
            return {"reports": sorted(reports, key=lambda x: x["created_at"], reverse=True)}
        except Exception as e:
            logger.error(f"Azure list blobs failed: {e}")
            pass

    # Local fallback
    for fname in os.listdir(LOCAL_REPORTS_DIR):
        if fname.endswith(".pdf"):
            path = os.path.join(LOCAL_REPORTS_DIR, fname)
            st = os.stat(path)
            # Derive display name: AnalysisReport-(2026-06-05 11:30) from filename
            display = fname.replace(".pdf", "")
            # Try to parse date from filename for display
            parts = display.split("-", 1)
            if len(parts) > 1:
                display = f"AnalysisReport-({datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M')})"
            reports.append({
                "id": fname,
                "name": display,
                "created_at": datetime.fromtimestamp(st.st_mtime).isoformat() + "Z",
                "url": f"/api/analytics/reports/download/{fname}",
                "storage": "local"
            })

    return {"reports": sorted(reports, key=lambda x: x["created_at"], reverse=True)}


@router.get("/download/{report_id}", dependencies=[require_role("org_owner", "platform_admin")])
async def download_report(report_id: str):
    """Fallback endpoint for local storage downloads"""
    safe_id = os.path.basename(report_id)
    local_path = os.path.join(LOCAL_REPORTS_DIR, safe_id)

    if not os.path.exists(local_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found locally")

    return FileResponse(
        local_path,
        media_type="application/pdf",
        filename=safe_id,
        content_disposition_type="inline"
    )
