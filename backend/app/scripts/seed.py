"""Seed the database: demo users, standards, catalog from data/catalog/*.yaml,
synonyms, sample documents and safety precautions."""

from datetime import datetime
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal, engine, Base  # noqa: E402
from app.db import models  # noqa: E402
import os  # noqa: E402

from sqlalchemy import func  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.catalog.loader import (
    load_catalog_to_db,
    register_sample_documents,
    validate_catalog,
)  # noqa: E402
from app.db.models import User, UserRole  # noqa: E402
from app.db.migrate import migrate_auth_columns, migrate_user_roles  # noqa: E402

# Demo users for local development and classroom demos. They are created only
# when SEED_DEMO_USERS=true (see core/config.py). The defaults below are public
# (they are in the README), so a deployment that enables demo users must
# override at least the admin password:
#   DEMO_PASSWORD_TRAINEE / DEMO_PASSWORD_ENGINEER / DEMO_PASSWORD_ADMIN
DEMO_USERS = [
    ("Demo User", "demo@substationiq.dev", "demo1234", UserRole.TRAINEE),
    ("Demo Engineer", "engineer@substationiq.dev", "engineer1234", UserRole.ENGINEER),
    ("Demo Admin", "admin@substationiq.dev", "admin1234", UserRole.ADMIN),
]


def ensure_demo_users(db) -> None:
    """Insert any missing demo account; never touches existing rows."""
    for name, email, default_password, role in DEMO_USERS:
        password = os.environ.get(f"DEMO_PASSWORD_{role.name}", default_password)
        user = db.query(User).filter(func.lower(User.email) == email).first()
        if not user:
            db.add(
                User(
                    name=name,
                    email=email,
                    password_hash=get_password_hash(password),
                    role=role,
                    # §10: demo accounts bypass e-mail verification (dev only;
                    # production refuses SEED_DEMO_USERS).
                    email_verified_at=datetime.utcnow(),
                )
            )
    db.commit()


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    migrate_user_roles(engine)
    migrate_auth_columns(engine)
    db = SessionLocal()
    try:
        if get_settings().SEED_DEMO_USERS:
            ensure_demo_users(db)
        else:
            print("Demo users skipped (set SEED_DEMO_USERS=true to create them).")

        # Catalog + synonyms + sample documents
        load_catalog_to_db(db)
        register_sample_documents(db)

        errors = validate_catalog(db)
        if errors:
            print("Validation warnings:")
            for e in errors:
                print(f"  - {e}")

        tests = db.query(models.Test).count()
        equips = db.query(models.EquipmentClass).count()
        limits = db.query(models.TestLimit).count()
        print(
            f"Seed complete: {equips} equipment classes, {tests} tests, {limits} limits"
        )
        if get_settings().SEED_DEMO_USERS:
            print("Demo users created (development only): demo@ / engineer@ / admin@substationiq.dev")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
