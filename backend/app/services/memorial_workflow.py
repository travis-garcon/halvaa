"""Memorial workflow with owner/admin visibility controls."""

from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.enums import MemorialStatus

ALLOWED_STATUS_TRANSITIONS: dict[MemorialStatus, frozenset[MemorialStatus]] = {
    MemorialStatus.DRAFT: frozenset({MemorialStatus.PENDING_APPROVAL, MemorialStatus.PUBLISHED, MemorialStatus.DEACTIVATED}),
    MemorialStatus.PENDING_APPROVAL: frozenset({MemorialStatus.PUBLISHED, MemorialStatus.DRAFT, MemorialStatus.DEACTIVATED}),
    MemorialStatus.PUBLISHED: frozenset({MemorialStatus.FEATURED, MemorialStatus.DEACTIVATED}),
    MemorialStatus.FEATURED: frozenset({MemorialStatus.DEACTIVATED}),
    MemorialStatus.DEACTIVATED: frozenset({MemorialStatus.DRAFT, MemorialStatus.PENDING_APPROVAL, MemorialStatus.PUBLISHED}),
}


def assert_valid_status_transition(current: MemorialStatus, target: MemorialStatus) -> None:
    if current == target:
        return
    allowed = ALLOWED_STATUS_TRANSITIONS.get(current, frozenset())
    if target not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid status transition from {current.value} to {target.value}. "
                f"Allowed next state: "
                f"{', '.join(s.value for s in sorted(allowed, key=lambda s: s.value)) or 'none (terminal)'}"
            ),
        )


def apply_status_transition(memorial, target: MemorialStatus) -> None:
    assert_valid_status_transition(memorial.status, target)
    if memorial.status == target:
        return

    memorial.status = target
    now = datetime.now(timezone.utc)
    if target == MemorialStatus.PUBLISHED:
        memorial.published_at = now
    elif target == MemorialStatus.FEATURED:
        if memorial.published_at is None:
            memorial.published_at = now
        memorial.featured_at = now
    elif target == MemorialStatus.DEACTIVATED:
        memorial.featured_at = None


def review_pending_memorial(memorial, decision: str) -> None:
    if memorial.status != MemorialStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only memorials pending approval can be reviewed",
        )

    if decision == "APPROVE":
        apply_status_transition(memorial, MemorialStatus.PUBLISHED)
        return

    if decision == "REQUEST_CHANGES":
        memorial.status = MemorialStatus.DRAFT
        return

    if decision == "FEATURE":
        apply_status_transition(memorial, MemorialStatus.PUBLISHED)
        apply_status_transition(memorial, MemorialStatus.FEATURED)
        return

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid review decision")
