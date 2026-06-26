from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from os import getenv
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str
    upload_dir: Path
    max_upload_bytes: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    base_dir = Path(__file__).resolve().parent.parent

    default_db_path = (base_dir / "bug_reports.db").resolve()
    database_url = getenv("DATABASE_URL", f"sqlite:///{default_db_path}")

    upload_env = getenv("UPLOAD_DIR")
    upload_dir = Path(upload_env).expanduser().resolve() if upload_env else (base_dir / "uploads").resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)

    max_upload_mb = int(getenv("MAX_UPLOAD_MB", "50"))
    max_upload_bytes = max_upload_mb * 1024 * 1024

    return Settings(
        database_url=database_url,
        upload_dir=upload_dir,
        max_upload_bytes=max_upload_bytes,
    )
