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

# ==================== Sessions ====================

@router.get("/api/sessions")
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
    with get_db() as session:
        trainer_filter = None
        if user["role"] == "trainer":
            trainer_filter = user.get("trainer_id")
            if client_id and trainer_filter:
                if not _check_trainer_owns_client(session, trainer_filter, client_id):
                    raise HTTPException(status_code=403, detail="Недостаточно прав")
        stmt = (
            select(TrainingSession, Client.name.label("client_name"), TrainingProgram.name.label("program_name"), Trainer.name.label("trainer_name"))
            .join(Client, TrainingSession.client_id == Client.id, isouter=True)
            .join(TrainingProgram, TrainingSession.program_id == TrainingProgram.id, isouter=True)
            .join(Trainer, TrainingSession.trainer_id == Trainer.id, isouter=True)
        )
        if client_id:
            stmt = stmt.where(TrainingSession.client_id == client_id)
        if trainer_filter is not None:
            stmt = stmt.where(TrainingSession.client_id.in_(select(Client.id).where(Client.trainer_id == trainer_filter)))
        if date_from:
            stmt = stmt.where(TrainingSession.session_date >= date_from)
        if date_to:
            stmt = stmt.where(TrainingSession.session_date <= date_to)
        stmt = stmt.order_by(TrainingSession.session_date.desc()).limit(limit)
        rows = session.execute(stmt).all()
        return [{**orm_to_dict(r.TrainingSession), "client_name": r.client_name, "program_name": r.program_name, "trainer_name": r.trainer_name} for r in rows]


@router.post("/api/sessions")
async def create_session(
    session_data: TrainingSessionCreate,
    user: dict = Depends(require_roles("admin", "trainer", "client")),
):
    with get_db() as session:
        if user["role"] == "client":
            if user.get("client_id") != session_data.client_id:
                raise HTTPException(status_code=403, detail="Недостаточно прав")
        if user["role"] == "trainer":
            if not _check_trainer_owns_client(session, user.get("trainer_id"), session_data.client_id):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
        trainer_id = session_data.trainer_id
        if trainer_id is None:
            client = session.execute(select(Client).where(Client.id == session_data.client_id)).scalar_one_or_none()
            if client and client.trainer_id:
                trainer_id = client.trainer_id
        if user["role"] == "trainer":
            trainer_id = user.get("trainer_id")
        db_session = TrainingSession(
            client_id=session_data.client_id,
            program_id=session_data.program_id,
            trainer_id=trainer_id,
            session_date=session_data.session_date,
            start_time=session_data.start_time,
            duration_minutes=session_data.duration_minutes,
            calories_burned=session_data.calories_burned,
            fatigue_level=session_data.fatigue_level,
            satisfaction_rating=session_data.satisfaction_rating,
            comment=session_data.comment,
        )
        session.add(db_session)
        session.commit()
        session.refresh(db_session)
        session_id = db_session.id

        total_exercise_calories = 0
        if session_data.program_id:
            program_exercises = session.execute(
                select(ProgramExercise, Exercise.calories_per_minute)
                .join(Exercise, ProgramExercise.exercise_id == Exercise.id)
                .where(ProgramExercise.program_id == session_data.program_id)
                .order_by(ProgramExercise.order_number, ProgramExercise.id)
            ).all()
            if program_exercises and session_data.duration_minutes:
                minutes_per_exercise = session_data.duration_minutes / len(program_exercises)
            else:
                minutes_per_exercise = None
            for pe, cpm in program_exercises:
                exercise_calories = None
                if cpm and minutes_per_exercise:
                    exercise_calories = round(cpm * minutes_per_exercise)
                session.add(SessionExercise(
                    session_id=session_id,
                    exercise_id=pe.exercise_id,
                    program_exercise_id=pe.id,
                    actual_sets=pe.sets,
                    actual_reps=pe.reps,
                    actual_weight=pe.weight,
                    actual_duration_seconds=int(minutes_per_exercise * 60) if minutes_per_exercise else None,
                    rpe=None,
                    calories_burned=exercise_calories,
                ))
                if exercise_calories:
                    total_exercise_calories += exercise_calories
            if total_exercise_calories and not session_data.calories_burned:
                db_session.calories_burned = total_exercise_calories
                session.commit()
    return {"id": session_id, "message": "Session recorded"}


@router.post("/api/sessions/{session_id}/exercises")
async def add_session_exercise(
    session_id: int,
    se: SessionExerciseCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    if se.session_id != session_id:
        raise HTTPException(status_code=400, detail="session_id mismatch")
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_session(session, user.get("trainer_id"), session_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        calories = se.calories_burned
        if calories is None and se.actual_duration_seconds:
            ex = session.execute(select(Exercise).where(Exercise.id == se.exercise_id)).scalar_one_or_none()
            if ex and ex.calories_per_minute:
                calories = round(ex.calories_per_minute * (se.actual_duration_seconds / 60))
        exercise = SessionExercise(
            session_id=session_id,
            exercise_id=se.exercise_id,
            program_exercise_id=se.program_exercise_id,
            actual_sets=se.actual_sets,
            actual_reps=se.actual_reps,
            actual_weight=se.actual_weight,
            actual_duration_seconds=se.actual_duration_seconds,
            rpe=se.rpe,
            calories_burned=calories,
        )
        session.add(exercise)
        session.commit()
        session.refresh(exercise)
    return {"id": exercise.id}


@router.get("/api/sessions/{session_id}/exercises")
async def get_session_exercises(
    session_id: int,
    user: dict = Depends(get_current_user),
):
    with get_db() as session:
        if user["role"] == "client":
            sess = session.execute(select(TrainingSession).where(TrainingSession.id == session_id)).scalar_one_or_none()
            if not sess or sess.client_id != user.get("client_id"):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
        elif user["role"] == "trainer":
            if not _check_trainer_owns_session(session, user.get("trainer_id"), session_id):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
        rows = session.execute(
            select(SessionExercise, Exercise.name.label("exercise_name"), Exercise.calories_per_minute)
            .join(Exercise, SessionExercise.exercise_id == Exercise.id)
            .where(SessionExercise.session_id == session_id)
        ).all()
        return [{**orm_to_dict(r.SessionExercise), "exercise_name": r.exercise_name, "calories_per_minute": r.calories_per_minute} for r in rows]


