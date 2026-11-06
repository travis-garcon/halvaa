"""Backfill saved memorial translations for existing rows.

Run inside the backend container:
    python -m scripts.backfill_memorial_translations
"""

from __future__ import annotations

import asyncio

from sqlmodel import Session, select

from app.core.database import engine
from app.models.memorial import Memorial
from app.services.translation import DEFAULT_TARGET_LOCALES, translate_memorial_layers


async def backfill() -> None:
    updated = 0
    with Session(engine) as session:
        memorials = session.exec(select(Memorial)).all()
        for memorial in memorials:
            result = await translate_memorial_layers(memorial, target_locales=DEFAULT_TARGET_LOCALES)
            if result.translations != (memorial.translations or {}) or result.status:
                memorial.translations = result.translations
                memorial.meta = {**(memorial.meta or {}), "translation_status": result.status}
                session.add(memorial)
                updated += 1
        session.commit()
    print(f"Backfilled translations for {updated} memorials.")


if __name__ == "__main__":
    asyncio.run(backfill())
