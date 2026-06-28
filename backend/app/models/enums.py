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


class UserRole(str, enum.Enum):
    USER = "USER"
    ADMIN = "ADMIN"


class StoreItemKind(str, enum.Enum):
    CUSTOM_MEMORIAL_ID = "CUSTOM_MEMORIAL_ID"
    FEATURED_PLACEMENT = "FEATURED_PLACEMENT"
    EXTRA_MEMORIAL_SLOT = "EXTRA_MEMORIAL_SLOT"
    THEME_PACK = "THEME_PACK"


class PurchaseStatus(str, enum.Enum):
    PENDING = "PENDING"
    PAID = "PAID"
    ASSIGNED = "ASSIGNED"
    CANCELED = "CANCELED"


class PaymentProvider(str, enum.Enum):
    STRIPE = "STRIPE"
    ZARINPAL = "ZARINPAL"
