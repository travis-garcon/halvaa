import uuid
from datetime import date
from typing import TYPE_CHECKING, Any, Optional

from geoalchemy2 import Geography
from sqlalchemy import Column, Date, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import TimelineEventType

if TYPE_CHECKING:
    from app.models.media import MediaAsset
    from app.models.memorial import Memorial


class TimelineEventBase(SQLModel):
    event_type: TimelineEventType = Field(
        sa_column=Column(
            SAEnum(TimelineEventType, name="timeline_event_type", native_enum=False),
            nullable=False,
            index=True,
        ),
    )
    sort_order: int = Field(default=0, index=True)
    event_date: Optional[date] = Field(default=None, sa_column=Column(Date))


class TimelineEvent(UUIDPrimaryKeyMixin, TimestampMixin, TimelineEventBase, table=True):
    __tablename__ = "timeline_events"

    translations: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )
    location_point: Optional[Any] = Field(
        default=None,
        sa_column=Column(Geography(geometry_type="POINT", srid=4326), nullable=True),
    )

    memorial_id: uuid.UUID = Field(foreign_key="memorials.id", index=True, nullable=False)
    media_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="media_assets.id",
        index=True,
    )

    memorial: "Memorial" = Relationship(back_populates="timeline_events")
    media: Optional["MediaAsset"] = Relationship(back_populates="timeline_events")
