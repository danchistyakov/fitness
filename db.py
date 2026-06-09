"""
SQLAlchemy подключение и зависимости.
Поддерживает PostgreSQL (основной) и SQLite (для локальных тестов).
"""

import os
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/fitness"
)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


@contextmanager
def get_db():
    """Контекстный менеджер для ORM-сессий."""
    session = SessionLocal()
    try:
        if DATABASE_URL.startswith("sqlite"):
            session.execute(text("PRAGMA foreign_keys = ON"))
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
