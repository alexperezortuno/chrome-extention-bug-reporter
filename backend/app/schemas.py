from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class BugReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hostname: str
    url: str
    timestamp: datetime
    status: str
    created_at: datetime


class BugReportList(BaseModel):
    items: List[BugReportResponse]
    total: int


class BugReportDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    hostname: str
    url: str
    timestamp: datetime
    user_agent: Optional[str]
    platform: Optional[str]
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="metadata_json")
    status: str
    created_at: datetime
