import re
from typing import Annotated

from pydantic import AfterValidator, Field

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def sanitize_text(value: str) -> str:
    cleaned = _CONTROL_CHARS_RE.sub("", value)
    cleaned = _HTML_TAG_RE.sub("", cleaned)
    return cleaned.strip()


def validate_slug(value: str) -> str:
    slug = value.strip().lower()
    if not _SLUG_RE.fullmatch(slug):
        raise ValueError("Slug must be lowercase alphanumeric segments separated by hyphens")
    return slug


SanitizedStr = Annotated[str, AfterValidator(sanitize_text)]
SlugStr = Annotated[str, AfterValidator(validate_slug)]
Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
