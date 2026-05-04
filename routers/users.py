from typing import Optional, List
from datetime import datetime, timedelta
import math
import os
import random
import secrets
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select, insert, update, delete, func, text
from sqlalchemy.orm import Session

from db import engine, SessionLocal
from dependencies import (
    get_db, get_db_raw, orm_to_dict,
    get_current_user, require_roles,
    _check_trainer_owns_client, _check_trainer_owns_program,
    _check_trainer_owns_session, _check_trainer_owns_client_raw,
    _hash_password, _verify_password,
    DAY_NAMES, PBKDF2_ITERATIONS, active_tokens,
)
from schemas import *
from models import (
    Client, Trainer, Exercise, TrainingProgram, ProgramExercise,
    TrainingSession, SessionExercise, ClientMetric, ClientGoal,
    Recommendation, User, TrainingCalendar
)
import numpy as np

router = APIRouter()

# ==================== Users management ====================

@router.get("/api/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    with get_db_raw() as conn:
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


@router.post("/api/users")
async def create_user(
    body: UserCreate,
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
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
    return {"id": cur.lastrowid, "message": "User created"}


@router.put("/api/users/{user_id}")
async def update_user(
    user_id: int,
    body: UserUpdate,
    user: dict = Depends(require_roles("admin")),
):
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db_raw() as conn:
        sets = ", ".join(f"{k} = ?" for k in fields)
        params = list(fields.values()) + [user_id]
        conn.execute(f"UPDATE users SET {sets} WHERE id = ?", params)
        conn.commit()
    return {"message": "User updated"}


@router.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        conn.execute("UPDATE users SET is_active = 0 WHERE id = ?", (user_id,))
        conn.commit()
    return {"message": "User deactivated"}
