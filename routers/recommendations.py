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

# ==================== Recommendations ====================

def _recompute_recommendations(conn) -> int:
    conn.execute("DELETE FROM recommendations WHERE is_applied = 0")
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
                "INSERT INTO recommendations (recommendation_type, title, description, priority) VALUES (?, ?, ?, ?)",
                (
                    "trainer_load",
                    f"Низкая загрузка тренера {r['name']}",
                    f"За последние 30 дней проведено {r['sessions']} сессий (менее 20). Рекомендуется перераспределить клиентов.",
                    8,
                ),
            )
        elif r["sessions"] > 40:
            conn.execute(
                "INSERT INTO recommendations (recommendation_type, title, description, priority) VALUES (?, ?, ?, ?)",
                (
                    "trainer_overload",
                    f"Высокая загрузка тренера {r['name']}",
                    f"За последние 30 дней проведено {r['sessions']} сессий (более 40). Рекомендуется перераспределить часть клиентов.",
                    7,
                ),
            )
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
                "INSERT INTO recommendations (recommendation_type, title, description, priority) VALUES (?, ?, ?, ?)",
                (
                    "weekday_load",
                    "Неравномерная посещаемость по дням недели",
                    f"Просадка посещений в дни: {', '.join(weak_days)}. Рекомендуется выровнять расписание или ввести стимулирующие акции.",
                    6,
                ),
            )
    return conn.execute("SELECT COUNT(*) FROM recommendations WHERE is_applied = 0").fetchone()[0]


@router.post("/api/recommendations/recompute")
async def recompute_recommendations(
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        n = _recompute_recommendations(conn)
        conn.commit()
    return {"count": n}


@router.get("/api/recommendations")
async def list_recommendations(
    include_applied: int = 0,
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        q = "SELECT * FROM recommendations"
        if not include_applied:
            q += " WHERE is_applied = 0"
        q += " ORDER BY priority DESC, created_at DESC"
        return [dict(r) for r in conn.execute(q).fetchall()]


@router.post("/api/recommendations/{rec_id}/apply")
async def apply_recommendation(
    rec_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        conn.execute("UPDATE recommendations SET is_applied = 1 WHERE id = ?", (rec_id,))
        conn.commit()
    return {"ok": True}


