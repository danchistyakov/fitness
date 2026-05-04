#!/usr/bin/env python3
"""Разбивает main.py на модули с использованием FastAPI APIRouter."""

import re
from pathlib import Path

SRC = Path("main.py").read_text(encoding="utf-8")
lines = SRC.splitlines(keepends=True)

# Общий шаблон импортов для каждого роутера
COMMON_IMPORTS = '''\
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
    _hash_password, _verify_password, _generate_calendar_raw,
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

'''

# Секции и их имена
SECTION_MAP = [
    ("# ==================== Auth ====================", "auth"),
    ("# ==================== Clients ====================", "clients"),
    ("# ==================== Trainers ====================", "trainers"),
    ("# ==================== Exercises ====================", "exercises"),
    ("# ==================== Programs ====================", "programs"),
    ("# ==================== Sessions ====================", "sessions"),
    ("# ==================== Client Metrics ====================", "metrics"),
    ("# ==================== Client Goals ====================", "goals"),
    ("# ==================== Recommendations ====================", "recommendations"),
    ("# ==================== Dashboard analytics ====================", "analytics"),
    ("# ==================== Per-client analytics ====================", "analytics"),
    ("# ==================== Churn analytics (heuristic + survival) ====================", "analytics"),
    ("# ==================== Clustering (k-means + PCA) ====================", "analytics"),
    ("# ==================== Statistical comparison of programs ====================", "analytics"),
    ("# ==================== Gym load analytics ====================", "analytics"),
    ("# ==================== Demo data generation ====================", "demo"),
]

# Найдём индексы секций
indices = {}
for i, line in enumerate(lines):
    for marker, name in SECTION_MAP:
        if marker in line:
            if name not in indices:
                indices[name] = []
            indices[name].append(i)

# Определим границы
section_ranges = {}
for marker, name in SECTION_MAP:
    if name not in section_ranges and name in indices:
        start = indices[name][0]
        # найдём конец — начало следующей секции или конец файла
        end = len(lines)
        for other_marker, other_name in SECTION_MAP:
            other_indices = indices.get(other_name, [])
            for idx in other_indices:
                if idx > start and idx < end:
                    end = idx
        section_ranges[name] = (start, end)

# Соберём содержимое для каждого роутера
router_contents = {}
for name, (start, end) in section_ranges.items():
    content = "".join(lines[start:end])
    # заменим @app. на @router.
    content = content.replace("@app.", "@router.")
    router_contents[name] = COMMON_IMPORTS + content

# Auth роутер требует небольшой корректировки — @app.on_event оставить в main.py
if "auth" in router_contents:
    router_contents["auth"] = router_contents["auth"].replace(
        "@router.on_event(\"startup\")",
        "# startup moved to main.py\n# @router.on_event(\"startup\")"
    )

# Analytics роутер содержит несколько секций подряд
if "analytics" in router_contents:
    # ничего особенного
    pass

# Demo роутер
if "demo" in router_contents:
    pass

# Запишем файлы
Path("routers").mkdir(exist_ok=True)
for name, content in router_contents.items():
    Path(f"routers/{name}.py").write_text(content, encoding="utf-8")
    print(f"Written routers/{name}.py ({len(content)} chars)")

# Теперь создадим dependencies.py
# Найдём секции imports, database, auth_helpers в main.py
def find_section(start_marker, end_marker=None):
    start = None
    for i, line in enumerate(lines):
        if start_marker in line:
            start = i
        if start is not None and end_marker and end_marker in line:
            return lines[start:i]
    if start is not None:
        return lines[start:]
    return []

dep_sections = []
# imports
dep_sections.extend(lines[:lines.index(next(l for l in lines if "# ==================== Database ====================" in l))])
# database
dep_sections.extend(find_section("# ==================== Database ====================", "# ==================== Auth helpers ===================="))
# auth helpers
dep_sections.extend(find_section("# ==================== Auth helpers ====================", "# ==================== Pydantic Models ===================="))

deps_text = "".join(dep_sections)
# Удалим импорт FastAPI, Request, CORSMiddleware — они не нужны в dependencies
deps_text = deps_text.replace("from fastapi import Depends, FastAPI, Header, HTTPException, Request\n", "from fastapi import Depends, Header, HTTPException\n")
deps_text = deps_text.replace("from fastapi.middleware.cors import CORSMiddleware\n", "")
deps_text = deps_text.replace("from fastapi.responses import FileResponse\n", "")
deps_text = deps_text.replace("from fastapi.staticfiles import StaticFiles\n", "")
deps_text = deps_text.replace("import os\n", "import os\n").replace("from pydantic import BaseModel, Field\n", "")

Path("dependencies.py").write_text(deps_text, encoding="utf-8")
print("Written dependencies.py")

# schemas.py
schema_sections = find_section("# ==================== Pydantic Models ====================", "# ==================== Startup ====================")
schema_text = "".join(lines[:lines.index(next(l for l in lines if "# ==================== Database ====================" in l))]) + "".join(schema_sections)
schema_text = schema_text.replace("from fastapi import Depends, FastAPI, Header, HTTPException, Request\n", "")
schema_text = schema_text.replace("from fastapi.middleware.cors import CORSMiddleware\n", "")
schema_text = schema_text.replace("from fastapi.responses import FileResponse\n", "")
schema_text = schema_text.replace("from fastapi.staticfiles import StaticFiles\n", "")
schema_text = schema_text.replace("from db import engine, SessionLocal\n", "")
Path("schemas.py").write_text(schema_text, encoding="utf-8")
print("Written schemas.py")

# main.py — новый
main_lines = []
# imports
main_lines.extend(lines[:lines.index(next(l for l in lines if "# ==================== Database ====================" in l))])
# startup + static files
st_start = lines.index(next(l for l in lines if "# ==================== Startup ====================" in l))
st_end = lines.index(next(l for l in lines if "# ==================== Auth ====================" in l))
sf_start = lines.index(next(l for l in lines if "# ==================== Static files ====================" in l))

main_lines.extend(lines[st_start:st_end])
main_lines.extend(lines[sf_start:])

main_text = "".join(main_lines)
main_text = main_text.replace(
    "from fastapi import Depends, FastAPI, Header, HTTPException, Request\n",
    "from fastapi import FastAPI, Request\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom fastapi.responses import FileResponse\nfrom fastapi.staticfiles import StaticFiles\n"
)

# Добавим импорты роутеров
router_imports = "\n".join([f"from routers.{n} import router as {n}_router" for n in router_contents.keys()])

# Вставим импорты роутеров после строки моделей
main_text = main_text.replace(
    "from models import (\n    Client, Trainer, Exercise, TrainingProgram, ProgramExercise,\n    TrainingSession, SessionExercise, ClientMetric, ClientGoal,\n    Recommendation, User, TrainingCalendar\n)\n",
    "from models import (\n    Client, Trainer, Exercise, TrainingProgram, ProgramExercise,\n    TrainingSession, SessionExercise, ClientMetric, ClientGoal,\n    Recommendation, User, TrainingCalendar\n)\n" + router_imports + "\n"
)

# Заменим @app.on_event на @app.on_event (оставим как есть)
# Добавим include_router перед static files
static_marker = "# ==================== Static files ===================="
include_lines = "\n".join([f"app.include_router({n}_router)" for n in router_contents.keys()]) + "\n\n"
main_text = main_text.replace(static_marker, include_lines + static_marker)

# Удалим auth_startup блок из main_text, т.к. он теперь в routers/auth.py
# Но startup оставим

Path("main.py").write_text(main_text, encoding="utf-8")
print("Rewritten main.py")

print("\nModularization complete.")
