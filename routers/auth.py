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

# ==================== Auth ====================

@router.post("/api/auth/login")
def login(body: LoginRequest, request: Request):
    with get_db() as session:
        user = session.execute(
            select(User).where(User.login == body.login, User.is_active.is_(True))
        ).scalar_one_or_none()
    if not user or not _verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = secrets.token_hex(32)
    user_info = {
        "id": user.id,
        "login": user.login,
        "role": user.role,
        "full_name": user.full_name,
        "trainer_id": user.trainer_id,
        "client_id": user.client_id,
    }
    active_tokens[token] = user_info
    return {"token": token, "user": user_info}


@router.get("/api/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    return current_user


@router.post("/api/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        active_tokens.pop(token, None)
    return {"ok": True}


