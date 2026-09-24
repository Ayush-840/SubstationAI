"""Seed the database: demo users, standards, catalog from data/catalog/*.yaml,
synonyms, sample documents and safety precautions."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal, engine, Base  # noqa: E402
from app.db import models  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.catalog.loader import load_catalog_to_db, register_sample_documents, validate_catalog  # noqa: E402
from app.db.models import User, UserRole  # noqa: E402


def seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Demo users (README credentials)
        demo_users = [
            ("Demo User", "demo@substationiq.dev", "demo1234", UserRole.USER),
            ("Demo Admin", "admin@substationiq.dev", "admin1234", UserRole.ADMIN),
        ]
        for name, email, password, role in demo_users:
            user = db.query(User).filter(User.email == email).first()
            if not user:
                db.add(User(
                    name=name,
                    email=email,
                    password_hash=get_password_hash(password),
                    role=role,
                ))
        db.commit()

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
        print(f"Seed complete: {equips} equipment classes, {tests} tests, {limits} limits")
        print("Users: demo@substationiq.dev / demo1234  |  admin@substationiq.dev / admin1234")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
