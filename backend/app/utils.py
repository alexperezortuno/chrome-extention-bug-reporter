from __future__ import annotations

import json
from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict
from urllib.parse import urlparse
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from fastapi import HTTPException, UploadFile
from starlette import status

from .config import get_settings


settings = get_settings()


def parse_metadata(raw: str) -> Dict[str, Any]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid metadata JSON") from exc

    if not isinstance(data, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Metadata payload must be JSON object")

    return data


def normalize_timestamp(metadata: Dict[str, Any]) -> datetime:
    raw_ts = metadata.get("timestamp")
    if not raw_ts:
        return datetime.now(timezone.utc)

    try:
        if isinstance(raw_ts, (int, float)):
            return datetime.fromtimestamp(raw_ts, tz=timezone.utc)

        if isinstance(raw_ts, str) and raw_ts.endswith("Z"):
            raw_ts = raw_ts.replace("Z", "+00:00")

        return datetime.fromisoformat(raw_ts)
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)


async def store_zip_file(upload_file: UploadFile) -> str:
    content = await upload_file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty ZIP payload")

    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Report exceeds configured limit")

    try:
        with ZipFile(BytesIO(content)) as archive:
            archive.infolist()
    except BadZipFile as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must be valid ZIP") from exc

    target_name = f"{uuid4().hex}.zip"
    target_path = settings.upload_dir / target_name
    with target_path.open("wb") as fh:
        fh.write(content)

    return target_name


def extract_fields(metadata: Dict[str, Any]) -> Dict[str, Any]:
    url = metadata.get("url") or ""
    hostname = metadata.get("hostname") or urlparse(url).hostname or "unknown-host"

    return {
        "hostname": hostname,
        "url": url,
        "timestamp": normalize_timestamp(metadata),
        "user_agent": metadata.get("userAgent"),
        "platform": metadata.get("platform"),
    }
