"""
Fitness Analytics Information System - Backend API.

Информационная система для анализа персонализированных тренировочных программ
в фитнес-центрах. Реализована в соответствии с требованиями ВКР: 12 таблиц
предметной области, ролевая модель доступа (admin/trainer/client),
расширенная аналитическая подсистема — анализ выживаемости
(Каплан—Майер, регрессия Кокса), кластеризация k-средних с проекцией PCA,
сравнение программ методами проверки статистических гипотез.
"""

from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Optional, List
import hashlib
import math
import os
import random
import secrets
import sqlite3

from sqlalchemy import select, insert, update, delete, func, text
from sqlalchemy.orm import Session
from db import engine, SessionLocal
from fastapi import Depends, Header, HTTPException

import numpy as np

from models import (
    Client, Trainer, Exercise, TrainingProgram, ProgramExercise,
    TrainingSession, SessionExercise, ClientMetric, ClientGoal,
    Recommendation, User, TrainingCalendar
)

DATABASE = os.getenv("DATABASE", "fitness_analytics.db")

DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]


# ==================== Database ====================

@contextmanager
def get_db():
    """ORM-сессия для CRUD-операций."""
    session = SessionLocal()
    try:
        session.execute(text("PRAGMA foreign_keys = ON"))
        yield session
    finally:
        session.close()


@contextmanager
def get_db_raw():
    """Raw-SQL соединение для сложных аналитических запросов."""
    raw = engine.raw_connection()
    conn = raw.driver_connection
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        raw.close()


def init_db():
    """Создаёт схему из двенадцати таблиц предметной области через ORM."""
    from models import Base
    Base.metadata.create_all(bind=engine)


def orm_to_dict(obj) -> dict:
    if obj is None:
        return None
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


# ==================== Auth helpers ====================

active_tokens: dict = {}

PBKDF2_ITERATIONS = 200_000


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
    )
    return f"{salt}:{key.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, key_hex = stored.split(":", 1)
        key = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt.encode(), PBKDF2_ITERATIONS
        )
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


def seed_demo_users():
    demo = [
        ("admin",    "admin123",   "admin",   "Администратор системы", None, None),
        ("client1",  "client123",  "client",  "Клиент (демо)",         None, 1),
    ]
    with get_db() as session:
        for login, password, role, full_name, trainer_id, client_id in demo:
            existing = session.execute(select(User).where(User.login == login)).scalar_one_or_none()
            if existing:
                continue
            if trainer_id is not None and not session.execute(select(Trainer).where(Trainer.id == trainer_id)).scalar_one_or_none():
                trainer_id = None
            if client_id is not None and not session.execute(select(Client).where(Client.id == client_id)).scalar_one_or_none():
                client_id = None
            user = User(
                login=login,
                password_hash=_hash_password(password),
                role=role,
                full_name=full_name,
                trainer_id=trainer_id,
                client_id=client_id,
            )
            session.add(user)
        session.commit()


TRAINER_NAMES = [
    ("Иван Петров", "Силовой фитнес", 5),
    ("Анна Смирнова", "Йога и пилатес", 7),
    ("Дмитрий Козлов", "Кроссфит", 4),
    ("Елена Васильева", "Кардиотренировки", 6),
    ("Максим Соколов", "Бодибилдинг", 8),
    ("Ольга Новикова", "Функциональный тренинг", 3),
    ("Алексей Морозов", "Реабилитация", 10),
    ("Мария Попова", "Танцевальный фитнес", 4),
    ("Сергей Лебедев", "Бокс и ММА", 6),
    ("Наталья Кузнецова", "Растяжка", 5),
]


def seed_demo_trainers():
    with get_db() as session:
        for i, (name, spec, exp) in enumerate(TRAINER_NAMES, start=1):
            existing = session.execute(select(Trainer).where(Trainer.name == name)).scalar_one_or_none()
            if existing:
                trainer = existing
            else:
                trainer = Trainer(name=name, specialization=spec, experience_years=exp)
                session.add(trainer)
                session.flush()
            login = f"trainer{i:02d}"
            existing_user = session.execute(select(User).where(User.login == login)).scalar_one_or_none()
            if not existing_user:
                user = User(
                    login=login,
                    password_hash=_hash_password(f"trainer{i:02d}"),
                    role="trainer",
                    full_name=name,
                    trainer_id=trainer.id,
                )
                session.add(user)
        session.commit()


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    token = authorization.removeprefix("Bearer ").strip()
    user = active_tokens.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Токен недействителен или истёк")
    return user


def require_roles(*roles: str):
    def _checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user
    return _checker


def _check_trainer_owns_client(session: Session, trainer_id: Optional[int], client_id: int) -> bool:
    if not trainer_id:
        return False
    client = session.execute(select(Client).where(Client.id == client_id)).scalar_one_or_none()
    return client is not None and client.trainer_id == trainer_id


def _check_trainer_owns_program(session: Session, trainer_id: Optional[int], program_id: int) -> bool:
    if not trainer_id:
        return False
    program = session.execute(select(TrainingProgram).where(TrainingProgram.id == program_id)).scalar_one_or_none()
    if not program:
        return False
    return _check_trainer_owns_client(session, trainer_id, program.client_id)


def _check_trainer_owns_session(session: Session, trainer_id: Optional[int], session_id: int) -> bool:
    if not trainer_id:
        return False
    sess = session.execute(select(TrainingSession).where(TrainingSession.id == session_id)).scalar_one_or_none()
    if not sess:
        return False
    return _check_trainer_owns_client(session, trainer_id, sess.client_id)


def _check_trainer_owns_client_raw(conn, trainer_id: Optional[int], client_id: int) -> bool:
    if not trainer_id:
        return False
    row = conn.execute("SELECT trainer_id FROM clients WHERE id = ?", (client_id,)).fetchone()
    return row is not None and row["trainer_id"] == trainer_id



