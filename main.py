"""
Fitness Analytics Information System - Backend API
Система анализа персонализированных тренировочных программ
"""

from fastapi import FastAPI, HTTPException, Depends, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, timedelta
from enum import Enum
import sqlite3
import json
import random
from contextlib import contextmanager
import math
import hashlib
import secrets
import os

app = FastAPI(
    title="Fitness Analytics API",
    description="Система анализа персонализированных тренировочных программ",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE = os.getenv("DATABASE", "fitness_analytics.db")

# ==================== Database ====================

@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Клиенты
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                birth_date DATE,
                gender TEXT,
                registration_date DATE DEFAULT CURRENT_DATE,
                subscription_type TEXT DEFAULT 'basic',
                subscription_price REAL DEFAULT 3000,
                subscription_end DATE,
                fitness_goal TEXT,
                fitness_level TEXT DEFAULT 'beginner',
                health_restrictions TEXT,
                is_active INTEGER DEFAULT 1
            )
        """)
        
        # Тренеры
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS trainers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                specialization TEXT,
                experience_years INTEGER,
                hourly_rate REAL,
                rating REAL DEFAULT 4.5,
                clients_count INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1
            )
        """)
        
        # Тренировочные программы
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS training_programs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                trainer_id INTEGER,
                name TEXT NOT NULL,
                description TEXT,
                goal TEXT,
                duration_weeks INTEGER DEFAULT 12,
                sessions_per_week INTEGER DEFAULT 3,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active INTEGER DEFAULT 1,
                difficulty_level TEXT DEFAULT 'medium',
                FOREIGN KEY (client_id) REFERENCES clients(id),
                FOREIGN KEY (trainer_id) REFERENCES trainers(id)
            )
        """)
        
        # Упражнения
        cursor.execute("""
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
        
        # Упражнения в программе
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS program_exercises (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                program_id INTEGER NOT NULL,
                exercise_id INTEGER NOT NULL,
                sets INTEGER DEFAULT 3,
                reps INTEGER DEFAULT 12,
                weight REAL,
                rest_seconds INTEGER DEFAULT 60,
                day_of_week INTEGER,
                order_index INTEGER,
                FOREIGN KEY (program_id) REFERENCES training_programs(id),
                FOREIGN KEY (exercise_id) REFERENCES exercises(id)
            )
        """)
        
        # Тренировочные сессии (логи посещений)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS training_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                program_id INTEGER,
                trainer_id INTEGER,
                session_date DATE NOT NULL,
                start_time TIME,
                end_time TIME,
                duration_minutes INTEGER,
                calories_burned INTEGER,
                avg_heart_rate INTEGER,
                max_heart_rate INTEGER,
                fatigue_level INTEGER,
                satisfaction_rating INTEGER,
                notes TEXT,
                is_completed INTEGER DEFAULT 1,
                FOREIGN KEY (client_id) REFERENCES clients(id),
                FOREIGN KEY (program_id) REFERENCES training_programs(id),
                FOREIGN KEY (trainer_id) REFERENCES trainers(id)
            )
        """)
        
        # Метрики прогресса клиента
        cursor.execute("""
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
                notes TEXT,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        """)
        
        # Подписки и платежи
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                payment_date DATE DEFAULT CURRENT_DATE,
                payment_type TEXT,
                subscription_months INTEGER DEFAULT 1,
                description TEXT,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        """)
        
        # Рекомендации системы
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id INTEGER NOT NULL,
                recommendation_type TEXT,
                title TEXT,
                description TEXT,
                priority INTEGER DEFAULT 5,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_applied INTEGER DEFAULT 0,
                potential_value REAL,
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        """)

        # Пользователи системы (аутентификация)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                login TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'client',
                full_name TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                trainer_id INTEGER,
                client_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trainer_id) REFERENCES trainers(id),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )
        """)

        conn.commit()


# ==================== Auth helpers ====================

# Активные токены: token -> {user_id, role, full_name, login, trainer_id, client_id}
active_tokens: dict = {}


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
    return f"{salt}:{key.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, key_hex = stored.split(":", 1)
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 200_000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


def seed_demo_users():
    """Создаёт демо-пользователей при первом запуске."""
    demo = [
        ("admin",    "admin123",   "admin",   "Администратор системы", None, None),
        ("trainer1", "trainer123", "trainer", "Иван Петров (тренер)",  1,    None),
        ("client1",  "client123",  "client",  "Клиент (демо)",         None, 1),
    ]
    with get_db() as conn:
        for login, password, role, full_name, trainer_id, client_id in demo:
            existing = conn.execute(
                "SELECT id FROM users WHERE login = ?", (login,)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO users (login, password_hash, role, full_name, trainer_id, client_id) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (login, _hash_password(password), role, full_name, trainer_id, client_id),
                )
        conn.commit()


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency: извлекает пользователя из Bearer-токена."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    token = authorization.removeprefix("Bearer ").strip()
    user = active_tokens.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Токен недействителен или истёк")
    return user

# ==================== Pydantic Models ====================

class ClientCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    subscription_type: str = "basic"
    subscription_price: float = 3000
    fitness_goal: Optional[str] = None
    fitness_level: str = "beginner"
    health_restrictions: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    subscription_type: Optional[str] = None
    subscription_price: Optional[float] = None
    fitness_goal: Optional[str] = None
    fitness_level: Optional[str] = None
    health_restrictions: Optional[str] = None
    is_active: Optional[int] = None

class TrainingProgramCreate(BaseModel):
    client_id: int
    trainer_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: int = 12
    sessions_per_week: int = 3
    difficulty_level: str = "medium"

class TrainingSessionCreate(BaseModel):
    client_id: int
    program_id: Optional[int] = None
    trainer_id: Optional[int] = None
    session_date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    calories_burned: Optional[int] = None
    avg_heart_rate: Optional[int] = None
    max_heart_rate: Optional[int] = None
    fatigue_level: Optional[int] = None
    satisfaction_rating: Optional[int] = None
    notes: Optional[str] = None

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

class TrainerCreate(BaseModel):
    name: str
    specialization: Optional[str] = None
    experience_years: Optional[int] = None
    hourly_rate: Optional[float] = None

class LoginRequest(BaseModel):
    login: str
    password: str

class UserResponse(BaseModel):
    id: int
    login: str
    role: str
    full_name: str
    trainer_id: Optional[int] = None
    client_id: Optional[int] = None

# ==================== API Endpoints ====================

@app.on_event("startup")
async def startup():
    init_db()
    seed_demo_users()

# --- Auth ---

@app.post("/api/auth/login")
def login(body: LoginRequest):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, login, password_hash, role, full_name, trainer_id, client_id "
            "FROM users WHERE login = ? AND is_active = 1",
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
    return {"token": token, "user": user_info}


@app.get("/api/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@app.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        active_tokens.pop(token, None)
    return {"ok": True}

# --- Clients ---

@app.get("/api/clients")
async def get_clients(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[int] = None,
    subscription_type: Optional[str] = None,
    search: Optional[str] = None
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM clients WHERE 1=1"
        params = []
        
        if is_active is not None:
            query += " AND is_active = ?"
            params.append(is_active)
        if subscription_type:
            query += " AND subscription_type = ?"
            params.append(subscription_type)
        if search:
            query += " AND (name LIKE ? OR email LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        cursor.execute(query, params)
        clients = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute("SELECT COUNT(*) FROM clients")
        total = cursor.fetchone()[0]
        
        return {"clients": clients, "total": total}

@app.get("/api/clients/{client_id}")
async def get_client(client_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        client = cursor.fetchone()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        return dict(client)

@app.post("/api/clients")
async def create_client(client: ClientCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO clients (name, email, phone, birth_date, gender, 
                    subscription_type, subscription_price, fitness_goal, 
                    fitness_level, health_restrictions)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (client.name, client.email, client.phone, client.birth_date,
                  client.gender, client.subscription_type, client.subscription_price,
                  client.fitness_goal, client.fitness_level, client.health_restrictions))
            conn.commit()
            return {"id": cursor.lastrowid, "message": "Client created"}
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Email already exists")

@app.put("/api/clients/{client_id}")
async def update_client(client_id: int, client: ClientUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        updates = []
        params = []
        
        for field, value in client.dict(exclude_unset=True).items():
            if value is not None:
                updates.append(f"{field} = ?")
                params.append(value)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        params.append(client_id)
        query = f"UPDATE clients SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()
        
        return {"message": "Client updated"}

@app.delete("/api/clients/{client_id}")
async def delete_client(client_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE clients SET is_active = 0 WHERE id = ?", (client_id,))
        conn.commit()
        return {"message": "Client deactivated"}

# --- Trainers ---

@app.get("/api/trainers")
async def get_trainers():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM trainers WHERE is_active = 1 ORDER BY rating DESC")
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/trainers")
async def create_trainer(trainer: TrainerCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO trainers (name, specialization, experience_years, hourly_rate)
            VALUES (?, ?, ?, ?)
        """, (trainer.name, trainer.specialization, trainer.experience_years, trainer.hourly_rate))
        conn.commit()
        return {"id": cursor.lastrowid, "message": "Trainer created"}

# --- Training Programs ---

@app.get("/api/programs")
async def get_programs(client_id: Optional[int] = None, is_active: Optional[int] = 1):
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT tp.*, c.name as client_name, t.name as trainer_name
            FROM training_programs tp
            LEFT JOIN clients c ON tp.client_id = c.id
            LEFT JOIN trainers t ON tp.trainer_id = t.id
            WHERE 1=1
        """
        params = []
        
        if client_id:
            query += " AND tp.client_id = ?"
            params.append(client_id)
        if is_active is not None:
            query += " AND tp.is_active = ?"
            params.append(is_active)
        
        query += " ORDER BY tp.created_at DESC"
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/programs")
async def create_program(program: TrainingProgramCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO training_programs (client_id, trainer_id, name, description,
                goal, duration_weeks, sessions_per_week, difficulty_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (program.client_id, program.trainer_id, program.name, program.description,
              program.goal, program.duration_weeks, program.sessions_per_week, 
              program.difficulty_level))
        conn.commit()
        return {"id": cursor.lastrowid, "message": "Program created"}

# --- Training Sessions ---

@app.get("/api/sessions")
async def get_sessions(
    client_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT ts.*, c.name as client_name, tp.name as program_name, t.name as trainer_name
            FROM training_sessions ts
            LEFT JOIN clients c ON ts.client_id = c.id
            LEFT JOIN training_programs tp ON ts.program_id = tp.id
            LEFT JOIN trainers t ON ts.trainer_id = t.id
            WHERE 1=1
        """
        params = []
        
        if client_id:
            query += " AND ts.client_id = ?"
            params.append(client_id)
        if date_from:
            query += " AND ts.session_date >= ?"
            params.append(date_from)
        if date_to:
            query += " AND ts.session_date <= ?"
            params.append(date_to)
        
        query += " ORDER BY ts.session_date DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/sessions")
async def create_session(session: TrainingSessionCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO training_sessions (client_id, program_id, trainer_id,
                session_date, start_time, end_time, duration_minutes, calories_burned,
                avg_heart_rate, max_heart_rate, fatigue_level, satisfaction_rating, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (session.client_id, session.program_id, session.trainer_id,
              session.session_date, session.start_time, session.end_time,
              session.duration_minutes, session.calories_burned, session.avg_heart_rate,
              session.max_heart_rate, session.fatigue_level, session.satisfaction_rating,
              session.notes))
        conn.commit()
        return {"id": cursor.lastrowid, "message": "Session recorded"}

# --- Client Metrics ---

@app.get("/api/metrics/{client_id}")
async def get_client_metrics(client_id: int, limit: int = 50):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM client_metrics 
            WHERE client_id = ? 
            ORDER BY measurement_date DESC 
            LIMIT ?
        """, (client_id, limit))
        return [dict(row) for row in cursor.fetchall()]

@app.post("/api/metrics")
async def create_metrics(metrics: ClientMetricsCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO client_metrics (client_id, measurement_date, weight,
                body_fat_percentage, muscle_mass, chest_cm, waist_cm, hips_cm,
                biceps_cm, thighs_cm, resting_heart_rate, max_pushups, max_pullups,
                plank_seconds, run_5km_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (metrics.client_id, metrics.measurement_date, metrics.weight,
              metrics.body_fat_percentage, metrics.muscle_mass, metrics.chest_cm,
              metrics.waist_cm, metrics.hips_cm, metrics.biceps_cm, metrics.thighs_cm,
              metrics.resting_heart_rate, metrics.max_pushups, metrics.max_pullups,
              metrics.plank_seconds, metrics.run_5km_minutes))
        conn.commit()
        return {"id": cursor.lastrowid, "message": "Metrics recorded"}

# ==================== Analytics Endpoints ====================

@app.get("/api/analytics/dashboard")
async def get_dashboard_analytics():
    """Основные метрики для дашборда"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Общая статистика
        cursor.execute("SELECT COUNT(*) FROM clients WHERE is_active = 1")
        active_clients = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM clients")
        total_clients = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM trainers WHERE is_active = 1")
        active_trainers = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM training_programs WHERE is_active = 1")
        active_programs = cursor.fetchone()[0]
        
        # Выручка за текущий месяц
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM payments 
            WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')
        """)
        monthly_revenue = cursor.fetchone()[0]
        
        # Выручка за прошлый месяц для сравнения
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM payments 
            WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', date('now', '-1 month'))
        """)
        prev_monthly_revenue = cursor.fetchone()[0]
        
        revenue_growth = 0
        if prev_monthly_revenue > 0:
            revenue_growth = ((monthly_revenue - prev_monthly_revenue) / prev_monthly_revenue) * 100
        
        # Средний чек
        cursor.execute("SELECT AVG(subscription_price) FROM clients WHERE is_active = 1")
        avg_subscription = cursor.fetchone()[0] or 0
        
        # Посещаемость за последние 30 дней
        cursor.execute("""
            SELECT COUNT(*) FROM training_sessions 
            WHERE session_date >= date('now', '-30 days')
        """)
        sessions_30d = cursor.fetchone()[0]
        
        # Retention rate (клиенты с повторными посещениями)
        cursor.execute("""
            SELECT COUNT(DISTINCT client_id) FROM training_sessions 
            WHERE session_date >= date('now', '-30 days')
        """)
        active_visitors = cursor.fetchone()[0]
        
        retention_rate = (active_visitors / active_clients * 100) if active_clients > 0 else 0
        
        # Средняя удовлетворённость
        cursor.execute("""
            SELECT AVG(satisfaction_rating) FROM training_sessions 
            WHERE satisfaction_rating IS NOT NULL 
            AND session_date >= date('now', '-30 days')
        """)
        avg_satisfaction = cursor.fetchone()[0] or 0
        
        # Посещения по дням недели
        cursor.execute("""
            SELECT strftime('%w', session_date) as dow, COUNT(*) as cnt
            FROM training_sessions
            WHERE session_date >= date('now', '-30 days')
            GROUP BY dow
            ORDER BY dow
        """)
        visits_by_day = {row[0]: row[1] for row in cursor.fetchall()}
        days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
        visits_by_weekday = [{"day": days[i], "visits": visits_by_day.get(str(i), 0)} for i in range(7)]
        
        # Распределение по типам подписок
        cursor.execute("""
            SELECT subscription_type, COUNT(*) as cnt, AVG(subscription_price) as avg_price
            FROM clients WHERE is_active = 1
            GROUP BY subscription_type
        """)
        subscription_dist = [{"type": row[0], "count": row[1], "avg_price": row[2]} 
                           for row in cursor.fetchall()]
        
        # Топ тренеры по количеству сессий
        cursor.execute("""
            SELECT t.name, COUNT(ts.id) as sessions, AVG(ts.satisfaction_rating) as avg_rating
            FROM trainers t
            LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
            WHERE ts.session_date >= date('now', '-30 days')
            GROUP BY t.id
            ORDER BY sessions DESC
            LIMIT 5
        """)
        top_trainers = [{"name": row[0], "sessions": row[1], "rating": row[2] or 0} 
                       for row in cursor.fetchall()]
        
        # Динамика посещений за последние 12 недель
        cursor.execute("""
            SELECT strftime('%Y-%W', session_date) as week, COUNT(*) as cnt
            FROM training_sessions
            WHERE session_date >= date('now', '-84 days')
            GROUP BY week
            ORDER BY week
        """)
        weekly_visits = [{"week": row[0], "visits": row[1]} for row in cursor.fetchall()]
        
        return {
            "summary": {
                "active_clients": active_clients,
                "total_clients": total_clients,
                "active_trainers": active_trainers,
                "active_programs": active_programs,
                "monthly_revenue": round(monthly_revenue, 2),
                "revenue_growth": round(revenue_growth, 1),
                "avg_subscription": round(avg_subscription, 2),
                "sessions_30d": sessions_30d,
                "retention_rate": round(retention_rate, 1),
                "avg_satisfaction": round(avg_satisfaction, 2)
            },
            "visits_by_weekday": visits_by_weekday,
            "subscription_distribution": subscription_dist,
            "top_trainers": top_trainers,
            "weekly_visits": weekly_visits
        }

@app.get("/api/analytics/client/{client_id}")
async def get_client_analytics(client_id: int):
    """Детальная аналитика по клиенту"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Основная информация о клиенте
        cursor.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        client = cursor.fetchone()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        client = dict(client)
        
        # История посещений
        cursor.execute("""
            SELECT COUNT(*) as total_sessions,
                   AVG(duration_minutes) as avg_duration,
                   SUM(calories_burned) as total_calories,
                   AVG(satisfaction_rating) as avg_satisfaction
            FROM training_sessions
            WHERE client_id = ?
        """, (client_id,))
        session_stats = dict(cursor.fetchone())
        
        # Посещения по месяцам
        cursor.execute("""
            SELECT strftime('%Y-%m', session_date) as month, COUNT(*) as visits
            FROM training_sessions
            WHERE client_id = ?
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        """, (client_id,))
        monthly_visits = [{"month": row[0], "visits": row[1]} for row in cursor.fetchall()]
        
        # Прогресс метрик
        cursor.execute("""
            SELECT * FROM client_metrics
            WHERE client_id = ?
            ORDER BY measurement_date
        """, (client_id,))
        metrics_history = [dict(row) for row in cursor.fetchall()]
        
        # Анализ прогресса
        progress_analysis = analyze_client_progress(metrics_history)
        
        # Текущая программа
        cursor.execute("""
            SELECT tp.*, t.name as trainer_name
            FROM training_programs tp
            LEFT JOIN trainers t ON tp.trainer_id = t.id
            WHERE tp.client_id = ? AND tp.is_active = 1
            ORDER BY tp.created_at DESC
            LIMIT 1
        """, (client_id,))
        current_program = cursor.fetchone()
        current_program = dict(current_program) if current_program else None
        
        # Частота посещений
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT strftime('%W', session_date)) as weeks
            FROM training_sessions
            WHERE client_id = ? 
            AND session_date >= date('now', '-90 days')
        """, (client_id,))
        freq_data = cursor.fetchone()
        visits_per_week = freq_data[0] / max(freq_data[1], 1) if freq_data else 0
        
        # LTV расчёт
        cursor.execute("""
            SELECT SUM(amount) FROM payments WHERE client_id = ?
        """, (client_id,))
        total_payments = cursor.fetchone()[0] or 0
        
        # Churn risk score
        churn_risk = calculate_churn_risk(client, session_stats, visits_per_week)
        
        # Upsell potential
        upsell_potential = calculate_upsell_potential(client, session_stats, metrics_history)
        
        return {
            "client": client,
            "session_stats": session_stats,
            "monthly_visits": monthly_visits,
            "metrics_history": metrics_history,
            "progress_analysis": progress_analysis,
            "current_program": current_program,
            "visits_per_week": round(visits_per_week, 2),
            "total_payments": total_payments,
            "churn_risk": churn_risk,
            "upsell_potential": upsell_potential
        }

@app.get("/api/analytics/programs/effectiveness")
async def get_programs_effectiveness():
    """Анализ эффективности программ"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                tp.id,
                tp.name,
                tp.goal,
                tp.difficulty_level,
                t.name as trainer_name,
                COUNT(DISTINCT ts.id) as total_sessions,
                COUNT(DISTINCT tp.client_id) as clients_count,
                AVG(ts.satisfaction_rating) as avg_satisfaction,
                AVG(ts.duration_minutes) as avg_duration,
                SUM(ts.calories_burned) as total_calories
            FROM training_programs tp
            LEFT JOIN trainers t ON tp.trainer_id = t.id
            LEFT JOIN training_sessions ts ON tp.id = ts.program_id
            GROUP BY tp.id
            HAVING total_sessions > 0
            ORDER BY avg_satisfaction DESC
        """)
        
        programs = []
        for row in cursor.fetchall():
            program = dict(row)
            # Рассчитываем эффективность по комплексной метрике
            satisfaction = program['avg_satisfaction'] or 0
            sessions = program['total_sessions'] or 0
            
            # Effectiveness score: combination of satisfaction and engagement
            effectiveness_score = (satisfaction * 0.6 + min(sessions / 10, 5) * 0.4) * 20
            program['effectiveness_score'] = round(effectiveness_score, 1)
            programs.append(program)
        
        # Статистика по целям
        cursor.execute("""
            SELECT goal, COUNT(*) as count, AVG(ts.satisfaction_rating) as avg_satisfaction
            FROM training_programs tp
            LEFT JOIN training_sessions ts ON tp.id = ts.program_id
            WHERE goal IS NOT NULL
            GROUP BY goal
        """)
        goals_stats = [dict(row) for row in cursor.fetchall()]
        
        return {
            "programs": programs,
            "goals_stats": goals_stats
        }

@app.get("/api/analytics/revenue")
async def get_revenue_analytics():
    """Анализ выручки и финансовых показателей"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Выручка по месяцам
        cursor.execute("""
            SELECT strftime('%Y-%m', payment_date) as month, 
                   SUM(amount) as revenue,
                   COUNT(*) as transactions
            FROM payments
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        """)
        monthly_revenue = [{"month": row[0], "revenue": row[1], "transactions": row[2]} 
                         for row in cursor.fetchall()]
        
        # Выручка по типам подписок
        cursor.execute("""
            SELECT c.subscription_type, SUM(p.amount) as revenue, COUNT(p.id) as count
            FROM payments p
            JOIN clients c ON p.client_id = c.id
            GROUP BY c.subscription_type
        """)
        revenue_by_type = [{"type": row[0], "revenue": row[1], "count": row[2]} 
                         for row in cursor.fetchall()]
        
        # Средний чек по месяцам
        cursor.execute("""
            SELECT strftime('%Y-%m', payment_date) as month, AVG(amount) as avg_check
            FROM payments
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        """)
        avg_check_trend = [{"month": row[0], "avg_check": round(row[1], 2)} 
                         for row in cursor.fetchall()]
        
        # Прогноз выручки (простая линейная экстраполяция)
        if len(monthly_revenue) >= 3:
            recent_revenues = [r['revenue'] for r in monthly_revenue[:3]]
            avg_recent = sum(recent_revenues) / len(recent_revenues)
            growth_rate = (recent_revenues[0] - recent_revenues[-1]) / recent_revenues[-1] if recent_revenues[-1] > 0 else 0
            forecast_next_month = avg_recent * (1 + growth_rate / 3)
        else:
            forecast_next_month = 0
        
        # ARPU (Average Revenue Per User)
        cursor.execute("""
            SELECT AVG(total) as arpu FROM (
                SELECT client_id, SUM(amount) as total
                FROM payments
                WHERE payment_date >= date('now', '-30 days')
                GROUP BY client_id
            )
        """)
        arpu = cursor.fetchone()[0] or 0
        
        return {
            "monthly_revenue": monthly_revenue,
            "revenue_by_type": revenue_by_type,
            "avg_check_trend": avg_check_trend,
            "forecast_next_month": round(forecast_next_month, 2),
            "arpu": round(arpu, 2)
        }

@app.get("/api/analytics/churn")
async def get_churn_analytics():
    """Анализ оттока клиентов"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Клиенты с риском оттока
        cursor.execute("SELECT * FROM clients WHERE is_active = 1")
        clients = [dict(row) for row in cursor.fetchall()]
        
        at_risk_clients = []
        for client in clients:
            # Получаем данные о посещениях
            cursor.execute("""
                SELECT COUNT(*) as sessions, 
                       AVG(satisfaction_rating) as satisfaction,
                       MAX(session_date) as last_visit
                FROM training_sessions
                WHERE client_id = ?
            """, (client['id'],))
            stats = dict(cursor.fetchone())
            
            # Частота посещений за последние 30 дней
            cursor.execute("""
                SELECT COUNT(*) FROM training_sessions
                WHERE client_id = ? AND session_date >= date('now', '-30 days')
            """, (client['id'],))
            recent_visits = cursor.fetchone()[0]
            
            visits_per_week = recent_visits / 4.3 if recent_visits else 0
            
            churn_risk = calculate_churn_risk(client, stats, visits_per_week)
            
            if churn_risk['score'] > 50:
                at_risk_clients.append({
                    "client": client,
                    "risk": churn_risk,
                    "last_visit": stats.get('last_visit'),
                    "total_sessions": stats.get('sessions', 0)
                })
        
        # Сортируем по риску
        at_risk_clients.sort(key=lambda x: x['risk']['score'], reverse=True)
        
        # Статистика оттока
        cursor.execute("""
            SELECT COUNT(*) FROM clients WHERE is_active = 0
        """)
        churned_total = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT strftime('%Y-%m', registration_date) as month,
                   SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as churned,
                   COUNT(*) as total
            FROM clients
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        """)
        churn_by_month = [{"month": row[0], "churned": row[1], "total": row[2], 
                          "rate": round(row[1]/row[2]*100, 1) if row[2] > 0 else 0}
                        for row in cursor.fetchall()]
        
        return {
            "at_risk_clients": at_risk_clients[:20],  # Топ 20
            "churned_total": churned_total,
            "churn_by_month": churn_by_month,
            "risk_distribution": {
                "high": len([c for c in at_risk_clients if c['risk']['score'] > 70]),
                "medium": len([c for c in at_risk_clients if 50 < c['risk']['score'] <= 70]),
                "low": len(clients) - len(at_risk_clients)
            }
        }

@app.get("/api/analytics/recommendations")
async def get_system_recommendations():
    """Рекомендации системы для повышения эффективности бизнеса"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        recommendations = []
        
        # Анализ загрузки тренеров
        cursor.execute("""
            SELECT t.id, t.name, COUNT(ts.id) as sessions
            FROM trainers t
            LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
            AND ts.session_date >= date('now', '-30 days')
            WHERE t.is_active = 1
            GROUP BY t.id
        """)
        trainer_load = cursor.fetchall()
        
        for trainer in trainer_load:
            if trainer[2] < 20:
                recommendations.append({
                    "type": "trainer_optimization",
                    "priority": "medium",
                    "title": f"Низкая загрузка тренера {trainer[1]}",
                    "description": f"Тренер {trainer[1]} провёл только {trainer[2]} сессий за месяц. Рекомендуется увеличить маркетинговую активность или перераспределить клиентов.",
                    "potential_impact": 15000
                })
        
        # Анализ ценообразования
        cursor.execute("""
            SELECT subscription_type, AVG(subscription_price) as avg_price, 
                   COUNT(*) as count
            FROM clients WHERE is_active = 1
            GROUP BY subscription_type
        """)
        pricing_data = cursor.fetchall()
        
        basic_count = 0
        premium_count = 0
        for row in pricing_data:
            if row[0] == 'basic':
                basic_count = row[2]
            elif row[0] in ['premium', 'vip']:
                premium_count += row[2]
        
        if basic_count > 0 and premium_count / (basic_count + premium_count) < 0.3:
            recommendations.append({
                "type": "upsell_opportunity",
                "priority": "high",
                "title": "Низкая доля премиум подписок",
                "description": f"Только {round(premium_count/(basic_count+premium_count)*100, 1)}% клиентов имеют премиум подписки. Рекомендуется запустить программу апгрейда.",
                "potential_impact": basic_count * 1500  # Потенциальный доход от апгрейда
            })
        
        # Анализ посещаемости
        cursor.execute("""
            SELECT strftime('%w', session_date) as dow, COUNT(*) as cnt
            FROM training_sessions
            WHERE session_date >= date('now', '-30 days')
            GROUP BY dow
        """)
        dow_visits = {row[0]: row[1] for row in cursor.fetchall()}
        
        avg_visits = sum(dow_visits.values()) / 7 if dow_visits else 0
        low_days = [days[int(d)] for d, v in dow_visits.items() if v < avg_visits * 0.7]
        
        if low_days:
            recommendations.append({
                "type": "capacity_optimization",
                "priority": "medium",
                "title": "Низкая загрузка в определённые дни",
                "description": f"Низкая посещаемость в дни: {', '.join(low_days)}. Рекомендуется ввести специальные акции или групповые занятия.",
                "potential_impact": 10000
            })
        
        # Анализ удержания
        cursor.execute("""
            SELECT COUNT(*) FROM clients 
            WHERE is_active = 1 
            AND id NOT IN (
                SELECT DISTINCT client_id FROM training_sessions 
                WHERE session_date >= date('now', '-30 days')
            )
        """)
        inactive_clients = cursor.fetchone()[0]
        
        if inactive_clients > 5:
            recommendations.append({
                "type": "retention",
                "priority": "high",
                "title": f"{inactive_clients} клиентов не посещали зал более 30 дней",
                "description": "Рекомендуется запустить реактивационную кампанию: персональные звонки, специальные предложения, бесплатные персональные тренировки.",
                "potential_impact": inactive_clients * 3000
            })
        
        # Сортируем по приоритету и потенциальному воздействию
        priority_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda x: (priority_order.get(x['priority'], 2), -x['potential_impact']))
        
        return {
            "recommendations": recommendations,
            "total_potential_impact": sum(r['potential_impact'] for r in recommendations)
        }

# ==================== Helper Functions ====================

days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

def analyze_client_progress(metrics_history: list) -> dict:
    """Анализ прогресса клиента по метрикам"""
    if len(metrics_history) < 2:
        return {"status": "insufficient_data", "message": "Недостаточно данных для анализа"}
    
    first = metrics_history[0]
    last = metrics_history[-1]
    
    changes = {}
    insights = []
    
    # Анализ веса
    if first.get('weight') and last.get('weight'):
        weight_change = last['weight'] - first['weight']
        changes['weight'] = {
            "start": first['weight'],
            "current": last['weight'],
            "change": round(weight_change, 1),
            "percent": round(weight_change / first['weight'] * 100, 1)
        }
        
        if weight_change < -2:
            insights.append({"type": "positive", "message": f"Отличный прогресс! Снижение веса на {abs(weight_change):.1f} кг"})
        elif weight_change > 2:
            insights.append({"type": "warning", "message": f"Вес увеличился на {weight_change:.1f} кг. Рекомендуется пересмотреть программу питания"})
    
    # Анализ жировой массы
    if first.get('body_fat_percentage') and last.get('body_fat_percentage'):
        bf_change = last['body_fat_percentage'] - first['body_fat_percentage']
        changes['body_fat'] = {
            "start": first['body_fat_percentage'],
            "current": last['body_fat_percentage'],
            "change": round(bf_change, 1)
        }
        
        if bf_change < -1:
            insights.append({"type": "positive", "message": f"Снижение процента жира на {abs(bf_change):.1f}%"})
    
    # Анализ силовых показателей
    if first.get('max_pushups') and last.get('max_pushups'):
        pushup_change = last['max_pushups'] - first['max_pushups']
        if pushup_change > 5:
            insights.append({"type": "positive", "message": f"Улучшение в отжиманиях: +{pushup_change} повторений"})
    
    # Общая оценка прогресса
    positive_count = len([i for i in insights if i['type'] == 'positive'])
    warning_count = len([i for i in insights if i['type'] == 'warning'])
    
    if positive_count >= 2:
        overall_status = "excellent"
    elif positive_count >= 1:
        overall_status = "good"
    elif warning_count > positive_count:
        overall_status = "needs_attention"
    else:
        overall_status = "stable"
    
    return {
        "status": overall_status,
        "changes": changes,
        "insights": insights,
        "measurements_count": len(metrics_history)
    }

def calculate_churn_risk(client: dict, session_stats: dict, visits_per_week: float) -> dict:
    """Расчёт риска оттока клиента"""
    score = 0
    factors = []
    
    # Фактор 1: Частота посещений
    if visits_per_week < 1:
        score += 30
        factors.append("Низкая частота посещений")
    elif visits_per_week < 2:
        score += 15
        factors.append("Посещаемость ниже среднего")
    
    # Фактор 2: Удовлетворённость
    satisfaction = session_stats.get('avg_satisfaction') or 5
    if satisfaction < 3:
        score += 35
        factors.append("Низкая удовлетворённость")
    elif satisfaction < 4:
        score += 15
        factors.append("Удовлетворённость ниже среднего")
    
    # Фактор 3: Базовая подписка без апгрейда
    if client.get('subscription_type') == 'basic':
        # Проверяем давность регистрации
        try:
            reg_date = datetime.strptime(client.get('registration_date', ''), '%Y-%m-%d')
            months_since_reg = (datetime.now() - reg_date).days / 30
            if months_since_reg > 3:
                score += 10
                factors.append("Базовая подписка более 3 месяцев")
        except:
            pass
    
    # Фактор 4: Низкое количество сессий
    total_sessions = session_stats.get('total_sessions') or session_stats.get('sessions') or 0
    if total_sessions < 5:
        score += 20
        factors.append("Мало проведённых тренировок")
    
    # Определяем уровень риска
    if score >= 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"
    
    return {
        "score": min(score, 100),
        "level": level,
        "factors": factors
    }

def calculate_upsell_potential(client: dict, session_stats: dict, metrics_history: list) -> dict:
    """Расчёт потенциала для апсейла"""
    potential = 0
    opportunities = []
    
    # Если базовая подписка и активный клиент
    if client.get('subscription_type') == 'basic':
        sessions = session_stats.get('total_sessions') or session_stats.get('sessions') or 0
        satisfaction = session_stats.get('avg_satisfaction') or 0
        
        if sessions >= 10 and satisfaction >= 4:
            potential += 40
            opportunities.append({
                "type": "premium_upgrade",
                "title": "Апгрейд до Premium",
                "description": "Активный клиент с высокой удовлетворённостью - отличный кандидат на Premium",
                "additional_revenue": 2000
            })
    
    # Если есть прогресс в метриках
    if len(metrics_history) >= 2:
        progress = analyze_client_progress(metrics_history)
        if progress.get('status') in ['excellent', 'good']:
            potential += 30
            opportunities.append({
                "type": "personal_training",
                "title": "Персональные тренировки",
                "description": "Клиент показывает прогресс - может быть заинтересован в персональном тренере",
                "additional_revenue": 5000
            })
    
    # Если нет программы питания
    if client.get('fitness_goal') in ['weight_loss', 'muscle_gain']:
        potential += 20
        opportunities.append({
            "type": "nutrition_plan",
            "title": "План питания",
            "description": f"Цель клиента ({client.get('fitness_goal')}) требует правильного питания",
            "additional_revenue": 3000
        })
    
    return {
        "score": min(potential, 100),
        "opportunities": opportunities,
        "total_additional_revenue": sum(o['additional_revenue'] for o in opportunities)
    }

# ==================== Data Generation for Demo ====================

@app.post("/api/demo/generate")
async def generate_demo_data():
    """Генерация демонстрационных данных"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Очищаем существующие данные
        tables = ['recommendations', 'payments', 'client_metrics', 'training_sessions', 
                  'program_exercises', 'training_programs', 'exercises', 'clients', 'trainers']
        for table in tables:
            cursor.execute(f"DELETE FROM {table}")
        
        # Тренеры
        trainers_data = [
            ("Александр Петров", "Силовые тренировки", 8, 2500, 4.8),
            ("Мария Иванова", "Функциональный тренинг", 5, 2000, 4.9),
            ("Дмитрий Сидоров", "Кардио и выносливость", 6, 2200, 4.6),
            ("Елена Козлова", "Йога и растяжка", 10, 1800, 4.7),
            ("Игорь Волков", "Кроссфит", 4, 2300, 4.5),
            ("Анна Морозова", "Похудение", 7, 2100, 4.8),
        ]
        
        for t in trainers_data:
            cursor.execute("""
                INSERT INTO trainers (name, specialization, experience_years, hourly_rate, rating)
                VALUES (?, ?, ?, ?, ?)
            """, t)
        
        # Упражнения
        exercises_data = [
            ("Жим штанги лёжа", "Грудь", "Штанга", "medium", 8),
            ("Приседания со штангой", "Ноги", "Штанга", "hard", 10),
            ("Становая тяга", "Спина", "Штанга", "hard", 12),
            ("Подтягивания", "Спина", "Турник", "medium", 7),
            ("Отжимания", "Грудь", "Без оборудования", "easy", 5),
            ("Планка", "Кор", "Без оборудования", "easy", 4),
            ("Бег на дорожке", "Кардио", "Беговая дорожка", "medium", 10),
            ("Велотренажёр", "Кардио", "Велотренажёр", "easy", 8),
            ("Жим гантелей сидя", "Плечи", "Гантели", "medium", 6),
            ("Сгибания на бицепс", "Руки", "Гантели", "easy", 4),
        ]
        
        for e in exercises_data:
            cursor.execute("""
                INSERT INTO exercises (name, muscle_group, equipment, difficulty, calories_per_minute)
                VALUES (?, ?, ?, ?, ?)
            """, e)
        
        # Клиенты
        first_names = ["Иван", "Пётр", "Сергей", "Андрей", "Михаил", "Алексей", "Николай", 
                       "Дмитрий", "Анна", "Мария", "Елена", "Ольга", "Наталья", "Татьяна",
                       "Екатерина", "Юлия", "Светлана", "Ирина", "Виктор", "Роман"]
        last_names = ["Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов",
                      "Михайлов", "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев",
                      "Лебедев", "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов"]
        
        subscription_types = [
            ("basic", 3000), ("basic", 3500), ("standard", 5000), 
            ("premium", 8000), ("vip", 15000)
        ]
        goals = ["weight_loss", "muscle_gain", "endurance", "flexibility", "general_fitness"]
        levels = ["beginner", "intermediate", "advanced"]
        genders = ["М", "Ж"]
        
        client_ids = []
        for i in range(80):
            name = f"{random.choice(first_names)} {random.choice(last_names)}"
            email = f"client{i+1}@example.com"
            phone = f"+7{random.randint(900, 999)}{random.randint(1000000, 9999999)}"
            
            birth_year = random.randint(1970, 2005)
            birth_month = random.randint(1, 12)
            birth_day = random.randint(1, 28)
            birth_date = f"{birth_year}-{birth_month:02d}-{birth_day:02d}"
            
            gender = random.choice(genders)
            
            # Дата регистрации за последние 2 года
            reg_days_ago = random.randint(1, 730)
            reg_date = (datetime.now() - timedelta(days=reg_days_ago)).strftime('%Y-%m-%d')
            
            sub_type, sub_price = random.choice(subscription_types)
            # Добавляем вариативность в цену
            sub_price = sub_price + random.randint(-500, 500)
            
            goal = random.choice(goals)
            level = random.choice(levels)
            
            is_active = 1 if random.random() > 0.15 else 0  # 15% отток
            
            cursor.execute("""
                INSERT INTO clients (name, email, phone, birth_date, gender, 
                    registration_date, subscription_type, subscription_price,
                    fitness_goal, fitness_level, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (name, email, phone, birth_date, gender, reg_date, 
                  sub_type, sub_price, goal, level, is_active))
            client_ids.append(cursor.lastrowid)
        
        # Тренировочные программы
        program_names = [
            "Силовая база", "Жиросжигание PRO", "Функциональный тренинг",
            "Набор массы", "Выносливость+", "Гибкость и баланс",
            "Кроссфит основы", "Тонус тела", "Спортивная подготовка"
        ]
        
        program_ids = []
        for client_id in client_ids[:60]:  # Программы для 60 клиентов
            trainer_id = random.randint(1, 6)
            name = random.choice(program_names)
            
            cursor.execute("""
                INSERT INTO training_programs (client_id, trainer_id, name, goal,
                    duration_weeks, sessions_per_week, difficulty_level)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (client_id, trainer_id, name, random.choice(goals),
                  random.randint(8, 16), random.randint(2, 5),
                  random.choice(['easy', 'medium', 'hard'])))
            program_ids.append((cursor.lastrowid, client_id, trainer_id))
        
        # Тренировочные сессии (за последние 6 месяцев)
        for program_id, client_id, trainer_id in program_ids:
            num_sessions = random.randint(15, 80)
            
            for _ in range(num_sessions):
                days_ago = random.randint(0, 180)
                session_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
                
                start_hour = random.randint(7, 20)
                duration = random.randint(45, 120)
                
                cursor.execute("""
                    INSERT INTO training_sessions (client_id, program_id, trainer_id,
                        session_date, start_time, duration_minutes, calories_burned,
                        avg_heart_rate, max_heart_rate, fatigue_level, satisfaction_rating)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (client_id, program_id, trainer_id, session_date,
                      f"{start_hour:02d}:00", duration,
                      random.randint(200, 800),
                      random.randint(100, 140),
                      random.randint(150, 185),
                      random.randint(3, 8),
                      random.randint(3, 5)))
        
        # Метрики клиентов
        for client_id in client_ids[:50]:
            num_measurements = random.randint(3, 12)
            
            base_weight = random.uniform(55, 100)
            base_bf = random.uniform(15, 35)
            
            for i in range(num_measurements):
                days_ago = 180 - (i * (180 // num_measurements))
                meas_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
                
                # Симулируем прогресс
                weight_change = random.uniform(-0.5, 0.3) * (num_measurements - i)
                bf_change = random.uniform(-0.3, 0.2) * (num_measurements - i)
                
                cursor.execute("""
                    INSERT INTO client_metrics (client_id, measurement_date, weight,
                        body_fat_percentage, muscle_mass, chest_cm, waist_cm, 
                        resting_heart_rate, max_pushups, plank_seconds)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (client_id, meas_date,
                      round(base_weight + weight_change, 1),
                      round(base_bf + bf_change, 1),
                      round(random.uniform(30, 50), 1),
                      round(random.uniform(85, 120), 1),
                      round(random.uniform(65, 95), 1),
                      random.randint(55, 80),
                      random.randint(10, 50) + i * 2,
                      random.randint(30, 180) + i * 5))
        
        # Платежи
        for client_id in client_ids:
            cursor.execute("""
                SELECT registration_date, subscription_price FROM clients WHERE id = ?
            """, (client_id,))
            client_data = cursor.fetchone()
            
            try:
                reg_date = datetime.strptime(client_data[0], '%Y-%m-%d')
                price = client_data[1]
                
                # Генерируем ежемесячные платежи
                current_date = reg_date
                while current_date < datetime.now():
                    cursor.execute("""
                        INSERT INTO payments (client_id, amount, payment_date, 
                            payment_type, subscription_months)
                        VALUES (?, ?, ?, ?, ?)
                    """, (client_id, price, current_date.strftime('%Y-%m-%d'),
                          'subscription', 1))
                    current_date += timedelta(days=30)
            except:
                pass
        
        conn.commit()
        
        return {
            "message": "Demo data generated successfully",
            "stats": {
                "trainers": 6,
                "clients": len(client_ids),
                "programs": len(program_ids),
                "exercises": len(exercises_data)
            }
        }

STATIC_DIR = os.getenv("STATIC_DIR", "")
if STATIC_DIR and os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=f"{STATIC_DIR}/assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(f"{STATIC_DIR}/index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
