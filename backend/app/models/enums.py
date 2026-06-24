import enum


class MemorialStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    PUBLISHED = "PUBLISHED"
    FEATURED = "FEATURED"


class CollaboratorRole(str, enum.Enum):
    OWNER = "OWNER"
    EDITOR = "EDITOR"
    VIEWER = "VIEWER"


class TimelineEventType(str, enum.Enum):
    BIOGRAPHY = "BIOGRAPHY"
    LIFE_EVENT = "LIFE_EVENT"
    LOCATION = "LOCATION"


class GuestbookStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class MediaType(str, enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    DOCUMENT = "DOCUMENT"


class MediaCategory(str, enum.Enum):
    GALLERY = "GALLERY"
    TIMELINE = "TIMELINE"
    DOCUMENT = "DOCUMENT"
    WILL = "WILL"
    AVATAR = "AVATAR"


class MediaProcessingStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
