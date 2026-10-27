"""Startup migrations for existing tables (Day 7 A).

This project has no alembic history: ``Base.metadata.create_all`` creates
*missing* tables at boot, but it can never alter a table that already
exists. Every function here is idempotent so it can run on each startup
against both a legacy database and a freshly seeded one.
"""

from sqlalchemy import DateTime, text
from sqlalchemy.engine import Engine
from sqlalchemy.schema import CreateIndex, CreateTable

from app.db.models import User

# Pre-Day-7 schema: role was VARCHAR(5) (longest old name, "ADMIN").
_LEGACY_ROLE_TYPE = "VARCHAR(5)"


def _rebuild_users_table(conn, engine: Engine) -> None:
    """Widen ``users.role`` to fit TRAINEE/ENGINEER (SQLite: table rebuild).

    SQLite cannot alter a column in place, so the fresh DDL compiled from
    the current model is created as ``users_new``, the rows are copied
    across (mapping legacy ``user`` values on the way), and the old table is
    replaced. The rename targets the *new* table, so other tables'
    ``REFERENCES users(id)`` clauses are never rewritten. FK enforcement is
    off in this app (no ``PRAGMA foreign_keys`` anywhere), which is what
    makes dropping the parent table safe.
    """
    users = User.__table__
    create_sql = str(CreateTable(users).compile(engine)).strip().rstrip(";")
    conn.exec_driver_sql(
        create_sql.replace("CREATE TABLE users ", "CREATE TABLE users_new ", 1)
    )
    conn.execute(
        text(
            """
            INSERT INTO users_new (id, name, email, password_hash, role, created_at)
            SELECT id, name, email, password_hash,
                   CASE WHEN role IN ('USER', 'user') THEN 'TRAINEE'
                        ELSE role END,
                   created_at
            FROM users
            """
        )
    )
    conn.exec_driver_sql("DROP TABLE users")
    conn.exec_driver_sql("ALTER TABLE users_new RENAME TO users")
    for index in sorted(users.indexes, key=lambda i: i.name or ""):
        conn.exec_driver_sql(
            str(CreateIndex(index).compile(engine)).strip().rstrip(";")
        )


def migrate_user_roles(engine: Engine) -> None:
    """Day 7: legacy ``user`` rows become ``trainee``; widen a stale column.

    ``admin`` rows store ``ADMIN``, which is still a valid enum name, so
    they pass through untouched. The data update also runs right after a
    rebuild (harmless no-op there) so a single call covers every shape of
    database.
    """
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            row = conn.exec_driver_sql(
                "SELECT sql FROM sqlite_master "
                "WHERE type='table' AND name='users'"
            ).fetchone()
            if row is None:
                return  # table not created yet — create_all has not run
            table_info = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
            role_type = next(
                (col[2] for col in table_info if col[1] == "role"), ""
            )
            if role_type.upper() == _LEGACY_ROLE_TYPE:
                _rebuild_users_table(conn, engine)
        conn.execute(
            text(
                "UPDATE users SET role = 'TRAINEE' WHERE role IN ('USER', 'user')"
            )
        )


def migrate_auth_columns(engine: Engine) -> None:
    """Idempotent ALTERs for AUTH_TRD §4 user columns (added per build day).

    ``Base.metadata.create_all`` creates missing *tables* but never alters an
    existing one, so a deployment that predates Day 4 needs this at boot.
    New columns are nullable with no default, which is safe for both SQLite
    (``ADD COLUMN`` restrictions) and Postgres.
    """
    from sqlalchemy import inspect

    with engine.begin() as conn:
        inspector = inspect(conn)
        if "users" not in inspector.get_table_names():
            return  # table not created yet — create_all has not run
        existing = {c["name"] for c in inspector.get_columns("users")}
        # SQLite spells it DATETIME, Postgres TIMESTAMP — compile the type
        # through SQLAlchemy so the dialect decides.
        dt_type = str(DateTime().compile(dialect=engine.dialect))
        if "email_verified_at" not in existing:
            conn.execute(
                text(f"ALTER TABLE users ADD COLUMN email_verified_at {dt_type}")
            )
