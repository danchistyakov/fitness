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

# ==================== Trainers ====================

@router.get("/api/trainers")
async def get_trainers(user: dict = Depends(get_current_user)):
    with get_db() as session:
        rows = session.execute(select(Trainer).where(Trainer.is_active.is_(True)).order_by(Trainer.rating.desc())).scalars().all()
        return [orm_to_dict(r) for r in rows]


class TrainerUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    experience_years: Optional[int] = None
    rating: Optional[float] = Field(None, ge=0, le=5)
    is_active: Optional[bool] = None


@router.post("/api/trainers")
async def create_trainer(
    trainer: TrainerCreate,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        db_trainer = Trainer(name=trainer.name, specialization=trainer.specialization, experience_years=trainer.experience_years)
        session.add(db_trainer)
        session.commit()
        session.refresh(db_trainer)
        trainer_id = db_trainer.id
        # Автоматическое создание учётной записи
        login = f"trainer{trainer_id:02d}"
        existing_user = session.execute(select(User).where(User.login == login)).scalar_one_or_none()
        if not existing_user:
            user_record = User(
                login=login,
                password_hash=_hash_password(login),
                role="trainer",
                full_name=db_trainer.name,
                trainer_id=trainer_id,
            )
            session.add(user_record)
            session.commit()
    return {"id": trainer_id, "message": "Trainer created", "login": login}


@router.put("/api/trainers/{trainer_id}")
async def update_trainer(
    trainer_id: int,
    trainer: TrainerUpdate,
    user: dict = Depends(require_roles("admin")),
):
    fields = trainer.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as session:
        session.execute(update(Trainer).where(Trainer.id == trainer_id).values(**fields))
        session.commit()
    return {"message": "Trainer updated"}


@router.delete("/api/trainers/{trainer_id}")
async def delete_trainer(
    trainer_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        session.execute(update(Trainer).where(Trainer.id == trainer_id).values(is_active=False))
        session.commit()
    return {"message": "Trainer deactivated"}


