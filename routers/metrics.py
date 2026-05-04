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

# ==================== Client Metrics ====================

@router.get("/api/metrics/{client_id}")
async def get_client_metrics(
    client_id: int,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        rows = session.execute(
            select(ClientMetric)
            .where(ClientMetric.client_id == client_id)
            .order_by(ClientMetric.measurement_date.desc())
            .limit(limit)
        ).scalars().all()
        return [orm_to_dict(r) for r in rows]


@router.post("/api/metrics")
async def create_metrics(
    m: ClientMetricsCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), m.client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        metric = ClientMetric(
            client_id=m.client_id,
            measurement_date=m.measurement_date,
            weight=m.weight,
            body_fat_percentage=m.body_fat_percentage,
            muscle_mass=m.muscle_mass,
            chest_cm=m.chest_cm,
            waist_cm=m.waist_cm,
            hips_cm=m.hips_cm,
            biceps_cm=m.biceps_cm,
            thighs_cm=m.thighs_cm,
            resting_heart_rate=m.resting_heart_rate,
            max_pushups=m.max_pushups,
            max_pullups=m.max_pullups,
            plank_seconds=m.plank_seconds,
            run_5km_minutes=m.run_5km_minutes,
        )
        session.add(metric)
        session.commit()
        session.refresh(metric)
    return {"id": metric.id}


