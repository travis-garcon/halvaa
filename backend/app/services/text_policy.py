import re
from difflib import SequenceMatcher
from typing import Iterable

from fastapi import HTTPException, status

BLOCKED_TERMS = {
    "spam",
    "scam",
    "porn",
    "terror",
    "isis",
}


def normalize_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value.casefold()).strip()
    return re.sub(r"[^\w\s\u0600-\u06ff\u4e00-\u9fff]", "", value)


def assert_acceptable_text(values: Iterable[str | None]) -> None:
    normalized = " ".join(normalize_text(value) for value in values if value)
    if not normalized:
        return
    if any(term in normalized for term in BLOCKED_TERMS):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Content did not pass the text policy")


def assert_not_duplicate_text(candidate: str, existing: Iterable[str], *, threshold: float = 0.92) -> None:
    normalized_candidate = normalize_text(candidate)
    if len(normalized_candidate) < 24:
        return
    for value in existing:
        normalized_existing = normalize_text(value)
        if not normalized_existing:
            continue
        if normalized_candidate == normalized_existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Repeated content already exists")
        if SequenceMatcher(None, normalized_candidate, normalized_existing).ratio() >= threshold:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Very similar content already exists")
