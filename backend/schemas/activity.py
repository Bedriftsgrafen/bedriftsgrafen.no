"""Public activity and freshness response models."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

ActivityFeedId = Literal["new_companies", "bankruptcies"]
DeferredFeedId = Literal["accounting_updates"]


class ActivityCompanyItem(BaseModel):
    """Company row in an activity feed."""

    orgnr: str
    navn: str | None = None
    organisasjonsform: str | None = None
    naeringskode: str | None = None
    antall_ansatte: int | None = None
    event_date: date | None = None
    event_label: str
    source: str
    time_semantics: str

    model_config = ConfigDict(from_attributes=True)


class ActivityFeed(BaseModel):
    """A public feed with one clearly defined source timestamp."""

    id: ActivityFeedId
    title: str
    description: str
    source: str
    time_label: str
    items: list[ActivityCompanyItem]


class ActivityStatusItem(BaseModel):
    """Data freshness/status row backed by system_state."""

    key: str
    title: str
    description: str
    value: str | None = None
    updated_at: datetime | None = None
    source: str


class ActivityDeferredFeed(BaseModel):
    """A planned feed that is intentionally not exposed yet."""

    id: DeferredFeedId
    title: str
    reason: str
    requirement: str


class ActivityOverviewResponse(BaseModel):
    """Overview payload for the public updates hub."""

    generated_at: datetime
    cache_ttl_seconds: int
    new_companies: ActivityFeed
    bankruptcies: ActivityFeed
    data_status: list[ActivityStatusItem]
    deferred_feeds: list[ActivityDeferredFeed]


class CompanyEventItem(BaseModel):
    """A durable company event observed by Bedriftsgrafen."""

    id: int
    orgnr: str
    event_type: str
    title: str
    source: str
    source_update_id: str | None = None
    occurred_at: datetime | None = None
    observed_at: datetime
    time_semantics: str
    previous_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None
    payload: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)


class CompanyEventListResponse(BaseModel):
    """Paginated company event timeline."""

    generated_at: datetime
    cache_ttl_seconds: int
    orgnr: str
    limit: int
    offset: int
    has_more: bool
    events: list[CompanyEventItem]
