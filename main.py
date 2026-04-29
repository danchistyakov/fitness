"""
Fitness Analytics Information System - Backend API.

Информационная система для анализа персонализированных тренировочных программ
в фитнес-центрах. Реализована в соответствии с требованиями ВКР: 12 таблиц
предметной области, ролевая модель доступа (admin/trainer/client),
журнал аудита, расширенная аналитическая подсистема — анализ выживаемости
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

from sqlalchemy import text
from db import engine
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import numpy as np

app = FastAPI(
    title="Fitness Analytics API",
    description="Система анализа персонализированных тренировочных программ",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE = os.getenv("DATABASE", "fitness_analytics.db")

DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]


# ==================== Database ====================

@contextmanager
def get_db():
    raw = engine.raw_connection()
    conn = raw.driver_connection
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        raw.close()


def init_db():
    """Создаёт схему из двенадцати таблиц предметной области."""
    with get_db() as conn:
        c = conn.cursor()

        # 1. clients — профили клиентов
        c.execute("""
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                birth_date DATE,
                gender TEXT,
                registration_date DATE DEFAULT CURRENT_DATE,
                subscription_type TEXT DEFAULT 'basic',
                subscription_start_date DATE,
                fitness_goal TEXT,
                fitness_level TEXT DEFAULT 'beginner',
                health_notes TEXT,
                contraindications TEXT,
                is_active INTEGER DEFAULT 1
            )
        """)

        # 2. trainers — профили тренеров
        c.execute("""
            CREATE TABLE IF NOT EXISTS trainers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                specialization TEXT,
                experience_years INTEGER,
                rating REAL DEFAULT 4.5,
                is_active INTEGER DEFAULT 1
            )
        """)

        # 3. training_programs — назначенные клиентам программы
        c.execute("""
            CREATE TABLE IF NOT EXISTS training_programs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                trainer_id INTEGER,
                name TEXT NOT NULL,
                description TEXT,
                goal TEXT,
                duration_weeks INTEGER DEFAULT 12,
                sessions_per_week INTEGER DEFAULT 3,
                difficulty_level TEXT DEFAULT 'medium',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (client_id) REFERENCES clients(id),
                FOREIGN KEY (trainer_id) REFERENCES trainers(id)
            )
        """)

        # 4. exercises — каталог упражнений
        c.execute("""
            CREATE TABLE IF NOT EXISTS exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                muscle_group TEXT,
                equipment TEXT,
                difficulty TEXT,
                calories_per_minute REAL,
                description TEXT
            )
        """)

        # 5. program_exercises — упражнения в программе (план)
        c.execute("""
            CREATE TABLE IF NOT EXISTS program_exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                program_id INTEGER NOT NULL,
                exercise_id INTEGER NOT NULL,
                sets INTEGER DEFAULT 3,
                reps INTEGER DEFAULT 12,
                weight REAL,
                rest_seconds INTEGER DEFAULT 60,
                day_of_week INTEGER,
                order_number INTEGER,
                methodical_note TEXT,
                FOREIGN KEY (program_id) REFERENCES training_programs(id),
                FOREIGN KEY (exercise_id) REFERENCES exercises(id)
            )
        """)

        # 6. training_sessions — журнал фактически проведённых тренировок
        c.execute("""
            CREATE TABLE IF NOT EXISTS training_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                program_id INTEGER,
                trainer_id INTEGER,
                session_date DATE NOT NULL,
                start_time TIME,
                duration_minutes INTEGER,
                calories_burned INTEGER,
                avg_heart_rate INTEGER,
                fatigue_level INTEGER,
                satisfaction_rating INTEGER,
                comment TEXT,
                FOREIGN KEY (client_id) REFERENCES clients(id),
                FOREIGN KEY (program_id) REFERENCES training_programs(id),
                FOREIGN KEY (trainer_id) REFERENCES trainers(id)
            )
        """)

        # 7. session_exercises — фактически выполненные упражнения
        c.execute("""
            CREATE TABLE IF NOT EXISTS session_exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                exercise_id INTEGER NOT NULL,
                program_exercise_id INTEGER,
                actual_sets INTEGER,
                actual_reps INTEGER,
                actual_weight REAL,
                actual_duration_seconds INTEGER,
                rpe INTEGER,
                FOREIGN KEY (session_id) REFERENCES training_sessions(id),
                FOREIGN KEY (exercise_id) REFERENCES exercises(id),
                FOREIGN KEY (program_exercise_id) REFERENCES program_exercises(id)
            )
        """)

        # 8. client_metrics — антропометрические и функциональные замеры
        c.execute("""
            CREATE TABLE IF NOT EXISTS client_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                measurement_date DATE NOT NULL,
                weight REAL,
                body_fat_percentage REAL,
                muscle_mass REAL,
                chest_cm REAL,
                waist_cm REAL,
                hips_cm REAL,
                biceps_cm REAL,
                thighs_cm REAL,
                resting_heart_rate INTEGER,
                max_pushups INTEGER,
                max_pullups INTEGER,
                plank_seconds INTEGER,
                run_5km_minutes REAL,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        """)

        # 9. client_goals — целевые показатели клиентов
        c.execute("""
            CREATE TABLE IF NOT EXISTS client_goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                metric TEXT NOT NULL,
                target_value REAL,
                target_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                achieved_at TIMESTAMP,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        """)

        # 10. recommendations — управленческие рекомендации
        c.execute("""
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER,
                recommendation_type TEXT,
                title TEXT,
                description TEXT,
                priority INTEGER DEFAULT 5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_applied INTEGER DEFAULT 0,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        """)

        # 11. users — учётные записи (роль и связь с профилем)
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'client',
                full_name TEXT NOT NULL,
                trainer_id INTEGER,
                client_id INTEGER,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trainer_id) REFERENCES trainers(id),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        """)

        # 12. audit_log — журнал действий пользователей
        c.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                entity_type TEXT,
                entity_id INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # Миграции: добавление полей, отсутствующих в первоначальной схеме
        _add_column_if_not_exists(c, "clients", "height", "REAL")
        _add_column_if_not_exists(c, "clients", "trainer_id", "INTEGER")
        _add_column_if_not_exists(c, "exercises", "secondary_muscle_groups", "TEXT")
        _add_column_if_not_exists(c, "exercises", "load_type", "TEXT")
        _add_column_if_not_exists(c, "training_programs", "start_date", "DATE")
        _add_column_if_not_exists(c, "session_exercises", "calories_burned", "INTEGER")

        c.execute("""
            CREATE TABLE IF NOT EXISTS training_calendar (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                program_id INTEGER NOT NULL,
                planned_date DATE NOT NULL,
                day_of_week INTEGER,
                status TEXT DEFAULT 'planned',
                FOREIGN KEY (program_id) REFERENCES training_programs(id)
            )
        """)

        conn.commit()


def _add_column_if_not_exists(cursor, table, column, col_type):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
    except sqlite3.OperationalError:
        pass  # колонка уже существует


# ==================== Auth helpers ====================

# token -> user dict
active_tokens: dict = {}

# Параметры PBKDF2-SHA256, заданные в нефункциональных требованиях ВКР.
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
    """Создаёт демо-пользователей. trainer_id / client_id устанавливаются
    только если соответствующая запись уже существует — иначе вставка
    нарушила бы внешний ключ при пустой БД."""
    demo = [
        ("admin",    "admin123",   "admin",   "Администратор системы", None, None),
        ("client1",  "client123",  "client",  "Клиент (демо)",         None, 1),
    ]
    with get_db() as conn:
        for login, password, role, full_name, trainer_id, client_id in demo:
            if conn.execute(
                "SELECT id FROM users WHERE login = ?", (login,)
            ).fetchone():
                continue
            if trainer_id is not None and not conn.execute(
                "SELECT id FROM trainers WHERE id = ?", (trainer_id,)
            ).fetchone():
                trainer_id = None
            if client_id is not None and not conn.execute(
                "SELECT id FROM clients WHERE id = ?", (client_id,)
            ).fetchone():
                client_id = None
            conn.execute(
                "INSERT INTO users (login, password_hash, role, full_name,"
                " trainer_id, client_id) VALUES (?, ?, ?, ?, ?, ?)",
                (login, _hash_password(password), role, full_name,
                 trainer_id, client_id),
            )
        conn.commit()


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
    """Создаёт 10 демо-тренеров и учётные записи с персональными логинами."""
    with get_db() as conn:
        for i, (name, spec, exp) in enumerate(TRAINER_NAMES, start=1):
            # Создаём тренера, если ещё нет
            existing_trainer = conn.execute(
                "SELECT id FROM trainers WHERE name = ?", (name,)
            ).fetchone()
            if existing_trainer:
                trainer_id = existing_trainer["id"]
            else:
                cur = conn.execute(
                    "INSERT INTO trainers (name, specialization, experience_years)"
                    " VALUES (?, ?, ?)",
                    (name, spec, exp),
                )
                trainer_id = cur.lastrowid

            login = f"trainer{i:02d}"
            # Создаём учётную запись, если логин свободен
            if not conn.execute(
                "SELECT id FROM users WHERE login = ?", (login,)
            ).fetchone():
                conn.execute(
                    "INSERT INTO users (login, password_hash, role, full_name, trainer_id)"
                    " VALUES (?, ?, ?, ?, ?)",
                    (login, _hash_password(f"trainer{i:02d}"), "trainer", name, trainer_id),
                )
        conn.commit()


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    token = authorization.removeprefix("Bearer ").strip()
    user = active_tokens.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Токен недействителен или истёк")
    return user


def require_roles(*roles: str):
    """Зависимость FastAPI: разрешает доступ только указанным ролям."""
    def _checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        return user
    return _checker


def write_audit(user_id: Optional[int], action: str,
                entity_type: Optional[str] = None,
                entity_id: Optional[int] = None,
                ip: Optional[str] = None):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address)"
            " VALUES (?, ?, ?, ?, ?)",
            (user_id, action, entity_type, entity_id, ip),
        )
        conn.commit()


# ==================== Pydantic Models ====================

class ClientCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    subscription_type: str = "basic"
    subscription_start_date: Optional[str] = None
    fitness_goal: Optional[str] = None
    fitness_level: str = "beginner"
    health_notes: Optional[str] = None
    contraindications: Optional[str] = None
    height: Optional[float] = None
    trainer_id: Optional[int] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    subscription_type: Optional[str] = None
    fitness_goal: Optional[str] = None
    fitness_level: Optional[str] = None
    health_notes: Optional[str] = None
    contraindications: Optional[str] = None
    is_active: Optional[int] = None
    height: Optional[float] = None
    trainer_id: Optional[int] = None


class TrainerCreate(BaseModel):
    name: str
    specialization: Optional[str] = None
    experience_years: Optional[int] = None


class TrainingProgramCreate(BaseModel):
    client_id: int
    trainer_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: int = 12
    sessions_per_week: int = 3
    difficulty_level: str = "medium"
    start_date: Optional[str] = None


class TrainingProgramUpdate(BaseModel):
    name: Optional[str] = None
    trainer_id: Optional[int] = None
    description: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: Optional[int] = None
    sessions_per_week: Optional[int] = None
    difficulty_level: Optional[str] = None
    start_date: Optional[str] = None
    is_active: Optional[int] = None


class ProgramExerciseCreate(BaseModel):
    program_id: int
    exercise_id: int
    sets: int = 3
    reps: int = 12
    weight: Optional[float] = None
    rest_seconds: int = 60
    day_of_week: Optional[int] = None
    order_number: Optional[int] = None
    methodical_note: Optional[str] = None


class ExerciseCreate(BaseModel):
    name: str
    muscle_group: Optional[str] = None
    secondary_muscle_groups: Optional[str] = None
    equipment: Optional[str] = None
    difficulty: Optional[str] = None
    load_type: Optional[str] = None
    calories_per_minute: Optional[float] = None
    description: Optional[str] = None


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    muscle_group: Optional[str] = None
    secondary_muscle_groups: Optional[str] = None
    equipment: Optional[str] = None
    difficulty: Optional[str] = None
    load_type: Optional[str] = None
    calories_per_minute: Optional[float] = None
    description: Optional[str] = None


class TrainingSessionCreate(BaseModel):
    client_id: int
    program_id: Optional[int] = None
    trainer_id: Optional[int] = None
    session_date: str
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    calories_burned: Optional[int] = None
    fatigue_level: Optional[int] = None
    satisfaction_rating: Optional[int] = None
    comment: Optional[str] = None


class SessionExerciseCreate(BaseModel):
    session_id: int
    exercise_id: int
    program_exercise_id: Optional[int] = None
    actual_sets: Optional[int] = None
    actual_reps: Optional[int] = None
    actual_weight: Optional[float] = None
    actual_duration_seconds: Optional[int] = None
    rpe: Optional[int] = None
    calories_burned: Optional[int] = None


class ClientMetricsCreate(BaseModel):
    client_id: int
    measurement_date: str
    weight: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    muscle_mass: Optional[float] = None
    chest_cm: Optional[float] = None
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    biceps_cm: Optional[float] = None
    thighs_cm: Optional[float] = None
    resting_heart_rate: Optional[int] = None
    max_pushups: Optional[int] = None
    max_pullups: Optional[int] = None
    plank_seconds: Optional[int] = None
    run_5km_minutes: Optional[float] = None


class ClientGoalCreate(BaseModel):
    client_id: int
    metric: str
    target_value: Optional[float] = None
    target_date: Optional[str] = None


class LoginRequest(BaseModel):
    login: str
    password: str


class UserCreate(BaseModel):
    login: str
    password: str
    role: str = "client"
    full_name: str
    trainer_id: Optional[int] = None
    client_id: Optional[int] = None


class UserUpdate(BaseModel):
    role: Optional[str] = None
    full_name: Optional[str] = None
    trainer_id: Optional[int] = None
    client_id: Optional[int] = None
    is_active: Optional[int] = None


class AssignTrainerRequest(BaseModel):
    trainer_id: int


class CalendarGenerateRequest(BaseModel):
    program_id: int


# ==================== Startup ====================

@app.on_event("startup")
async def startup():
    init_db()
    seed_demo_users()
    seed_demo_trainers()


# ==================== Auth ====================

@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, login, password_hash, role, full_name, trainer_id, client_id"
            " FROM users WHERE login = ? AND is_active = 1",
            (body.login,),
        ).fetchone()
    if not row or not _verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = secrets.token_hex(32)
    user_info = {
        "id": row["id"],
        "login": row["login"],
        "role": row["role"],
        "full_name": row["full_name"],
        "trainer_id": row["trainer_id"],
        "client_id": row["client_id"],
    }
    active_tokens[token] = user_info
    write_audit(row["id"], "login", "users", row["id"],
                request.client.host if request.client else None)
    return {"token": token, "user": user_info}


@app.get("/api/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        user = active_tokens.pop(token, None)
        if user:
            write_audit(user["id"], "logout", "users", user["id"])
    return {"ok": True}


# ==================== Clients ====================

@app.get("/api/clients")
async def get_clients(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[int] = None,
    subscription_type: Optional[str] = None,
    fitness_goal: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        query = "SELECT * FROM clients WHERE 1=1"
        params: list = []

        # Клиент видит только свой профиль.
        if user["role"] == "client":
            if not user.get("client_id"):
                return {"clients": [], "total": 0}
            query += " AND id = ?"
            params.append(user["client_id"])

        # Тренер видит только своих клиентов.
        if user["role"] == "trainer":
            if not user.get("trainer_id"):
                return {"clients": [], "total": 0}
            query += " AND trainer_id = ?"
            params.append(user["trainer_id"])

        if is_active is not None:
            query += " AND is_active = ?"
            params.append(is_active)
        if subscription_type:
            query += " AND subscription_type = ?"
            params.append(subscription_type)
        if fitness_goal:
            query += " AND fitness_goal = ?"
            params.append(fitness_goal)
        if search:
            query += " AND (name LIKE ? OR email LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])

        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, skip])

        rows = conn.execute(query, params).fetchall()
        clients = [dict(r) for r in rows]
        total = conn.execute("SELECT COUNT(*) FROM clients").fetchone()[0]
        return {"clients": clients, "total": total}


@app.get("/api/clients/{client_id}")
async def get_client(client_id: int, user: dict = Depends(get_current_user)):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as conn:
        row = conn.execute("SELECT * FROM clients WHERE id = ?", (client_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Client not found")
        return dict(row)


@app.post("/api/clients")
async def create_client(
    client: ClientCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as conn:
        try:
            cur = conn.execute(
                """
                INSERT INTO clients (name, email, phone, birth_date, gender,
                    subscription_type, subscription_start_date, fitness_goal,
                    fitness_level, health_notes, contraindications, height, trainer_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (client.name, client.email, client.phone, client.birth_date,
                 client.gender, client.subscription_type,
                 client.subscription_start_date, client.fitness_goal,
                 client.fitness_level, client.health_notes,
                 client.contraindications, client.height, client.trainer_id),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Email already exists")
    write_audit(user["id"], "create", "clients", cur.lastrowid)
    return {"id": cur.lastrowid, "message": "Client created"}


@app.put("/api/clients/{client_id}")
async def update_client(
    client_id: int,
    client: ClientUpdate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    fields = client.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as conn:
        sets = ", ".join(f"{k} = ?" for k in fields)
        params = list(fields.values()) + [client_id]
        conn.execute(f"UPDATE clients SET {sets} WHERE id = ?", params)
        conn.commit()
    write_audit(user["id"], "update", "clients", client_id)
    return {"message": "Client updated"}


@app.post("/api/clients/{client_id}/assign-trainer")
async def assign_trainer_to_client(
    client_id: int,
    body: AssignTrainerRequest,
    user: dict = Depends(require_roles("admin")),
):
    """Назначение клиента конкретному тренеру."""
    with get_db() as conn:
        row = conn.execute("SELECT id FROM trainers WHERE id = ? AND is_active = 1",
                           (body.trainer_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Trainer not found")
        conn.execute("UPDATE clients SET trainer_id = ? WHERE id = ?",
                     (body.trainer_id, client_id))
        conn.commit()
    write_audit(user["id"], "assign_trainer", "clients", client_id)
    return {"message": "Trainer assigned"}


@app.delete("/api/clients/{client_id}")
async def delete_client(
    client_id: int,
    user: dict = Depends(require_roles("admin")),
):
    """Мягкое удаление: история клиента остаётся для аналитики."""
    with get_db() as conn:
        conn.execute("UPDATE clients SET is_active = 0 WHERE id = ?", (client_id,))
        conn.commit()
    write_audit(user["id"], "soft_delete", "clients", client_id)
    return {"message": "Client deactivated"}


# ==================== Trainers ====================

@app.get("/api/trainers")
async def get_trainers(user: dict = Depends(get_current_user)):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM trainers WHERE is_active = 1 ORDER BY rating DESC"
        ).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/trainers")
async def create_trainer(
    trainer: TrainerCreate,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO trainers (name, specialization, experience_years)"
            " VALUES (?, ?, ?)",
            (trainer.name, trainer.specialization, trainer.experience_years),
        )
        conn.commit()
    write_audit(user["id"], "create", "trainers", cur.lastrowid)
    return {"id": cur.lastrowid, "message": "Trainer created"}


# ==================== Exercises ====================

@app.get("/api/exercises")
async def get_exercises(
    muscle_group: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        q = "SELECT * FROM exercises WHERE 1=1"
        p: list = []
        if muscle_group:
            q += " AND muscle_group = ?"; p.append(muscle_group)
        if difficulty:
            q += " AND difficulty = ?"; p.append(difficulty)
        if search:
            q += " AND name LIKE ?"; p.append(f"%{search}%")
        q += " ORDER BY name"
        return [dict(r) for r in conn.execute(q, p).fetchall()]


@app.post("/api/exercises")
async def create_exercise(
    ex: ExerciseCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO exercises (name, muscle_group, secondary_muscle_groups,"
            " equipment, difficulty, load_type, calories_per_minute, description)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (ex.name, ex.muscle_group, ex.secondary_muscle_groups, ex.equipment,
             ex.difficulty, ex.load_type, ex.calories_per_minute, ex.description),
        )
        conn.commit()
    write_audit(user["id"], "create", "exercises", cur.lastrowid)
    return {"id": cur.lastrowid, "message": "Exercise created"}


@app.put("/api/exercises/{exercise_id}")
async def update_exercise(
    exercise_id: int,
    ex: ExerciseUpdate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    fields = ex.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as conn:
        sets = ", ".join(f"{k} = ?" for k in fields)
        params = list(fields.values()) + [exercise_id]
        conn.execute(f"UPDATE exercises SET {sets} WHERE id = ?", params)
        conn.commit()
    write_audit(user["id"], "update", "exercises", exercise_id)
    return {"message": "Exercise updated"}


@app.delete("/api/exercises/{exercise_id}")
async def delete_exercise(
    exercise_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as conn:
        conn.execute("DELETE FROM exercises WHERE id = ?", (exercise_id,))
        conn.commit()
    write_audit(user["id"], "delete", "exercises", exercise_id)
    return {"message": "Exercise deleted"}


# ==================== Programs ====================

@app.get("/api/programs")
async def get_programs(
    client_id: Optional[int] = None,
    is_active: Optional[int] = 1,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    if user["role"] == "client":
        client_id = user.get("client_id")
        if not client_id:
            return []
    with get_db() as conn:
        q = """
            SELECT tp.*, c.name AS client_name, t.name AS trainer_name
              FROM training_programs tp
              LEFT JOIN clients c ON tp.client_id = c.id
              LEFT JOIN trainers t ON tp.trainer_id = t.id
             WHERE 1=1
        """
        p: list = []
        if client_id:
            q += " AND tp.client_id = ?"; p.append(client_id)
        if is_active is not None:
            q += " AND tp.is_active = ?"; p.append(is_active)
        if search:
            q += " AND (tp.name LIKE ? OR c.name LIKE ? OR t.name LIKE ?)"
            p.extend([f"%{search}%", f"%{search}%", f"%{search}%"])
        q += " ORDER BY tp.created_at DESC"
        return [dict(r) for r in conn.execute(q, p).fetchall()]


@app.post("/api/programs")
async def create_program(
    program: TrainingProgramCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO training_programs (client_id, trainer_id, name, description,
                goal, duration_weeks, sessions_per_week, difficulty_level, start_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (program.client_id, program.trainer_id, program.name, program.description,
             program.goal, program.duration_weeks, program.sessions_per_week,
             program.difficulty_level, program.start_date),
        )
        new_id = cur.lastrowid
        # Автоматическое формирование календарного плана
        if program.start_date and program.duration_weeks and program.sessions_per_week:
            _generate_calendar(conn, new_id, program.start_date,
                               program.duration_weeks, program.sessions_per_week)
        conn.commit()
    write_audit(user["id"], "create", "training_programs", new_id)
    return {"id": new_id, "message": "Program created"}


def _generate_calendar(conn, program_id: int, start_date: str, duration_weeks: int, sessions_per_week: int):
    """Генерирует календарный план тренировок на основе параметров программы."""
    from datetime import datetime, timedelta
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        return
    # Распределяем тренировки по дням недели: Пн, Ср, Пт (или ближайшие доступные)
    base_days = [0, 2, 4, 1, 3, 5, 6]  # порядок предпочтительных дней
    chosen_days = base_days[:sessions_per_week]
    for week in range(duration_weeks):
        for dow in chosen_days:
            planned = start + timedelta(weeks=week, days=(dow - start.weekday()) % 7)
            conn.execute(
                """
                INSERT INTO training_calendar (program_id, planned_date, day_of_week, status)
                VALUES (?, ?, ?, 'planned')
                """,
                (program_id, planned.strftime("%Y-%m-%d"), dow),
            )


@app.put("/api/programs/{program_id}")
async def update_program(
    program_id: int,
    program: TrainingProgramUpdate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    fields = program.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as conn:
        sets = ", ".join(f"{k} = ?" for k in fields)
        params = list(fields.values()) + [program_id]
        conn.execute(f"UPDATE training_programs SET {sets} WHERE id = ?", params)
        conn.commit()
    write_audit(user["id"], "update", "training_programs", program_id)
    return {"message": "Program updated"}


@app.post("/api/programs/{program_id}/copy")
async def copy_program(
    program_id: int,
    target_client_id: int,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    """Копирование действующей программы для нового клиента.
    Предыдущая активная программа клиента архивируется (is_active = 0)."""
    with get_db() as conn:
        src = conn.execute(
            "SELECT * FROM training_programs WHERE id = ?", (program_id,)
        ).fetchone()
        if not src:
            raise HTTPException(status_code=404, detail="Program not found")
        # Архивируем текущую активную программу клиента
        conn.execute(
            "UPDATE training_programs SET is_active = 0 WHERE client_id = ? AND is_active = 1",
            (target_client_id,),
        )
        cur = conn.execute(
            """
            INSERT INTO training_programs (client_id, trainer_id, name, description,
                goal, duration_weeks, sessions_per_week, difficulty_level, start_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (target_client_id, src["trainer_id"], src["name"], src["description"],
             src["goal"], src["duration_weeks"], src["sessions_per_week"],
             src["difficulty_level"], src.get("start_date")),
        )
        new_id = cur.lastrowid
        for pe in conn.execute(
            "SELECT * FROM program_exercises WHERE program_id = ?", (program_id,)
        ).fetchall():
            conn.execute(
                """
                INSERT INTO program_exercises (program_id, exercise_id, sets, reps,
                    weight, rest_seconds, day_of_week, order_number, methodical_note)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id, pe["exercise_id"], pe["sets"], pe["reps"], pe["weight"],
                 pe["rest_seconds"], pe["day_of_week"], pe["order_number"],
                 pe["methodical_note"]),
            )
        # Генерируем календарь если есть start_date
        if src.get("start_date") and src["duration_weeks"] and src["sessions_per_week"]:
            _generate_calendar(conn, new_id, src["start_date"],
                               src["duration_weeks"], src["sessions_per_week"])
        conn.commit()
    write_audit(user["id"], "copy", "training_programs", new_id)
    return {"id": new_id, "source_id": program_id}


@app.get("/api/programs/{program_id}/exercises")
async def get_program_exercises(
    program_id: int,
    user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT pe.*, e.name AS exercise_name, e.muscle_group
              FROM program_exercises pe
              JOIN exercises e ON pe.exercise_id = e.id
             WHERE pe.program_id = ?
             ORDER BY pe.day_of_week, pe.order_number
            """,
            (program_id,),
        ).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/programs/{program_id}/exercises")
async def add_program_exercise(
    program_id: int,
    pe: ProgramExerciseCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    if pe.program_id != program_id:
        raise HTTPException(status_code=400, detail="program_id mismatch")
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO program_exercises (program_id, exercise_id, sets, reps,
                weight, rest_seconds, day_of_week, order_number, methodical_note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (program_id, pe.exercise_id, pe.sets, pe.reps, pe.weight,
             pe.rest_seconds, pe.day_of_week, pe.order_number, pe.methodical_note),
        )
        conn.commit()
    return {"id": cur.lastrowid}


# ==================== Sessions ====================

@app.get("/api/sessions")
async def get_sessions(
    client_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(get_current_user),
):
    if user["role"] == "client":
        client_id = user.get("client_id")
        if not client_id:
            return []
    with get_db() as conn:
        q = """
            SELECT ts.*, c.name AS client_name, tp.name AS program_name,
                   t.name AS trainer_name
              FROM training_sessions ts
              LEFT JOIN clients c ON ts.client_id = c.id
              LEFT JOIN training_programs tp ON ts.program_id = tp.id
              LEFT JOIN trainers t ON ts.trainer_id = t.id
             WHERE 1=1
        """
        p: list = []
        if client_id:
            q += " AND ts.client_id = ?"; p.append(client_id)
        if date_from:
            q += " AND ts.session_date >= ?"; p.append(date_from)
        if date_to:
            q += " AND ts.session_date <= ?"; p.append(date_to)
        q += " ORDER BY ts.session_date DESC LIMIT ?"; p.append(limit)
        return [dict(r) for r in conn.execute(q, p).fetchall()]


@app.post("/api/sessions")
async def create_session(
    session: TrainingSessionCreate,
    user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        # Автоматическое назначение тренера клиента
        trainer_id = session.trainer_id
        if trainer_id is None:
            row = conn.execute(
                "SELECT trainer_id FROM clients WHERE id = ?", (session.client_id,)
            ).fetchone()
            if row and row["trainer_id"]:
                trainer_id = row["trainer_id"]

        cur = conn.execute(
            """
            INSERT INTO training_sessions (client_id, program_id, trainer_id,
                session_date, start_time, duration_minutes, calories_burned,
                fatigue_level, satisfaction_rating, comment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (session.client_id, session.program_id, trainer_id,
             session.session_date, session.start_time, session.duration_minutes,
             session.calories_burned, session.fatigue_level,
             session.satisfaction_rating, session.comment),
        )
        session_id = cur.lastrowid

        # Автоматическое детализирование упражнений из программы
        total_exercise_calories = 0
        if session.program_id:
            program_exercises = conn.execute(
                """
                SELECT pe.*, e.calories_per_minute
                  FROM program_exercises pe
                  JOIN exercises e ON pe.exercise_id = e.id
                 WHERE pe.program_id = ?
                 ORDER BY pe.order_number, pe.id
                """,
                (session.program_id,),
            ).fetchall()

            if program_exercises and session.duration_minutes:
                minutes_per_exercise = session.duration_minutes / len(program_exercises)
            else:
                minutes_per_exercise = None

            for pe in program_exercises:
                exercise_calories = None
                if pe["calories_per_minute"] and minutes_per_exercise:
                    exercise_calories = round(pe["calories_per_minute"] * minutes_per_exercise)

                conn.execute(
                    """
                    INSERT INTO session_exercises (session_id, exercise_id, program_exercise_id,
                        actual_sets, actual_reps, actual_weight, actual_duration_seconds, rpe, calories_burned)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (session_id, pe["exercise_id"], pe["id"],
                     pe["sets"], pe["reps"], pe["weight"],
                     int(minutes_per_exercise * 60) if minutes_per_exercise else None,
                     None, exercise_calories),
                )
                if exercise_calories:
                    total_exercise_calories += exercise_calories

            # Обновляем общие калории тренировки суммой по упражнениям,
            # только если пользователь не указал их вручную
            if total_exercise_calories and not session.calories_burned:
                conn.execute(
                    "UPDATE training_sessions SET calories_burned = ? WHERE id = ?",
                    (total_exercise_calories, session_id),
                )

        conn.commit()
    write_audit(user["id"], "create", "training_sessions", session_id)
    return {"id": session_id, "message": "Session recorded"}


@app.post("/api/sessions/{session_id}/exercises")
async def add_session_exercise(
    session_id: int,
    se: SessionExerciseCreate,
    user: dict = Depends(get_current_user),
):
    if se.session_id != session_id:
        raise HTTPException(status_code=400, detail="session_id mismatch")
    with get_db() as conn:
        # Автоматический расчёт калорий по длительности, если не указаны вручную
        calories = se.calories_burned
        if calories is None and se.actual_duration_seconds:
            ex = conn.execute(
                "SELECT calories_per_minute FROM exercises WHERE id = ?",
                (se.exercise_id,),
            ).fetchone()
            if ex and ex["calories_per_minute"]:
                calories = round(ex["calories_per_minute"] * (se.actual_duration_seconds / 60))

        cur = conn.execute(
            """
            INSERT INTO session_exercises (session_id, exercise_id, program_exercise_id,
                actual_sets, actual_reps, actual_weight, actual_duration_seconds, rpe, calories_burned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (session_id, se.exercise_id, se.program_exercise_id, se.actual_sets,
             se.actual_reps, se.actual_weight, se.actual_duration_seconds, se.rpe, calories),
        )
        conn.commit()
    return {"id": cur.lastrowid}


@app.get("/api/sessions/{session_id}/exercises")
async def get_session_exercises(
    session_id: int,
    user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT se.*, e.name AS exercise_name, e.calories_per_minute
              FROM session_exercises se
              JOIN exercises e ON se.exercise_id = e.id
             WHERE se.session_id = ?
            """,
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]


# ==================== Client Metrics ====================

@app.get("/api/metrics/{client_id}")
async def get_client_metrics(
    client_id: int,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM client_metrics WHERE client_id = ?"
            " ORDER BY measurement_date DESC LIMIT ?",
            (client_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/metrics")
async def create_metrics(
    m: ClientMetricsCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO client_metrics (client_id, measurement_date, weight,
                body_fat_percentage, muscle_mass, chest_cm, waist_cm, hips_cm,
                biceps_cm, thighs_cm, resting_heart_rate, max_pushups, max_pullups,
                plank_seconds, run_5km_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (m.client_id, m.measurement_date, m.weight, m.body_fat_percentage,
             m.muscle_mass, m.chest_cm, m.waist_cm, m.hips_cm, m.biceps_cm,
             m.thighs_cm, m.resting_heart_rate, m.max_pushups, m.max_pullups,
             m.plank_seconds, m.run_5km_minutes),
        )
        conn.commit()
    write_audit(user["id"], "create", "client_metrics", cur.lastrowid)
    return {"id": cur.lastrowid}


# ==================== Client Goals ====================

@app.get("/api/goals/{client_id}")
async def get_client_goals(client_id: int, user: dict = Depends(get_current_user)):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM client_goals WHERE client_id = ? ORDER BY created_at DESC",
            (client_id,),
        ).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/goals")
async def create_goal(
    goal: ClientGoalCreate,
    user: dict = Depends(require_roles("admin", "trainer", "client")),
):
    if user["role"] == "client" and user.get("client_id") != goal.client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO client_goals (client_id, metric, target_value, target_date)"
            " VALUES (?, ?, ?, ?)",
            (goal.client_id, goal.metric, goal.target_value, goal.target_date),
        )
        conn.commit()
    write_audit(user["id"], "create", "client_goals", cur.lastrowid)
    return {"id": cur.lastrowid}


@app.post("/api/goals/{goal_id}/achieve")
async def mark_goal_achieved(
    goal_id: int,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as conn:
        conn.execute(
            "UPDATE client_goals SET achieved_at = CURRENT_TIMESTAMP WHERE id = ?",
            (goal_id,),
        )
        conn.commit()
    write_audit(user["id"], "achieve", "client_goals", goal_id)
    return {"ok": True}


# ==================== Audit log ====================

@app.get("/api/audit")
async def get_audit_log(
    limit: int = 200,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT al.*, u.login AS user_login
              FROM audit_log al
              LEFT JOIN users u ON al.user_id = u.id
             ORDER BY al.timestamp DESC
             LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


# ==================== Recommendations ====================

def _recompute_recommendations(conn) -> int:
    """Пересчитывает рекомендации по правилам ВКР: загрузка тренеров и
    неравномерность посещений по дням недели."""
    conn.execute("DELETE FROM recommendations WHERE is_applied = 0")

    # Правило 1: загрузка тренеров — менее 20 сессий за месяц.
    rows = conn.execute(
        """
        SELECT t.id, t.name, COUNT(ts.id) AS sessions
          FROM trainers t
          LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
               AND ts.session_date >= date('now', '-30 days')
         WHERE t.is_active = 1
         GROUP BY t.id
        """
    ).fetchall()
    for r in rows:
        if r["sessions"] < 20:
            conn.execute(
                "INSERT INTO recommendations (recommendation_type, title, description,"
                " priority) VALUES (?, ?, ?, ?)",
                (
                    "trainer_load",
                    f"Низкая загрузка тренера {r['name']}",
                    f"За последние 30 дней проведено {r['sessions']} сессий"
                    f" (менее 20). Рекомендуется перераспределить клиентов.",
                    8,
                ),
            )

    # Правило 2: неравномерность посещений по дням недели.
    rows = conn.execute(
        """
        SELECT strftime('%w', session_date) AS dow, COUNT(*) AS cnt
          FROM training_sessions
         WHERE session_date >= date('now', '-30 days')
         GROUP BY dow
        """
    ).fetchall()
    counts = {int(r["dow"]): r["cnt"] for r in rows}
    if counts:
        avg = sum(counts.values()) / 7
        weak_days = [DAY_NAMES[d] for d in range(7) if counts.get(d, 0) < avg * 0.7]
        if weak_days and avg > 0:
            conn.execute(
                "INSERT INTO recommendations (recommendation_type, title, description,"
                " priority) VALUES (?, ?, ?, ?)",
                (
                    "weekday_load",
                    "Неравномерная посещаемость по дням недели",
                    f"Просадка посещений в дни: {', '.join(weak_days)}."
                    " Рекомендуется выровнять расписание или ввести стимулирующие акции.",
                    6,
                ),
            )

    return conn.execute(
        "SELECT COUNT(*) FROM recommendations WHERE is_applied = 0"
    ).fetchone()[0]


@app.post("/api/recommendations/recompute")
async def recompute_recommendations(
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as conn:
        n = _recompute_recommendations(conn)
        conn.commit()
    write_audit(user["id"], "recompute", "recommendations")
    return {"count": n}


@app.get("/api/recommendations")
async def list_recommendations(
    include_applied: int = 0,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as conn:
        q = "SELECT * FROM recommendations"
        if not include_applied:
            q += " WHERE is_applied = 0"
        q += " ORDER BY priority DESC, created_at DESC"
        return [dict(r) for r in conn.execute(q).fetchall()]


@app.post("/api/recommendations/{rec_id}/apply")
async def apply_recommendation(
    rec_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as conn:
        conn.execute(
            "UPDATE recommendations SET is_applied = 1 WHERE id = ?", (rec_id,)
        )
        conn.commit()
    write_audit(user["id"], "apply", "recommendations", rec_id)
    return {"ok": True}


# ==================== Dashboard analytics ====================

@app.get("/api/analytics/dashboard")
async def get_dashboard_analytics(user: dict = Depends(get_current_user)):
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM clients WHERE is_active = 1")
        active_clients = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM trainers WHERE is_active = 1")
        active_trainers = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM training_programs WHERE is_active = 1")
        active_programs = c.fetchone()[0]
        c.execute(
            "SELECT COUNT(*) FROM training_sessions"
            " WHERE session_date >= date('now', '-30 days')"
        )
        sessions_30d = c.fetchone()[0]
        c.execute(
            "SELECT AVG(satisfaction_rating) FROM training_sessions"
            " WHERE satisfaction_rating IS NOT NULL"
            " AND session_date >= date('now', '-30 days')"
        )
        avg_satisfaction = c.fetchone()[0] or 0

        # Посещения по дням недели
        c.execute(
            "SELECT strftime('%w', session_date) AS dow, COUNT(*) AS cnt"
            " FROM training_sessions"
            " WHERE session_date >= date('now', '-30 days')"
            " GROUP BY dow"
        )
        by_dow = {int(r[0]): r[1] for r in c.fetchall()}
        visits_by_weekday = [
            {"day": DAY_NAMES[i], "visits": by_dow.get(i, 0)} for i in range(7)
        ]

        # Распределение клиентов по целям
        c.execute(
            "SELECT COALESCE(fitness_goal, 'не указано') AS goal, COUNT(*) AS cnt"
            " FROM clients WHERE is_active = 1 GROUP BY goal"
        )
        goal_distribution = [{"goal": r[0], "count": r[1]} for r in c.fetchall()]

        # Топ тренеров по средней оценке
        c.execute(
            """
            SELECT t.name, COUNT(ts.id) AS sessions,
                   COALESCE(AVG(ts.satisfaction_rating), 0) AS rating
              FROM trainers t
              LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
                   AND ts.session_date >= date('now', '-90 days')
             WHERE t.is_active = 1
             GROUP BY t.id
             ORDER BY rating DESC, sessions DESC
             LIMIT 5
            """
        )
        top_trainers = [
            {"name": r[0], "sessions": r[1], "rating": round(r[2], 2)}
            for r in c.fetchall()
        ]

        # Динамика посещений по неделям за 12 недель
        c.execute(
            "SELECT strftime('%Y-%W', session_date) AS week, COUNT(*) AS cnt"
            " FROM training_sessions"
            " WHERE session_date >= date('now', '-84 days')"
            " GROUP BY week ORDER BY week"
        )
        weekly_visits = [{"week": r[0], "visits": r[1]} for r in c.fetchall()]

        return {
            "summary": {
                "active_clients": active_clients,
                "active_trainers": active_trainers,
                "active_programs": active_programs,
                "sessions_30d": sessions_30d,
                "avg_satisfaction": round(avg_satisfaction, 2),
            },
            "visits_by_weekday": visits_by_weekday,
            "goal_distribution": goal_distribution,
            "top_trainers": top_trainers,
            "weekly_visits": weekly_visits,
        }


# ==================== Per-client analytics ====================

def _client_stats(conn, client_id: int) -> dict:
    s = conn.execute(
        "SELECT COUNT(*) AS total_sessions,"
        " AVG(duration_minutes) AS avg_duration,"
        " AVG(satisfaction_rating) AS avg_satisfaction,"
        " MAX(session_date) AS last_session"
        " FROM training_sessions WHERE client_id = ?",
        (client_id,),
    ).fetchone()
    recent = conn.execute(
        "SELECT COUNT(*) FROM training_sessions WHERE client_id = ?"
        " AND session_date >= date('now', '-30 days')",
        (client_id,),
    ).fetchone()[0]
    return {
        "total_sessions": s["total_sessions"] or 0,
        "avg_duration": s["avg_duration"] or 0,
        "avg_satisfaction": s["avg_satisfaction"] or 0,
        "last_session": s["last_session"],
        "sessions_30d": recent,
    }


def calculate_churn_risk(stats: dict) -> dict:
    """Балльная модель риска оттока, эвристический индикатор для тренера.

    По ВКР: три фактора, максимум 30 + 35 + 35 = 100.
    """
    score = 0.0
    factors: list = []

    # Фактор 1: частота посещений за месяц (макс. 30).
    visits_30d = stats.get("sessions_30d") or 0
    if visits_30d >= 12:
        f1 = 0
    elif visits_30d <= 0:
        f1 = 30
    else:
        f1 = round(30 * (1 - visits_30d / 12), 1)
    if f1 >= 15:
        factors.append("Низкая частота посещений за последние 30 дней")
    score += f1

    # Фактор 2: средняя удовлетворённость (макс. 35).
    sat = stats.get("avg_satisfaction") or 0
    if sat <= 0:
        f2 = 17.5  # данных нет — средний риск
        factors.append("Нет оценок удовлетворённости")
    else:
        f2 = max(0.0, round(35 * (5 - sat) / 4, 1))
        if f2 >= 17:
            factors.append("Низкая средняя оценка удовлетворённости")
    score += f2

    # Фактор 3: общее количество тренировок (макс. 35).
    total = stats.get("total_sessions") or 0
    if total >= 50:
        f3 = 0
    else:
        f3 = round(35 * (1 - total / 50), 1)
    if f3 >= 17:
        factors.append("Малое общее количество проведённых тренировок")
    score += f3

    score = round(min(100.0, score), 1)
    if score > 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"
    return {
        "score": score,
        "level": level,
        "factors": factors,
        "components": {
            "frequency": round(f1, 1),
            "satisfaction": round(f2, 1),
            "engagement": round(f3, 1),
        },
    }


def analyze_progress(metrics_history: list) -> dict:
    if len(metrics_history) < 2:
        return {"status": "insufficient_data", "changes": {}, "insights": []}
    first = metrics_history[0]
    last = metrics_history[-1]
    changes: dict = {}
    insights: list = []

    if first.get("weight") and last.get("weight"):
        d = last["weight"] - first["weight"]
        changes["weight"] = {
            "start": first["weight"], "current": last["weight"],
            "change": round(d, 1),
        }
        if d < -2:
            insights.append({"type": "positive", "message": f"Снижение веса на {abs(d):.1f} кг"})
        elif d > 2:
            insights.append({"type": "warning", "message": f"Прирост веса +{d:.1f} кг"})

    if first.get("body_fat_percentage") and last.get("body_fat_percentage"):
        d = last["body_fat_percentage"] - first["body_fat_percentage"]
        changes["body_fat"] = {
            "start": first["body_fat_percentage"],
            "current": last["body_fat_percentage"],
            "change": round(d, 1),
        }
        if d < -1:
            insights.append({"type": "positive",
                             "message": f"Снижение % жира на {abs(d):.1f}"})

    if first.get("max_pushups") and last.get("max_pushups"):
        d = last["max_pushups"] - first["max_pushups"]
        if d > 0:
            insights.append({"type": "positive",
                             "message": f"Отжимания: +{d}"})

    pos = sum(1 for i in insights if i["type"] == "positive")
    warn = sum(1 for i in insights if i["type"] == "warning")
    status = ("excellent" if pos >= 2 else
              "good" if pos == 1 else
              "needs_attention" if warn > pos else "stable")
    return {"status": status, "changes": changes, "insights": insights}


def goals_progress(conn, client_id: int) -> list:
    goals = conn.execute(
        "SELECT * FROM client_goals WHERE client_id = ?", (client_id,)
    ).fetchall()
    last_metrics = conn.execute(
        "SELECT * FROM client_metrics WHERE client_id = ?"
        " ORDER BY measurement_date DESC LIMIT 1",
        (client_id,),
    ).fetchone()
    out: list = []
    for g in goals:
        g = dict(g)
        current = None
        if last_metrics and g["metric"] in last_metrics.keys():
            current = last_metrics[g["metric"]]
        progress = None
        if current is not None and g["target_value"]:
            try:
                progress = round(min(100.0, current / g["target_value"] * 100), 1)
            except ZeroDivisionError:
                progress = None
        g["current_value"] = current
        g["progress_percent"] = progress
        out.append(g)
    return out


def analyze_client_programs(conn, client_id: int) -> list:
    """Аналитика по каждой программе клиента: выполнение, метрики, прогресс."""
    programs = conn.execute(
        """
        SELECT tp.*, t.name AS trainer_name
          FROM training_programs tp
          LEFT JOIN trainers t ON tp.trainer_id = t.id
         WHERE tp.client_id = ?
         ORDER BY tp.start_date DESC, tp.created_at DESC
        """,
        (client_id,),
    ).fetchall()

    results = []
    for prog in programs:
        prog = dict(prog)
        program_id = prog["id"]

        # Статистика сессий по программе
        sess = conn.execute(
            """
            SELECT COUNT(*) AS cnt,
                   AVG(satisfaction_rating) AS avg_sat,
                   AVG(duration_minutes) AS avg_dur,
                   SUM(calories_burned) AS total_cal
              FROM training_sessions
             WHERE program_id = ? AND client_id = ?
            """,
            (program_id, client_id),
        ).fetchone()

        # Запланированные сессии
        planned_row = conn.execute(
            "SELECT COUNT(*) FROM training_calendar WHERE program_id = ?",
            (program_id,),
        ).fetchone()
        planned = planned_row[0] if planned_row and planned_row[0] else (
            (prog.get("duration_weeks") or 0) * (prog.get("sessions_per_week") or 0)
        )

        completion_rate = 0.0
        if planned and planned > 0 and sess["cnt"]:
            completion_rate = round(sess["cnt"] / planned, 2)

        # Метрики до и после программы
        metrics_before = None
        metrics_after = None
        metrics_change = {}

        start_date = prog.get("start_date")
        if start_date:
            before_row = conn.execute(
                """
                SELECT * FROM client_metrics
                 WHERE client_id = ? AND measurement_date <= ?
                 ORDER BY measurement_date DESC LIMIT 1
                """,
                (client_id, start_date),
            ).fetchone()
            if before_row:
                metrics_before = dict(before_row)

            after_row = conn.execute(
                """
                SELECT * FROM client_metrics
                 WHERE client_id = ? AND measurement_date >= ?
                 ORDER BY measurement_date DESC LIMIT 1
                """,
                (client_id, start_date),
            ).fetchone()
            if after_row:
                metrics_after = dict(after_row)

            if metrics_before and metrics_after:
                for col in ["weight", "body_fat_percentage", "muscle_mass",
                            "max_pushups", "plank_seconds"]:
                    b = metrics_before.get(col)
                    a = metrics_after.get(col)
                    if b is not None and a is not None:
                        metrics_change[col] = round(a - b, 2)

        # Прогресс по упражнениям (первые 3 vs последние 3 сессии)
        exercise_progress = []
        if sess["cnt"] and sess["cnt"] >= 2:
            prog_exercises = conn.execute(
                """
                SELECT pe.exercise_id, e.name AS exercise_name
                  FROM program_exercises pe
                  JOIN exercises e ON pe.exercise_id = e.id
                 WHERE pe.program_id = ?
                """,
                (program_id,),
            ).fetchall()

            for pe in prog_exercises:
                early = conn.execute(
                    """
                    WITH early AS (
                        SELECT se.actual_weight, se.actual_reps, se.rpe
                          FROM session_exercises se
                          JOIN training_sessions ts ON se.session_id = ts.id
                         WHERE ts.program_id = ? AND se.exercise_id = ?
                         ORDER BY ts.session_date ASC
                         LIMIT 3
                    )
                    SELECT AVG(actual_weight) AS avg_w,
                           AVG(actual_reps) AS avg_r,
                           AVG(rpe) AS avg_rpe
                      FROM early
                    """,
                    (program_id, pe["exercise_id"]),
                ).fetchone()

                late = conn.execute(
                    """
                    WITH late AS (
                        SELECT se.actual_weight, se.actual_reps, se.rpe
                          FROM session_exercises se
                          JOIN training_sessions ts ON se.session_id = ts.id
                         WHERE ts.program_id = ? AND se.exercise_id = ?
                         ORDER BY ts.session_date DESC
                         LIMIT 3
                    )
                    SELECT AVG(actual_weight) AS avg_w,
                           AVG(actual_reps) AS avg_r,
                           AVG(rpe) AS avg_rpe
                      FROM late
                    """,
                    (program_id, pe["exercise_id"]),
                ).fetchone()

                has_early = early and (early["avg_w"] is not None or early["avg_r"] is not None)
                has_late = late and (late["avg_w"] is not None or late["avg_r"] is not None)
                if has_early or has_late:
                    exercise_progress.append({
                        "exercise_name": pe["exercise_name"],
                        "early_avg_weight": round(early["avg_w"], 1) if early and early["avg_w"] else None,
                        "late_avg_weight": round(late["avg_w"], 1) if late and late["avg_w"] else None,
                        "early_avg_reps": round(early["avg_r"], 1) if early and early["avg_r"] else None,
                        "late_avg_reps": round(late["avg_r"], 1) if late and late["avg_r"] else None,
                        "early_avg_rpe": round(early["avg_rpe"], 1) if early and early["avg_rpe"] else None,
                        "late_avg_rpe": round(late["avg_rpe"], 1) if late and late["avg_rpe"] else None,
                    })

        # Управленческие рекомендации по коррекции
        recommendations = []
        goal = prog.get("goal") or ""
        avg_sat = sess["avg_sat"] if sess["avg_sat"] else None

        if planned and planned > 0 and completion_rate < 0.5:
            recommendations.append(
                "Низкая выполняемость программы — рассмотреть снижение частоты или сложности"
            )
        elif planned and planned > 0 and completion_rate > 0.9:
            recommendations.append(
                "Высокая выполняемость — можно увеличить нагрузку для прогрессии"
            )

        if avg_sat is not None and avg_sat < 3:
            recommendations.append(
                "Низкая удовлетворенность — пересмотреть подбор упражнений или тренера"
            )
        elif avg_sat is not None and avg_sat >= 4.5:
            recommendations.append(
                "Клиент доволен программой — зафиксировать подход как эффективный"
            )

        if metrics_change:
            if "weight_loss" in goal or goal == "похудение":
                if metrics_change.get("weight", 0) >= 0:
                    recommendations.append(
                        "Вес не снижается — усилить кардио-компонент или скорректировать питание"
                    )
                elif metrics_change.get("weight", 0) < -1:
                    recommendations.append(
                        "Хорошая динамика веса — поддерживать текущий подход"
                    )
            if "muscle_gain" in goal or goal == "набор массы":
                if metrics_change.get("muscle_mass", 0) <= 0:
                    recommendations.append(
                        "Мышечная масса не растет — увеличить объем силовой нагрузки"
                    )
                elif metrics_change.get("muscle_mass", 0) > 0.5:
                    recommendations.append(
                        "Положительная динамика мышечной массы — подход работает"
                    )
            if "endurance" in goal or goal == "выносливость":
                if metrics_change.get("max_pushups", 0) <= 0 and metrics_change.get("plank_seconds", 0) <= 0:
                    recommendations.append(
                        "Показатели выносливости стагнируют — повысить интенсивность"
                    )
                elif metrics_change.get("max_pushups", 0) > 3 or metrics_change.get("plank_seconds", 0) > 10:
                    recommendations.append(
                        "Выносливость растет — программа эффективна"
                    )
        else:
            recommendations.append(
                "Нет данных по изменению метрик — рекомендуется провести замеры для оценки эффективности"
            )

        results.append({
            "program_id": program_id,
            "program_name": prog["name"],
            "goal": prog.get("goal"),
            "trainer_name": prog.get("trainer_name"),
            "start_date": start_date,
            "is_active": prog.get("is_active", 1),
            "sessions_count": sess["cnt"] or 0,
            "avg_satisfaction": round(avg_sat, 1) if avg_sat is not None else None,
            "avg_duration": round(sess["avg_dur"], 0) if sess["avg_dur"] else None,
            "total_calories": sess["total_cal"] or 0,
            "planned_sessions": planned,
            "completion_rate": completion_rate,
            "metrics_before": ({k: v for k, v in metrics_before.items()
                                if k in ("weight", "body_fat_percentage", "muscle_mass",
                                         "max_pushups", "plank_seconds") and v is not None}
                               if metrics_before else None),
            "metrics_after": ({k: v for k, v in metrics_after.items()
                               if k in ("weight", "body_fat_percentage", "muscle_mass",
                                        "max_pushups", "plank_seconds") and v is not None}
                              if metrics_after else None),
            "metrics_change": metrics_change,
            "exercise_progress": exercise_progress,
            "recommendations": recommendations,
        })

    return results


@app.get("/api/analytics/client/{client_id}")
async def get_client_analytics(client_id: int, user: dict = Depends(get_current_user)):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as conn:
        client = conn.execute(
            "SELECT * FROM clients WHERE id = ?", (client_id,)
        ).fetchone()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        client = dict(client)

        stats = _client_stats(conn, client_id)
        monthly = conn.execute(
            "SELECT strftime('%Y-%m', session_date) AS month, COUNT(*) AS visits"
            " FROM training_sessions WHERE client_id = ?"
            " GROUP BY month ORDER BY month DESC LIMIT 12",
            (client_id,),
        ).fetchall()
        monthly_visits = [{"month": r[0], "visits": r[1]} for r in monthly]

        metrics_history = [
            dict(r) for r in conn.execute(
                "SELECT * FROM client_metrics WHERE client_id = ?"
                " ORDER BY measurement_date",
                (client_id,),
            ).fetchall()
        ]
        progress = analyze_progress(metrics_history)
        goals = goals_progress(conn, client_id)

        current_program = conn.execute(
            """
            SELECT tp.*, t.name AS trainer_name
              FROM training_programs tp
              LEFT JOIN trainers t ON tp.trainer_id = t.id
             WHERE tp.client_id = ? AND tp.is_active = 1
             ORDER BY tp.created_at DESC LIMIT 1
            """,
            (client_id,),
        ).fetchone()
        churn = calculate_churn_risk(stats)
        program_analytics = analyze_client_programs(conn, client_id)

        return {
            "client": client,
            "session_stats": stats,
            "monthly_visits": monthly_visits,
            "metrics_history": metrics_history,
            "progress_analysis": progress,
            "goals": goals,
            "current_program": dict(current_program) if current_program else None,
            "churn_risk": churn,
            "program_analytics": program_analytics,
        }


# ==================== Churn analytics (heuristic + survival) ====================

@app.get("/api/analytics/churn")
async def get_churn_analytics(user: dict = Depends(require_roles("admin", "trainer"))):
    """Аналитика оттока клиентов: оперативный балльный индикатор + анализ
    выживаемости (Каплан—Майер по группам типов абонементов)."""
    with get_db() as conn:
        clients = [dict(r) for r in conn.execute(
            "SELECT * FROM clients").fetchall()]
        scored = []
        for cl in clients:
            if not cl["is_active"]:
                continue
            stats = _client_stats(conn, cl["id"])
            risk = calculate_churn_risk(stats)
            scored.append({
                "client_id": cl["id"],
                "client_name": cl["name"],
                "subscription_type": cl["subscription_type"],
                "last_session": stats.get("last_session"),
                "total_sessions": stats.get("total_sessions"),
                "risk": risk,
            })
        scored.sort(key=lambda x: x["risk"]["score"], reverse=True)
        risk_distribution = {
            "high": sum(1 for s in scored if s["risk"]["level"] == "high"),
            "medium": sum(1 for s in scored if s["risk"]["level"] == "medium"),
            "low": sum(1 for s in scored if s["risk"]["level"] == "low"),
        }

        survival = _kaplan_meier_by_subscription(conn)
        cox = _cox_regression(conn)

    return {
        "clients": scored[:200],
        "risk_distribution": risk_distribution,
        "survival_analysis": survival,
        "cox_regression": cox,
    }


def _kaplan_meier_by_subscription(conn) -> dict:
    """Кривые Каплана—Майера по группам типов абонементов + log-rank."""
    try:
        from lifelines import KaplanMeierFitter
        from lifelines.statistics import multivariate_logrank_test
    except ImportError:
        return {"available": False, "reason": "lifelines не установлен"}

    rows = conn.execute(
        """
        SELECT c.id, c.subscription_type, c.is_active,
               COALESCE(c.subscription_start_date, c.registration_date)
                   AS start_date,
               (SELECT MAX(session_date) FROM training_sessions ts
                 WHERE ts.client_id = c.id) AS last_session
          FROM clients c
        """
    ).fetchall()

    durations: list = []
    events: list = []
    groups: list = []
    today = datetime.now()
    for r in rows:
        try:
            start = datetime.strptime(r["start_date"], "%Y-%m-%d")
        except (TypeError, ValueError):
            continue
        # Отток: клиент неактивен — событие наступило в момент last_session
        # (или сегодня, если сессий не было). Активный клиент = цензура.
        if r["is_active"] == 0:
            try:
                end = datetime.strptime(r["last_session"], "%Y-%m-%d")
            except (TypeError, ValueError):
                end = today
            event = 1
        else:
            end = today
            event = 0
        days = max(1, (end - start).days)
        durations.append(days)
        events.append(event)
        groups.append(r["subscription_type"] or "unknown")

    if len(durations) < 5:
        return {"available": False, "reason": "недостаточно данных"}

    durations_a = np.array(durations, dtype=float)
    events_a = np.array(events, dtype=int)
    groups_a = np.array(groups)

    curves: list = []
    for g in sorted(set(groups_a)):
        mask = groups_a == g
        if mask.sum() < 3:
            continue
        kmf = KaplanMeierFitter()
        kmf.fit(durations_a[mask], events_a[mask], label=g)
        timeline = kmf.survival_function_.index.tolist()
        survival = kmf.survival_function_[g].tolist()
        curves.append({
            "group": g,
            "n": int(mask.sum()),
            "events": int(events_a[mask].sum()),
            "median_survival_days": (None if math.isinf(kmf.median_survival_time_)
                                     else float(kmf.median_survival_time_)),
            "timeline": [float(t) for t in timeline],
            "survival": [round(float(s), 4) for s in survival],
        })

    logrank = None
    if len({g for g in groups_a}) > 1:
        try:
            test = multivariate_logrank_test(durations_a, groups_a, events_a)
            logrank = {
                "statistic": round(float(test.test_statistic), 3),
                "p_value": round(float(test.p_value), 5),
            }
        except Exception:
            logrank = None

    return {"available": True, "curves": curves, "logrank": logrank}


def _cox_regression(conn) -> dict:
    """Регрессия Кокса по признакам клиента."""
    try:
        from lifelines import CoxPHFitter
    except ImportError:
        return {"available": False, "reason": "lifelines не установлен"}

    import pandas as pd

    rows = conn.execute(
        """
        SELECT c.id, c.is_active, c.birth_date,
               COALESCE(c.subscription_start_date, c.registration_date) AS start_date,
               (SELECT MAX(session_date) FROM training_sessions ts
                 WHERE ts.client_id = c.id) AS last_session,
               (SELECT COUNT(*) FROM training_sessions ts
                 WHERE ts.client_id = c.id) AS total_sessions,
               (SELECT AVG(satisfaction_rating) FROM training_sessions ts
                 WHERE ts.client_id = c.id) AS avg_satisfaction
          FROM clients c
        """
    ).fetchall()

    today = datetime.now()
    records: list = []
    for r in rows:
        try:
            start = datetime.strptime(r["start_date"], "%Y-%m-%d")
        except (TypeError, ValueError):
            continue
        if r["is_active"] == 0:
            try:
                end = datetime.strptime(r["last_session"], "%Y-%m-%d")
            except (TypeError, ValueError):
                end = today
            event = 1
        else:
            end = today
            event = 0
        days = max(1, (end - start).days)
        try:
            age = (today - datetime.strptime(r["birth_date"], "%Y-%m-%d")).days / 365.25
        except (TypeError, ValueError):
            age = 30.0
        records.append({
            "duration": days,
            "event": event,
            "age": age,
            "total_sessions": r["total_sessions"] or 0,
            "avg_satisfaction": float(r["avg_satisfaction"]) if r["avg_satisfaction"] else 3.0,
            "subscription_days": days,
        })

    if len(records) < 20 or sum(r["event"] for r in records) < 3:
        return {"available": False, "reason": "недостаточно событий для модели Кокса"}

    df = pd.DataFrame(records)
    try:
        cph = CoxPHFitter(penalizer=0.01)
        cph.fit(df.drop(columns=["subscription_days"]),
                duration_col="duration", event_col="event")
        summary = cph.summary
        coefs = []
        for name, row in summary.iterrows():
            coefs.append({
                "covariate": name,
                "hazard_ratio": round(float(row["exp(coef)"]), 3),
                "ci_lower": round(float(row["exp(coef) lower 95%"]), 3),
                "ci_upper": round(float(row["exp(coef) upper 95%"]), 3),
                "p_value": round(float(row["p"]), 5),
            })
        return {
            "available": True,
            "n": len(df),
            "events": int(df["event"].sum()),
            "concordance_index": round(float(cph.concordance_index_), 3),
            "coefficients": coefs,
        }
    except Exception as exc:
        return {"available": False, "reason": str(exc)}


# ==================== Clustering (k-means + PCA) ====================

@app.get("/api/analytics/segments")
async def get_client_segments(
    k: int = 4,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    """Сегментация клиентской базы методом k-средних с проекцией PCA."""
    try:
        from sklearn.cluster import KMeans
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import silhouette_score
    except ImportError:
        return {"available": False, "reason": "scikit-learn не установлен"}

    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.name, c.birth_date, c.fitness_goal,
                   (SELECT weight FROM client_metrics m
                     WHERE m.client_id = c.id ORDER BY m.measurement_date LIMIT 1)
                       AS init_weight,
                   (SELECT body_fat_percentage FROM client_metrics m
                     WHERE m.client_id = c.id ORDER BY m.measurement_date LIMIT 1)
                       AS init_bf,
                   (SELECT max_pushups FROM client_metrics m
                     WHERE m.client_id = c.id ORDER BY m.measurement_date LIMIT 1)
                       AS init_pushups,
                   (SELECT plank_seconds FROM client_metrics m
                     WHERE m.client_id = c.id ORDER BY m.measurement_date LIMIT 1)
                       AS init_plank,
                   (SELECT COUNT(*) * 1.0 / 4.3 FROM training_sessions ts
                     WHERE ts.client_id = c.id
                       AND ts.session_date >= date('now', '-30 days'))
                       AS visits_per_week
              FROM clients c
             WHERE c.is_active = 1
            """
        ).fetchall()

    today = datetime.now()
    feats = []
    meta = []
    for r in rows:
        try:
            age = (today - datetime.strptime(r["birth_date"], "%Y-%m-%d")).days / 365.25
        except (TypeError, ValueError):
            continue
        if any(r[col] is None for col in
               ["init_weight", "init_bf", "init_pushups", "init_plank"]):
            continue
        feats.append([
            age, r["init_weight"], r["init_bf"], r["init_pushups"],
            r["init_plank"], r["visits_per_week"] or 0,
        ])
        meta.append({"id": r["id"], "name": r["name"], "goal": r["fitness_goal"]})

    if len(feats) < max(8, k * 2):
        return {"available": False, "reason": "недостаточно клиентов с замерами"}

    X = np.array(feats, dtype=float)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(Xs)

    sil = float(silhouette_score(Xs, labels)) if len(set(labels)) > 1 else None

    pca = PCA(n_components=2)
    Xp = pca.fit_transform(Xs)

    points = [
        {
            "client_id": meta[i]["id"],
            "name": meta[i]["name"],
            "goal": meta[i]["goal"],
            "cluster": int(labels[i]),
            "x": round(float(Xp[i, 0]), 3),
            "y": round(float(Xp[i, 1]), 3),
        }
        for i in range(len(meta))
    ]

    centroids_orig = scaler.inverse_transform(km.cluster_centers_)
    feature_names = ["age", "weight", "body_fat", "pushups", "plank_sec",
                     "visits_per_week"]
    clusters_summary = []
    for j in range(k):
        size = int((labels == j).sum())
        clusters_summary.append({
            "cluster": j,
            "size": size,
            "centroid": {
                feature_names[m]: round(float(centroids_orig[j, m]), 2)
                for m in range(len(feature_names))
            },
        })

    return {
        "available": True,
        "k": k,
        "silhouette": round(sil, 3) if sil is not None else None,
        "explained_variance": [
            round(float(v), 3) for v in pca.explained_variance_ratio_
        ],
        "points": points,
        "clusters": clusters_summary,
    }


# ==================== Statistical comparison of programs ====================

def _holm_correction(p_values: list) -> list:
    """Поправка Холма на множественные сравнения."""
    n = len(p_values)
    indexed = sorted(enumerate(p_values), key=lambda x: x[1])
    adjusted = [0.0] * n
    running_max = 0.0
    for rank, (orig_idx, p) in enumerate(indexed):
        adj = min(1.0, p * (n - rank))
        running_max = max(running_max, adj)
        adjusted[orig_idx] = round(running_max, 5)
    return adjusted


def _cohens_d(a: list, b: list) -> float:
    a = np.array(a, dtype=float); b = np.array(b, dtype=float)
    if len(a) < 2 or len(b) < 2:
        return 0.0
    s1, s2 = a.var(ddof=1), b.var(ddof=1)
    pooled = math.sqrt(((len(a) - 1) * s1 + (len(b) - 1) * s2) / (len(a) + len(b) - 2))
    if pooled == 0:
        return 0.0
    return float((a.mean() - b.mean()) / pooled)


@app.get("/api/analytics/programs")
async def get_programs_analytics(
    metric: str = "weight_change",
    user: dict = Depends(require_roles("admin", "trainer")),
):
    """Сравнение эффективности программ по выбранной целевой метрике.

    Поддерживаемые метрики:
      weight_change       — снижение массы тела (в кг, отрицательное = снижение);
      bodyfat_change      — изменение процента жировой ткани;
      pushups_change      — прирост максимума отжиманий.
    """
    try:
        from scipy import stats
    except ImportError:
        return {"available": False, "reason": "scipy не установлен"}

    column_map = {
        "weight_change": "weight",
        "bodyfat_change": "body_fat_percentage",
        "pushups_change": "max_pushups",
    }
    if metric not in column_map:
        raise HTTPException(status_code=400, detail="Unknown metric")
    col = column_map[metric]

    with get_db() as conn:
        # Программы группируются по наименованию: одна и та же методика
        # может быть назначена многим клиентам как разные записи training_programs.
        programs = conn.execute(
            "SELECT name, GROUP_CONCAT(client_id) AS client_ids"
            " FROM training_programs"
            " GROUP BY name"
        ).fetchall()
        program_data: dict = {}
        for p in programs:
            if not p["client_ids"]:
                continue
            client_ids = [int(x) for x in p["client_ids"].split(",")]
            values: list = []
            for cid in set(client_ids):
                ms = conn.execute(
                    f"SELECT {col} FROM client_metrics WHERE client_id = ?"
                    f" AND {col} IS NOT NULL ORDER BY measurement_date",
                    (cid,),
                ).fetchall()
                if len(ms) >= 2:
                    values.append(float(ms[-1][0]) - float(ms[0][0]))
            if len(values) >= 3:
                program_data[p["name"]] = values

    if len(program_data) < 2:
        return {"available": False,
                "reason": "недостаточно программ с замерами клиентов"}

    # Проверка нормальности в каждой группе.
    normality = {}
    all_normal = True
    for name, vals in program_data.items():
        if len(vals) >= 3:
            stat, p_val = stats.shapiro(vals)
            normality[name] = {"statistic": round(float(stat), 3),
                                "p_value": round(float(p_val), 5)}
            if p_val < 0.05:
                all_normal = False

    program_names = list(program_data.keys())
    descriptive = [
        {
            "program": n,
            "n": len(v),
            "mean": round(float(np.mean(v)), 3),
            "std": round(float(np.std(v, ddof=1)), 3) if len(v) > 1 else 0.0,
            "median": round(float(np.median(v)), 3),
        }
        for n, v in program_data.items()
    ]

    # Глобальный тест по всем группам.
    samples = list(program_data.values())
    if all_normal:
        if len(samples) == 2:
            stat, p_val = stats.ttest_ind(samples[0], samples[1], equal_var=False)
            test_name = "Welch t-test"
        else:
            stat, p_val = stats.f_oneway(*samples)
            test_name = "One-way ANOVA"
    else:
        if len(samples) == 2:
            stat, p_val = stats.mannwhitneyu(samples[0], samples[1],
                                              alternative="two-sided")
            test_name = "Mann–Whitney U"
        else:
            stat, p_val = stats.kruskal(*samples)
            test_name = "Kruskal–Wallis"

    overall = {
        "test": test_name,
        "statistic": round(float(stat), 3),
        "p_value": round(float(p_val), 5),
    }

    # Попарные сравнения.
    pairwise: list = []
    raw_p: list = []
    for i in range(len(program_names)):
        for j in range(i + 1, len(program_names)):
            a = program_data[program_names[i]]
            b = program_data[program_names[j]]
            if all_normal:
                s, pv = stats.ttest_ind(a, b, equal_var=False)
                method = "Welch t-test"
            else:
                s, pv = stats.mannwhitneyu(a, b, alternative="two-sided")
                method = "Mann–Whitney U"
            d = _cohens_d(a, b)
            # 95% ДИ разности средних (нормальная аппроксимация).
            mean_diff = float(np.mean(a) - np.mean(b))
            se = math.sqrt(np.var(a, ddof=1) / len(a) + np.var(b, ddof=1) / len(b))
            ci = (round(mean_diff - 1.96 * se, 3), round(mean_diff + 1.96 * se, 3))
            pairwise.append({
                "program_a": program_names[i],
                "program_b": program_names[j],
                "method": method,
                "statistic": round(float(s), 3),
                "p_value": round(float(pv), 5),
                "cohens_d": round(d, 3),
                "mean_diff": round(mean_diff, 3),
                "ci95": ci,
            })
            raw_p.append(float(pv))

    holm = _holm_correction(raw_p)
    for i, hp in enumerate(holm):
        pairwise[i]["p_value_holm"] = hp

    return {
        "available": True,
        "metric": metric,
        "all_normal": all_normal,
        "normality": normality,
        "descriptive": descriptive,
        "overall_test": overall,
        "pairwise": pairwise,
    }


# ==================== Demo data generation ====================

@app.post("/api/demo/generate")
async def generate_demo_data(user: dict = Depends(require_roles("admin"))):
    """Генерация демонстрационных данных по предметной модели ВКР.

    Данные структурированы так, чтобы аналитические методы выдавали
    осмысленные инсайты: разная загрузка тренеров, неравномерность по
    дням недели, клиенты с разным риском оттока, программы с различной
    статистически значимой эффективностью.
    """
    with get_db() as conn:
        c = conn.cursor()
        # Обнуляем внешние ключи в users, чтобы не мешали очистке
        c.execute("UPDATE users SET trainer_id = NULL, client_id = NULL")
        for t in ["session_exercises", "training_sessions", "program_exercises",
                  "training_calendar", "training_programs", "client_metrics",
                  "client_goals", "recommendations", "exercises", "clients", "trainers"]:
            c.execute(f"DELETE FROM {t}")
            c.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}'")

        trainers = [
            ("Александр Петров", "Силовые тренировки", 8, 4.8),
            ("Мария Иванова", "Функциональный тренинг", 5, 4.9),
            ("Дмитрий Сидоров", "Кардио и выносливость", 6, 4.6),
            ("Елена Козлова", "Йога и растяжка", 10, 4.7),
            ("Игорь Волков", "Кроссфит", 4, 4.5),
            ("Анна Морозова", "Похудение", 7, 4.8),
        ]
        for t in trainers:
            c.execute(
                "INSERT INTO trainers (name, specialization, experience_years, rating)"
                " VALUES (?, ?, ?, ?)", t)

        exercises = [
            ("Жим штанги лёжа", "Грудь", "Трицепс", "Штанга", "medium", "силовая", 8),
            ("Приседания со штангой", "Ноги", "Спина, Кор", "Штанга", "hard", "силовая", 10),
            ("Становая тяга", "Спина", "Ноги, Кор", "Штанга", "hard", "силовая", 12),
            ("Подтягивания", "Спина", "Бицепс", "Турник", "medium", "силовая", 7),
            ("Отжимания", "Грудь", "Трицепс", "Без оборудования", "easy", "силовая", 5),
            ("Планка", "Кор", "Спина", "Без оборудования", "easy", "функциональная", 4),
            ("Бег на дорожке", "Кардио", "Ноги", "Беговая дорожка", "medium", "кардио", 10),
            ("Велотренажёр", "Кардио", "Ноги", "Велотренажёр", "easy", "кардио", 8),
            ("Жим гантелей сидя", "Плечи", "Трицепс", "Гантели", "medium", "силовая", 6),
            ("Сгибания на бицепс", "Руки", "Предплечья", "Гантели", "easy", "силовая", 4),
        ]
        for e in exercises:
            c.execute(
                "INSERT INTO exercises (name, muscle_group, secondary_muscle_groups,"
                " equipment, difficulty, load_type, calories_per_minute)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)", e)

        male_first_names = ["Иван", "Пётр", "Сергей", "Андрей", "Михаил", "Алексей",
                             "Николай", "Дмитрий", "Виктор", "Роман"]
        female_first_names = ["Анна", "Мария", "Елена", "Ольга", "Наталья",
                              "Татьяна", "Екатерина", "Юлия", "Светлана", "Ирина"]
        male_last_names = ["Смирнов", "Кузнецов", "Попов", "Васильев", "Петров",
                           "Соколов", "Михайлов", "Новиков", "Фёдоров", "Морозов",
                           "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров",
                           "Павлов", "Козлов", "Степанов"]
        female_last_names = ["Смирнова", "Кузнецова", "Попова", "Васильева", "Петрова",
                             "Соколова", "Михайлова", "Новикова", "Фёдорова", "Морозова",
                             "Волкова", "Алексеева", "Лебедева", "Семёнова", "Егорова",
                             "Павлова", "Козлова", "Степанова"]
        sub_types = ["basic", "standard", "premium", "vip"]
        goals = ["weight_loss", "muscle_gain", "endurance", "flexibility",
                 "general_fitness"]
        levels = ["beginner", "intermediate", "advanced"]
        genders = ["М", "Ж"]

        # --- Профили клиентов для вариативности риска оттока ---
        # loyal: много сессий, высокий satisfaction
        # regular: средние показатели
        # at_risk: мало сессий, низкий satisfaction, давно не были
        # churned: неактивные
        client_profile_cycle = (
            ["loyal"] * 20 + ["regular"] * 28 + ["at_risk"] * 16 + ["churned"] * 16
        )
        random.shuffle(client_profile_cycle)

        # Веса распределения сессий по дням недели (0=Вс..6=Сб)
        # Создаём неравномерность: пик в Пн/Ср/Пт, просадка во Вт/Чт/Вс
        DOW_WEIGHTS = [0, 28, 10, 24, 10, 22, 6]
        DOW_OPTIONS = list(range(7))

        # Веса тренеров: тренеры 3 и 5 не получают новых клиентов,
        # чтобы гарантировать рекомендацию о низкой загрузке.
        TRAINER_WEIGHTS = [25, 20, 0, 18, 0, 26]

        client_ids: list = []
        client_profiles: dict = {}
        for i in range(80):
            profile = client_profile_cycle[i]
            gender = random.choice(genders)
            if gender == "М":
                name = f"{random.choice(male_first_names)} {random.choice(male_last_names)}"
            else:
                name = f"{random.choice(female_first_names)} {random.choice(female_last_names)}"
            email = f"client{i+1}@example.com"
            phone = f"+7{random.randint(900, 999)}{random.randint(1000000, 9999999)}"
            birth = (f"{random.randint(1975, 2000)}-"
                     f"{random.randint(1, 12):02d}-{random.randint(1, 28):02d}")
            reg_days = random.randint(60, 730)
            reg_date = (datetime.now() - timedelta(days=reg_days)).strftime("%Y-%m-%d")
            sub_start = (datetime.now() - timedelta(
                days=random.randint(0, reg_days))).strftime("%Y-%m-%d")

            is_active = 0 if profile == "churned" else (1 if profile != "at_risk" else random.choice([0, 1]))
            height = round(random.uniform(160, 190), 1)
            goal = random.choice(goals)
            trainer_id = random.choices(range(1, len(trainers) + 1),
                                        weights=TRAINER_WEIGHTS, k=1)[0] if random.random() > 0.15 else None
            c.execute(
                """
                INSERT INTO clients (name, email, phone, birth_date, gender,
                    registration_date, subscription_type, subscription_start_date,
                    fitness_goal, fitness_level, is_active, height, trainer_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (name, email, phone, birth, gender, reg_date,
                 random.choice(sub_types), sub_start, goal,
                 random.choice(levels), is_active, height, trainer_id),
            )
            client_ids.append(c.lastrowid)
            client_profiles[c.lastrowid] = {
                "profile": profile,
                "goal": goal,
                "trainer_id": trainer_id,
            }

        # --- Программы с привязкой к целям и заданной эффективностью ---
        PROGRAM_META = {
            "Жиросжигание PRO": {
                "goal": "weight_loss",
                "weight_trend": -0.55,
                "bf_trend": -0.30,
                "pushups_trend": 0.3,
                "plank_trend": 3.0,
                "muscle_trend": -0.05,
            },
            "Набор массы": {
                "goal": "muscle_gain",
                "weight_trend": 0.35,
                "bf_trend": 0.10,
                "pushups_trend": 1.2,
                "plank_trend": 1.5,
                "muscle_trend": 0.25,
            },
            "Силовая база": {
                "goal": "muscle_gain",
                "weight_trend": 0.05,
                "bf_trend": -0.05,
                "pushups_trend": 1.8,
                "plank_trend": 4.0,
                "muscle_trend": 0.15,
            },
            "Выносливость+": {
                "goal": "endurance",
                "weight_trend": -0.25,
                "bf_trend": -0.15,
                "pushups_trend": 0.8,
                "plank_trend": 5.0,
                "muscle_trend": 0.0,
            },
            "Функциональный тренинг": {
                "goal": "general_fitness",
                "weight_trend": -0.15,
                "bf_trend": -0.08,
                "pushups_trend": 1.0,
                "plank_trend": 3.5,
                "muscle_trend": 0.05,
            },
            "Гибкость и баланс": {
                "goal": "flexibility",
                "weight_trend": -0.05,
                "bf_trend": -0.02,
                "pushups_trend": 0.2,
                "plank_trend": 2.0,
                "muscle_trend": 0.0,
            },
            "Кроссфит основы": {
                "goal": "general_fitness",
                "weight_trend": -0.30,
                "bf_trend": -0.20,
                "pushups_trend": 1.5,
                "plank_trend": 4.5,
                "muscle_trend": 0.10,
            },
            "Тонус тела": {
                "goal": "weight_loss",
                "weight_trend": -0.35,
                "bf_trend": -0.18,
                "pushups_trend": 0.6,
                "plank_trend": 2.5,
                "muscle_trend": 0.02,
            },
        }
        program_names = list(PROGRAM_META.keys())

        # Упражнения по типам для реалистичных сессий
        EX_BY_TYPE = {
            "силовая": [1, 2, 3, 4, 5, 9, 10],
            "кардио": [7, 8],
            "функциональная": [5, 6],
        }

        program_ids: list = []
        client_program_meta: dict = {}
        for cid in client_ids[:65]:
            prof = client_profiles[cid]
            # Выбираем программу, близкую к цели клиента
            suitable = [n for n, m in PROGRAM_META.items() if m["goal"] == prof["goal"]]
            if not suitable or random.random() < 0.25:
                pname = random.choice(program_names)
            else:
                pname = random.choice(suitable)
            meta = PROGRAM_META[pname]

            tid = prof["trainer_id"] or random.choices(range(1, len(trainers) + 1),
                                                        weights=TRAINER_WEIGHTS, k=1)[0]
            start_date = (datetime.now() - timedelta(
                days=random.randint(14, 120))).strftime("%Y-%m-%d")
            duration = random.randint(8, 16)
            c.execute(
                """
                INSERT INTO training_programs (client_id, trainer_id, name, goal,
                    duration_weeks, sessions_per_week, difficulty_level, start_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (cid, tid, pname, prof["goal"], duration,
                 random.randint(2, 4), random.choice(["easy", "medium", "hard"]), start_date),
            )
            program_ids.append((c.lastrowid, cid, tid))
            client_program_meta[cid] = meta

        # --- Сессии с привязкой к профилю клиента ---
        for pid, cid, tid in program_ids:
            profile = client_profiles[cid]["profile"]
            if profile == "loyal":
                num_sessions = random.randint(35, 70)
                sat_range = (4, 5)
                recency_bias = 0.85  # 85% сессий за последние 90 дней
            elif profile == "regular":
                num_sessions = random.randint(18, 38)
                sat_range = (3, 5)
                recency_bias = 0.60
            elif profile == "at_risk":
                num_sessions = random.randint(5, 16)
                sat_range = (1, 3)
                recency_bias = 0.20
            else:  # churned
                num_sessions = random.randint(6, 20)
                sat_range = (2, 4)
                recency_bias = 0.05

            # Генерируем даты сессий
            session_dates: list = []
            for _ in range(num_sessions):
                if random.random() < recency_bias:
                    days_ago = random.randint(0, 90)
                else:
                    days_ago = random.randint(91, 180)
                # Определяем день недели по весам (0=Вс как в strftime)
                target_dow = random.choices(DOW_OPTIONS, weights=DOW_WEIGHTS, k=1)[0]
                base_date = datetime.now() - timedelta(days=days_ago)
                # Переводим target_dow (0=Вс) в python weekday (0=Пн)
                target_py_dow = (target_dow - 1) % 7
                diff = (target_py_dow - base_date.weekday()) % 7
                sess_date = base_date + timedelta(days=diff)
                if sess_date > datetime.now():
                    sess_date -= timedelta(days=7)
                session_dates.append(sess_date)

            session_dates.sort()
            for sess_date in session_dates:
                sd = sess_date.strftime("%Y-%m-%d")
                # Реалистичное время: пик в 17-20, реже утро/день
                hour = random.choices(
                    [7, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19, 20],
                    weights=[3, 4, 5, 4, 3, 3, 5, 8, 12, 14, 12, 8],
                    k=1
                )[0]
                duration = random.randint(50, 90)
                calories = int(duration * random.uniform(5, 9))
                hr = random.randint(115, 155)
                fatigue = random.randint(3, 7)
                satisfaction = random.randint(sat_range[0], sat_range[1])

                c.execute(
                    """
                    INSERT INTO training_sessions (client_id, program_id, trainer_id,
                        session_date, start_time, duration_minutes, calories_burned,
                        avg_heart_rate, fatigue_level, satisfaction_rating)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (cid, pid, tid, sd, f"{hour:02d}:00",
                     duration, calories, hr, fatigue, satisfaction),
                )
                sid = c.lastrowid

                # Выбор упражнений по типу программы
                pmeta = client_program_meta.get(cid, {})
                if pmeta.get("goal") in ("weight_loss", "endurance"):
                    pool = EX_BY_TYPE["кардио"] + EX_BY_TYPE["функциональная"]
                elif pmeta.get("goal") == "muscle_gain":
                    pool = EX_BY_TYPE["силовая"]
                else:
                    pool = EX_BY_TYPE["силовая"] + EX_BY_TYPE["функциональная"]

                chosen = random.sample(pool, min(random.randint(3, 5), len(pool)))
                for eid in chosen:
                    c.execute(
                        """
                        INSERT INTO session_exercises (session_id, exercise_id,
                            actual_sets, actual_reps, actual_weight,
                            actual_duration_seconds, rpe)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (sid, eid, random.randint(2, 5), random.randint(6, 15),
                         random.choice([None, 20, 40, 60, 80]),
                         random.choice([None, 60, 120, 180, 300]),
                         random.randint(4, 9)),
                    )

        # --- Метрики с реалистичной динамикой ---
        for cid in client_ids[:55]:
            prof = client_profiles[cid]
            pmeta = client_program_meta.get(cid, {})
            num = random.randint(4, 10)
            base_w = round(random.uniform(60, 95), 1)
            base_bf = round(random.uniform(16, 32), 1)
            base_mm = round(random.uniform(32, 48), 1)
            base_push = random.randint(8, 25)
            base_plank = random.randint(20, 60)
            base_rest_hr = random.randint(58, 78)

            # Добавляем случайный шум к трендам
            w_trend = pmeta.get("weight_trend", -0.1) * random.uniform(0.7, 1.3)
            bf_trend = pmeta.get("bf_trend", -0.05) * random.uniform(0.7, 1.3)
            mm_trend = pmeta.get("muscle_trend", 0.0) * random.uniform(0.7, 1.3)
            pu_trend = pmeta.get("pushups_trend", 0.5) * random.uniform(0.7, 1.3)
            pl_trend = pmeta.get("plank_trend", 2.0) * random.uniform(0.7, 1.3)

            for i in range(num):
                days_ago = 180 - i * (180 // num)
                md = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
                weeks = i
                w = round(base_w + w_trend * weeks + random.uniform(-0.4, 0.4), 1)
                bf = round(base_bf + bf_trend * weeks + random.uniform(-0.3, 0.3), 1)
                mm = round(base_mm + mm_trend * weeks + random.uniform(-0.2, 0.2), 1)
                push = max(1, int(base_push + pu_trend * weeks + random.uniform(-1, 1)))
                plank = max(5, int(base_plank + pl_trend * weeks + random.uniform(-3, 3)))
                rhr = max(45, int(base_rest_hr - weeks * 0.3 + random.uniform(-2, 2)))
                c.execute(
                    """
                    INSERT INTO client_metrics (client_id, measurement_date, weight,
                        body_fat_percentage, muscle_mass, chest_cm, waist_cm,
                        resting_heart_rate, max_pushups, plank_seconds)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (cid, md, w, bf, mm,
                     round(random.uniform(85, 115), 1),
                     round(random.uniform(65, 95), 1), rhr, push, plank),
                )

            # Разнообразные цели
            goal_metrics = {
                "weight_loss": [("weight", base_w - random.uniform(3, 10)),
                                ("body_fat_percentage", base_bf - random.uniform(2, 6))],
                "muscle_gain": [("weight", base_w + random.uniform(2, 6)),
                                ("muscle_mass", base_mm + random.uniform(2, 5))],
                "endurance": [("max_pushups", base_push + random.uniform(10, 25)),
                              ("plank_seconds", base_plank + random.uniform(60, 120))],
                "flexibility": [("plank_seconds", base_plank + random.uniform(30, 90))],
                "general_fitness": [("weight", base_w - random.uniform(1, 4)),
                                    ("max_pushups", base_push + random.uniform(5, 15))],
            }
            for metric, target in goal_metrics.get(prof["goal"], []):
                c.execute(
                    "INSERT INTO client_goals (client_id, metric, target_value, target_date)"
                    " VALUES (?, ?, ?, ?)",
                    (cid, metric, round(target, 1),
                     (datetime.now() + timedelta(days=random.randint(60, 150))).strftime("%Y-%m-%d")),
                )

        # --- Календарь ---
        for pid, cid, tid in program_ids:
            prog = c.execute("SELECT start_date, duration_weeks, sessions_per_week"
                             " FROM training_programs WHERE id = ?", (pid,)).fetchone()
            if prog and prog["start_date"]:
                _generate_calendar(conn, pid, prog["start_date"],
                                   prog["duration_weeks"], prog["sessions_per_week"])

        c.execute("UPDATE users SET trainer_id = 1 WHERE login = 'trainer1'")
        c.execute("UPDATE users SET client_id = 1 WHERE login = 'client1'")

        _recompute_recommendations(conn)
        conn.commit()

    write_audit(user["id"], "generate_demo")
    return {
        "message": "Demo data generated",
        "stats": {
            "trainers": len(trainers),
            "exercises": len(exercises),
            "clients": len(client_ids),
            "programs": len(program_ids),
        },
    }


# ==================== Users management ====================

@app.get("/api/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.login, u.role, u.full_name, u.trainer_id, u.client_id,
                   u.is_active, u.created_at, t.name AS trainer_name, c.name AS client_name
              FROM users u
              LEFT JOIN trainers t ON u.trainer_id = t.id
              LEFT JOIN clients c ON u.client_id = c.id
             ORDER BY u.id DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]


@app.post("/api/users")
async def create_user(
    body: UserCreate,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as conn:
        # Проверка уникальности логина
        existing = conn.execute("SELECT id FROM users WHERE login = ?", (body.login,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Login already exists")
        cur = conn.execute(
            """
            INSERT INTO users (login, password_hash, role, full_name, trainer_id, client_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (body.login, _hash_password(body.password), body.role, body.full_name,
             body.trainer_id, body.client_id),
        )
        conn.commit()
    write_audit(user["id"], "create", "users", cur.lastrowid)
    return {"id": cur.lastrowid, "message": "User created"}


@app.put("/api/users/{user_id}")
async def update_user(
    user_id: int,
    body: UserUpdate,
    user: dict = Depends(require_roles("admin")),
):
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as conn:
        sets = ", ".join(f"{k} = ?" for k in fields)
        params = list(fields.values()) + [user_id]
        conn.execute(f"UPDATE users SET {sets} WHERE id = ?", params)
        conn.commit()
    write_audit(user["id"], "update", "users", user_id)
    return {"message": "User updated"}


@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as conn:
        conn.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))
        conn.commit()
    write_audit(user["id"], "soft_delete", "users", user_id)
    return {"message": "User deactivated"}


# ==================== Training Calendar ====================

@app.get("/api/programs/{program_id}/calendar")
async def get_program_calendar(
    program_id: int,
    user: dict = Depends(get_current_user),
):
    with get_db() as conn:
        program = conn.execute(
            "SELECT * FROM training_programs WHERE id = ?", (program_id,)
        ).fetchone()
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        if user["role"] == "client" and user.get("client_id") != program["client_id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        rows = conn.execute(
            """
            SELECT * FROM training_calendar
             WHERE program_id = ?
             ORDER BY planned_date
            """,
            (program_id,),
        ).fetchall()
        return [dict(r) for r in rows]


# ==================== Backup ====================

@app.post("/api/backup")
async def create_backup(user: dict = Depends(require_roles("admin"))):
    """Создаёт резервную копию базы данных."""
    import shutil
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"fitness_analytics.db.bak.{timestamp}"
    db_path = os.getenv("DATABASE", "fitness_analytics.db")
    shutil.copy2(db_path, backup_path)
    write_audit(user["id"], "backup", "system")
    return {"backup_file": backup_path, "message": "Backup created"}


@app.get("/api/backups")
async def list_backups(user: dict = Depends(require_roles("admin"))):
    import glob
    files = sorted(glob.glob("fitness_analytics.db.bak.*"), reverse=True)
    return {"backups": files}


# ==================== Static SPA fallback ====================

STATIC_DIR = os.getenv("STATIC_DIR", "")
if STATIC_DIR and os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=f"{STATIC_DIR}/assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(f"{STATIC_DIR}/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
