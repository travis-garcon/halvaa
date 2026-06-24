import uuid

import pytest
from fastapi import HTTPException

from app.models.enums import CollaboratorRole
from app.services.permissions import ROLE_RANK


class TestRBAC:
    def test_role_rank_ordering(self) -> None:
        assert ROLE_RANK[CollaboratorRole.VIEWER] < ROLE_RANK[CollaboratorRole.EDITOR]
        assert ROLE_RANK[CollaboratorRole.EDITOR] < ROLE_RANK[CollaboratorRole.OWNER]

    def test_bola_returns_404_not_403_for_missing_memorial(self) -> None:
        from unittest.mock import MagicMock

        from app.services.permissions import get_memorial_or_404

        session = MagicMock()
        session.get.return_value = None

        with pytest.raises(HTTPException) as exc:
            get_memorial_or_404(session, uuid.uuid4())
        assert exc.value.status_code == 404
