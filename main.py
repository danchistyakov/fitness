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
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from dependencies import init_db, seed_demo_users, seed_demo_trainers
from routers.auth import router as auth_router
from routers.clients import router as clients_router
from routers.trainers import router as trainers_router
from routers.exercises import router as exercises_router
from routers.programs import router as programs_router
from routers.sessions import router as sessions_router
from routers.metrics import router as metrics_router
from routers.goals import router as goals_router
from routers.recommendations import router as recommendations_router
from routers.analytics import router as analytics_router
from routers.demo import router as demo_router
from routers.users import router as users_router

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


# ==================== Startup ====================

@app.on_event("startup")
async def startup():
    init_db()
    seed_demo_users()
    seed_demo_trainers()


app.include_router(auth_router)
app.include_router(clients_router)
app.include_router(trainers_router)
app.include_router(exercises_router)
app.include_router(programs_router)
app.include_router(sessions_router)
app.include_router(metrics_router)
app.include_router(goals_router)
app.include_router(recommendations_router)
app.include_router(analytics_router)
app.include_router(users_router)
app.include_router(demo_router)

# ==================== Static files ====================

STATIC_DIR = os.getenv("STATIC_DIR", "frontend/dist")

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=f"{STATIC_DIR}/assets"), name="assets")


@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
