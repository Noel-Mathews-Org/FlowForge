import os
import uuid
import logging
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from rbac import require_role

# Conditionally import reporting tools so the service doesn't crash if they fail to install
try:
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
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
LOCAL_REPORTS_DIR = "/app/data/reports" if os.getenv("DOCKER_ENV") else "./data/reports"

# Ensure local fallback directory exists
os.makedirs(LOCAL_REPORTS_DIR, exist_ok=True)

class GenerateReportRequest(BaseModel):
    project_id: str | None = None
    project_name: str | None = None
    executive_summary: str
    chart_labels: list[str] = []
    chart_values: list[int] = []

@router.post("/generate", dependencies=[require_role("org_owner", "platform_admin")])
async def generate_report(payload: GenerateReportRequest, request: Request):
    if not HAS_REPORTING:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Reporting libraries not installed")

    report_id = f"report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.pdf"
    
    # 1. Generate Chart Image
    chart_buffer = BytesIO()
    if payload.chart_labels and payload.chart_values:
        plt.figure(figsize=(6, 4))
        plt.bar(payload.chart_labels, payload.chart_values, color=['#7c3aed', '#a78bfa', '#e879f9'])
        plt.title('Task Status Distribution')
        plt.tight_layout()
        plt.savefig(chart_buffer, format='png')
        plt.close()
    
    # 2. Generate PDF
    pdf_buffer = BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = []
    
    title = f"FlowForge Executive Report - {payload.project_name or 'Organization'}"
    story.append(Paragraph(title, styles['Title']))
    story.append(Spacer(1, 12))
    
    story.append(Paragraph(f"Generated on: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", styles['Normal']))
    story.append(Spacer(1, 24))
    
    story.append(Paragraph("Executive Summary", styles['Heading2']))
    story.append(Spacer(1, 12))
    
    # split summary into paragraphs
    for p in payload.executive_summary.split('\n'):
        if p.strip():
            story.append(Paragraph(p.strip(), styles['Normal']))
            story.append(Spacer(1, 12))
            
    if payload.chart_labels and payload.chart_values:
        story.append(Paragraph("Visual Metrics", styles['Heading2']))
        story.append(Spacer(1, 12))
        chart_buffer.seek(0)
        img = Image(chart_buffer, width=400, height=260)
        story.append(img)
        
    doc.build(story)
    pdf_bytes = pdf_buffer.getvalue()
    
    # 3. Upload to Azure or save locally
    if HAS_AZURE and AZURE_CONN_STR:
        try:
            blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONN_STR)
            container_client = blob_service_client.get_container_client(CONTAINER_NAME)
            if not container_client.exists():
                container_client.create_container()
            
            blob_client = container_client.get_blob_client(report_id)
            blob_client.upload_blob(pdf_bytes, overwrite=True)
            
            # Generate SAS token
            sas_token = generate_blob_sas(
                account_name=blob_service_client.account_name,
                container_name=CONTAINER_NAME,
                blob_name=report_id,
                account_key=blob_service_client.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + __import__('datetime').timedelta(hours=24)
            )
            url = f"{blob_client.url}?{sas_token}"
            return {"success": True, "report_id": report_id, "url": url, "storage": "azure"}
        except Exception as e:
            logger.error(f"Azure upload failed: {e}")
            # fallback to local
    
    # Local fallback
    local_path = os.path.join(LOCAL_REPORTS_DIR, report_id)
    with open(local_path, "wb") as f:
        f.write(pdf_bytes)
        
    base_url = "http://localhost:8000" if not os.getenv("DOCKER_ENV") else "http://gateway:8000"
    # Actually gateway routes /api/analytics/... so let's use the local API gateway route
    # Wait, the frontend calls the gateway on its base URL, so it can just use a relative path
    url = f"/api/analytics/reports/download/{report_id}"
    
    return {"success": True, "report_id": report_id, "url": url, "storage": "local"}

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
                        # SAS token
                        sas_token = generate_blob_sas(
                            account_name=blob_service_client.account_name,
                            container_name=CONTAINER_NAME,
                            blob_name=blob.name,
                            account_key=blob_service_client.credential.account_key,
                            permission=BlobSasPermissions(read=True),
                            expiry=datetime.utcnow() + __import__('datetime').timedelta(hours=24)
                        )
                        url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{CONTAINER_NAME}/{blob.name}?{sas_token}"
                        reports.append({
                            "id": blob.name,
                            "name": blob.name,
                            "created_at": blob.creation_time.isoformat() if blob.creation_time else datetime.utcnow().isoformat(),
                            "url": url,
                            "storage": "azure"
                        })
            return {"reports": sorted(reports, key=lambda x: x["created_at"], reverse=True)}
        except Exception as e:
            logger.error(f"Azure list blobs failed: {e}")
            # fallback
            pass
            
    # Local fallback
    for fname in os.listdir(LOCAL_REPORTS_DIR):
        if fname.endswith(".pdf"):
            path = os.path.join(LOCAL_REPORTS_DIR, fname)
            st = os.stat(path)
            reports.append({
                "id": fname,
                "name": fname,
                "created_at": datetime.fromtimestamp(st.st_mtime).isoformat() + "Z",
                "url": f"/api/analytics/reports/download/{fname}",
                "storage": "local"
            })
            
    return {"reports": sorted(reports, key=lambda x: x["created_at"], reverse=True)}


@router.get("/download/{report_id}", dependencies=[require_role("org_owner", "platform_admin")])
async def download_report(report_id: str):
    """Fallback endpoint for local storage downloads"""
    # prevent directory traversal
    safe_id = os.path.basename(report_id)
    local_path = os.path.join(LOCAL_REPORTS_DIR, safe_id)
    
    if not os.path.exists(local_path):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Report not found locally")
        
    return FileResponse(
        local_path, 
        media_type="application/pdf", 
        filename=safe_id,
        content_disposition_type="inline" # Allow viewing in browser
    )
