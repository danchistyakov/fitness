"""
SQLAlchemy подключение и зависимости.
Обеспечивает миграцию между SQLite и PostgreSQL без переписывания кода.
"""

import os
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{os.getenv('DATABASE', 'fitness_analytics.db')}"
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
    """Контекстный менеджер для raw-SQL совместимости."""
    session = SessionLocal()
    try:
        if DATABASE_URL.startswith("sqlite"):
            session.execute("PRAGMA foreign_keys = ON")
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
