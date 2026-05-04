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

# ==================== Exercises ====================

@router.get("/api/exercises")
async def get_exercises(
    muscle_group: Optional[str] = None,
    difficulty: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    with get_db() as session:
        stmt = select(Exercise)
        if muscle_group:
            stmt = stmt.where(Exercise.muscle_group == muscle_group)
        if difficulty:
            stmt = stmt.where(Exercise.difficulty == difficulty)
        if search:
            stmt = stmt.where(Exercise.name.ilike(f"%{search}%"))
        stmt = stmt.order_by(Exercise.name)
        return [orm_to_dict(r) for r in session.execute(stmt).scalars().all()]


@router.post("/api/exercises")
async def create_exercise(
    ex: ExerciseCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as session:
        exercise = Exercise(
            name=ex.name,
            muscle_group=ex.muscle_group,
            secondary_muscle_groups=ex.secondary_muscle_groups,
            equipment=ex.equipment,
            difficulty=ex.difficulty,
            load_type=ex.load_type,
            calories_per_minute=ex.calories_per_minute,
            description=ex.description,
        )
        session.add(exercise)
        session.commit()
        session.refresh(exercise)
    return {"id": exercise.id, "message": "Exercise created"}


@router.put("/api/exercises/{exercise_id}")
async def update_exercise(
    exercise_id: int,
    ex: ExerciseUpdate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    fields = ex.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as session:
        session.execute(update(Exercise).where(Exercise.id == exercise_id).values(**fields))
        session.commit()
    return {"message": "Exercise updated"}


@router.delete("/api/exercises/{exercise_id}")
async def delete_exercise(
    exercise_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        session.execute(delete(Exercise).where(Exercise.id == exercise_id))
        session.commit()
    return {"message": "Exercise deleted"}


