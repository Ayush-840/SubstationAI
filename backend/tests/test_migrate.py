"""Day 7 A — startup migration: legacy role values and column width."""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text  # noqa: E402

from app.db.migrate import migrate_user_roles  # noqa: E402
from app.db.models import Base  # noqa: E402

# The pre-Day-7 schema, exactly as create_all produced it.
LEGACY_USERS_DDL = """
CREATE TABLE users (
	id INTEGER NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	role VARCHAR(5) NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id)
)
"""


def _legacy_engine(tag: str):
    path = Path(tempfile.mkdtemp(prefix="siq_migrate_")) / f"{tag}.db"
    engine = create_engine(f"sqlite:///{path}")
    with engine.begin() as conn:
        conn.exec_driver_sql(LEGACY_USERS_DDL)
        conn.exec_driver_sql("CREATE INDEX ix_users_id ON users (id)")
        conn.exec_driver_sql("CREATE UNIQUE INDEX ix_users_email ON users (email)")
        conn.exec_driver_sql(
            "INSERT INTO users (name, email, password_hash, role, created_at) VALUES "
            "('Old User', 'user@legacy.dev', 'h', 'USER', '2026-01-01 00:00:00'), "
            "('Old Admin', 'admin@legacy.dev', 'h', 'ADMIN', '2026-01-01 00:00:00')"
        )
    return engine


def _roles(engine):
    with engine.connect() as conn:
        return dict(conn.execute(text("SELECT email, role FROM users")).all())


def _users_ddl(engine) -> str:
    with engine.connect() as conn:
        return conn.exec_driver_sql(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
        ).fetchone()[0]


def _user_indexes(engine) -> set[str]:
    with engine.connect() as conn:
        rows = conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users'"
        ).fetchall()
        return {r[0] for r in rows}


def test_migrate_maps_legacy_roles_and_widens_column():
    engine = _legacy_engine("roles")
    migrate_user_roles(engine)

    assert _roles(engine) == {
        "user@legacy.dev": "TRAINEE",
        "admin@legacy.dev": "ADMIN",
    }
    assert "VARCHAR(8)" in _users_ddl(engine)  # fits ENGINEER
    assert {"ix_users_id", "ix_users_email"} <= _user_indexes(engine)


def test_migrate_is_idempotent():
    engine = _legacy_engine("twice")
    migrate_user_roles(engine)
    migrate_user_roles(engine)

    assert _roles(engine) == {
        "user@legacy.dev": "TRAINEE",
        "admin@legacy.dev": "ADMIN",
    }
    assert "VARCHAR(8)" in _users_ddl(engine)
    assert {"ix_users_id", "ix_users_email"} <= _user_indexes(engine)


def test_migrate_leaves_fresh_schema_and_trainee_rows_alone():
    engine = create_engine(f"sqlite:///{Path(tempfile.mkdtemp(prefix='siq_fresh_'))}/fresh.db")
    Base.metadata.create_all(bind=engine)
    migrate_user_roles(engine)

    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO users (name, email, password_hash, role) "
                "VALUES ('Fresh', 'fresh@x.dev', 'h', 'TRAINEE')"
            )
        )
    migrate_user_roles(engine)

    with engine.connect() as conn:
        assert conn.execute(text("SELECT role FROM users")).scalar() == "TRAINEE"
    assert "VARCHAR(8)" in _users_ddl(engine)  # rebuild did not fire


def test_migrate_missing_users_table_is_a_noop():
    engine = create_engine(
        f"sqlite:///{Path(tempfile.mkdtemp(prefix='siq_nousers_'))}/none.db"
    )
    migrate_user_roles(engine)  # must not raise before create_all has run
