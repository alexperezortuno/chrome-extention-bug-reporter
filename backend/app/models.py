from __future__ import annotations

from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from .database import Base


class BugReport(Base):
    __tablename__ = "bug_reports"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(255), nullable=False, index=True)
    url = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    user_agent = Column(Text, nullable=True)
    platform = Column(String(100), nullable=True)
    zip_path = Column(String(512), nullable=False, unique=True)
    metadata_json = Column(JSON, nullable=False)
    status = Column(String(32), nullable=False, default="received")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
