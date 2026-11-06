import sys
from collections.abc import Generator
from pathlib import Path

import pytest
from sqlalchemy import inspect, text
from sqlalchemy import event
from sqlmodel import Session

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(autouse=True)
def isolate_api_limits(monkeypatch):
    from app.api.routes import memorials as memorial_routes
    from app.core.limiter import limiter

    monkeypatch.setattr(memorial_routes, "has_memorial_slot", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(memorial_routes, "has_custom_id_slot", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(memorial_routes, "consume_custom_id_slot", lambda *_args, **_kwargs: None)
    previous_enabled = limiter.enabled
    limiter.enabled = False
    try:
        yield
    finally:
        limiter.enabled = previous_enabled


@pytest.fixture
def engine():
    from app.core.database import engine as app_engine
    from app.models.review_event import ReviewEvent

    ReviewEvent.__table__.create(bind=app_engine, checkfirst=True)
    with app_engine.begin() as connection:
        columns = {column["name"] for column in inspect(connection).get_columns("guestbook_entries")}
        if "tribute_type" not in columns:
            connection.execute(text("ALTER TABLE guestbook_entries ADD COLUMN tribute_type VARCHAR(32) NOT NULL DEFAULT 'MESSAGE'"))
        if "relationship_label" not in columns:
            connection.execute(text("ALTER TABLE guestbook_entries ADD COLUMN relationship_label VARCHAR(120)"))
        media_columns = {column["name"] for column in inspect(connection).get_columns("media_assets")}
        if "title" not in media_columns:
            connection.execute(text("ALTER TABLE media_assets ADD COLUMN title VARCHAR(255)"))
        if "description" not in media_columns:
            connection.execute(text("ALTER TABLE media_assets ADD COLUMN description VARCHAR(1000)"))
        memorial_columns = {column["name"] for column in inspect(connection).get_columns("memorials")}
        if "family_tree" not in memorial_columns:
            connection.execute(text("ALTER TABLE memorials ADD COLUMN family_tree JSONB NOT NULL DEFAULT '[]'::jsonb"))
        if "burial_site_name" not in memorial_columns:
            connection.execute(text("ALTER TABLE memorials ADD COLUMN burial_site_name VARCHAR(255)"))
        if "burial_plot_name" not in memorial_columns:
            connection.execute(text("ALTER TABLE memorials ADD COLUMN burial_plot_name VARCHAR(255)"))
        if "view_count" not in memorial_columns:
            connection.execute(text("ALTER TABLE memorials ADD COLUMN view_count BIGINT NOT NULL DEFAULT 0"))
        user_columns = {column["name"] for column in inspect(connection).get_columns("users")}
        if "address" not in user_columns:
            connection.execute(text("ALTER TABLE users ADD COLUMN address VARCHAR(512)"))

    yield app_engine


@pytest.fixture
def db_session(engine) -> Generator[Session, None, None]:
    """Transactional session that rolls back after each test.

    Uses nested savepoints so route handlers that call session.commit() do not
    persist data outside the test.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(sess: Session, trans) -> None:
        if trans.nested and not trans._parent.nested:
            sess.connection().begin_nested()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def test_user(db_session: Session):
    from app.core.auth import hash_password
    from app.models.user import User

    user = User(
        email="test-fixture@example.com",
        full_name="Test Fixture User",
        hashed_password=hash_password("testpass123"),
        phone_number="+15555550100",
        address="100 Test Street, Test City",
    )
    db_session.add(user)
    db_session.flush()
    return user


@pytest.fixture
def test_memorial(db_session: Session, test_user):
    from geoalchemy2.elements import WKTElement
    from app.models.collaborator import MemorialCollaborator
    from app.models.enums import CollaboratorRole, MemorialStatus
    from app.models.memorial import Memorial

    memorial = Memorial(
        public_id="integration-test-memorial",
        slug="integration-test-memorial",
        status=MemorialStatus.PUBLISHED,
        created_by_id=test_user.id,
        burial_site_name="Integration Peace Garden",
        burial_plot_name="Row 7 / Plot 3",
        burial_location=WKTElement("POINT(-71.0589 42.3601)", srid=4326),
        translations={"en": {"name": "Integration Test Memorial"}},
    )
    db_session.add(memorial)
    db_session.flush()
    db_session.add(
        MemorialCollaborator(
            memorial_id=memorial.id,
            user_id=test_user.id,
            role=CollaboratorRole.OWNER,
        )
    )
    db_session.flush()
    return memorial
