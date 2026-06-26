from __future__ import annotations

import logging
from html import escape
from typing import Iterator

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db_session, init_db
from .models import BugReport
from .schemas import BugReportDetail, BugReportList, BugReportResponse
from .utils import extract_fields, parse_metadata, store_zip_file


logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title="Bug Reporter Backend", version="0.1.0")


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    logger.info("Database ready at %s", settings.database_url)


def get_db() -> Iterator[Session]:
    yield from get_db_session()


@app.post("/api/reports", response_model=BugReportDetail, status_code=status.HTTP_201_CREATED)
async def create_report(
    file: UploadFile = File(...),
    metadata: str = Form(...),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if authorization:
        logger.debug("Received Authorization header")

    metadata_obj = parse_metadata(metadata)

    stored_name = await store_zip_file(file)
    extracted = extract_fields(metadata_obj)

    report = BugReport(
        hostname=extracted["hostname"],
        url=extracted["url"],
        timestamp=extracted["timestamp"],
        user_agent=extracted.get("user_agent"),
        platform=extracted.get("platform"),
        zip_path=stored_name,
        metadata_json=metadata_obj,
        status="received",
    )

    db.add(report)
    db.commit()
    db.refresh(report)

    return BugReportDetail.from_orm(report)


@app.get("/api/reports", response_model=BugReportList)
def list_reports(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 100))
    skip = max(skip, 0)

    total = db.scalar(select(func.count()).select_from(BugReport)) or 0

    reports = (
        db.execute(
            select(BugReport)
            .order_by(BugReport.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    items = [BugReportResponse.from_orm(report) for report in reports]
    return BugReportList(items=items, total=total)


@app.get("/api/reports/{report_id}", response_model=BugReportDetail)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(BugReport, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    return BugReportDetail.from_orm(report)


@app.get("/api/reports/{report_id}/download")
def download_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(BugReport, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    file_path = settings.upload_dir / report.zip_path
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Archive missing on disk")

    return FileResponse(path=file_path, filename=file_path.name, media_type="application/zip")


@app.get("/", response_class=HTMLResponse)
def dashboard(db: Session = Depends(get_db)):
    reports = (
        db.execute(select(BugReport).order_by(BugReport.created_at.desc()).limit(50))
        .scalars()
        .all()
    )

    rows = []
    for report in reports:
        rows.append(
            "<tr>"
            f"<td>{report.id}</td>"
            f"<td>{escape(report.hostname)}</td>"
            f"<td>{escape(report.timestamp.isoformat())}</td>"
            f"<td><a href='/api/reports/{report.id}'>ver JSON</a></td>"
            f"<td><a href='/api/reports/{report.id}/download'>descargar ZIP</a></td>"
            "</tr>"
        )

    body = "".join(rows) or "<tr><td colspan='5'>Sin reportes</td></tr>"

    html = (
        "<!doctype html>"
        "<html><head><meta charset='utf-8'><title>Bug Reports</title>"
        "<style>body{font-family:sans-serif;margin:2rem;}table{border-collapse:collapse;width:100%;}"
        "th,td{border:1px solid #ccc;padding:0.5rem;text-align:left;}th{background:#f6f6f6;}"
        "</style></head><body>"
        "<h1>Bug Reports</h1>"
        "<table><thead><tr><th>ID</th><th>Hostname</th><th>Timestamp</th><th>Metadata</th><th>ZIP</th></tr></thead>"
        f"<tbody>{body}</tbody></table>"
        "</body></html>"
    )

    return HTMLResponse(content=html)
