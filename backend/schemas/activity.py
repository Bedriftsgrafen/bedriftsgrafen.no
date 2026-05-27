"""Public activity and freshness response models."""

from datetime import date, datetime
from typing import Literal

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
