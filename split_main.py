#!/usr/bin/env python3
"""Скрипт для разбиения монолитного main.py на модули."""

import re
from pathlib import Path

source = Path("main.py").read_text(encoding="utf-8")
lines = source.splitlines(keepends=True)

# Заголовки секций
SECTIONS = {
    "imports": (0, 0),
    "database": (0, 0),
    "auth_helpers": (0, 0),
    "pydantic_models": (0, 0),
    "startup": (0, 0),
    "auth": (0, 0),
    "clients": (0, 0),
    "trainers": (0, 0),
    "exercises": (0, 0),
    "programs": (0, 0),
    "sessions": (0, 0),
    "client_metrics": (0, 0),
    "client_goals": (0, 0),
    "recommendations": (0, 0),
    "dashboard_analytics": (0, 0),
    "per_client_analytics": (0, 0),
    "churn_analytics": (0, 0),
    "clustering": (0, 0),
    "statistical_comparison": (0, 0),
    "gym_load": (0, 0),
    "demo_data": (0, 0),
    "static_files": (0, 0),
}

# Найдём границы секций по комментариям
section_order = []
for i, line in enumerate(lines):
    m = re.match(r"^# ===+ (.*?) ===+$", line)
    if m:
        name = m.group(1).strip().lower().replace(" ", "_").replace("-", "_")
        if name in SECTIONS:
            if section_order:
                SECTIONS[section_order[-1]] = (SECTIONS[section_order[-1]][0], i)
            SECTIONS[name] = (i, len(lines))
            section_order.append(name)

# Добавим imports как начало
if section_order:
    SECTIONS["imports"] = (0, SECTIONS[section_order[0]][0])

# Соберём imports отдельно — всё до первой секции
imports_end = SECTIONS.get("imports", (0, 0))[1]
imports_lines = lines[:imports_end]

# Database + Auth helpers + Pydantic models пойдут в dependencies/schemas
# Остальное — в роутеры

def write_file(path: str, content: str):
    Path(path).write_text(content, encoding="utf-8")
    print(f"Written {path}")

# 1. dependencies.py: database + auth helpers
db_start = SECTIONS.get("database", (0, 0))[0]
db_end = SECTIONS.get("pydantic_models", (0, 0))[0]
dep_lines = imports_lines + lines[db_start:db_end]
# Удалим импорт FastAPI-specific вещей из dependencies, оставим только общие
write_file("dependencies.py", "".join(dep_lines))

# 2. schemas.py: pydantic models
pm_start = SECTIONS.get("pydantic_models", (0, 0))[0]
pm_end = SECTIONS.get("startup", (0, 0))[0]
schemas_lines = imports_lines + lines[pm_start:pm_end]
write_file("schemas.py", "".join(schemas_lines))

# 3. main.py: точка входа + startup + static files
main_content = "".join(imports_lines)
# Добавим startup и static files
st_start = SECTIONS.get("startup", (0, 0))[0]
st_end = SECTIONS.get("auth", (0, 0))[0]
sf_start = SECTIONS.get("static_files", (0, 0))[0]
main_content += "".join(lines[st_start:st_end])
main_content += "".join(lines[sf_start:])
write_file("main_new.py", main_content)

# 4. Роутеры
router_sections = {
    "auth": ("auth", SECTIONS.get("auth", (0,0))[0], SECTIONS.get("clients", (0,0))[0]),
    "clients": ("clients", SECTIONS.get("clients", (0,0))[0], SECTIONS.get("trainers", (0,0))[0]),
    "trainers": ("trainers", SECTIONS.get("trainers", (0,0))[0], SECTIONS.get("exercises", (0,0))[0]),
    "exercises": ("exercises", SECTIONS.get("exercises", (0,0))[0], SECTIONS.get("programs", (0,0))[0]),
    "programs": ("programs", SECTIONS.get("programs", (0,0))[0], SECTIONS.get("sessions", (0,0))[0]),
    "sessions": ("sessions", SECTIONS.get("sessions", (0,0))[0], SECTIONS.get("client_metrics", (0,0))[0]),
    "metrics": ("metrics", SECTIONS.get("client_metrics", (0,0))[0], SECTIONS.get("client_goals", (0,0))[0]),
    "goals": ("goals", SECTIONS.get("client_goals", (0,0))[0], SECTIONS.get("recommendations", (0,0))[0]),
    "recommendations": ("recommendations", SECTIONS.get("recommendations", (0,0))[0], SECTIONS.get("dashboard_analytics", (0,0))[0]),
    "analytics": ("analytics", SECTIONS.get("dashboard_analytics", (0,0))[0], SECTIONS.get("demo_data", (0,0))[0]),
    "demo": ("demo", SECTIONS.get("demo_data", (0,0))[0], SECTIONS.get("static_files", (0,0))[0]),
}

for name, (_, start, end) in router_sections.items():
    content = "".join(imports_lines) + "".join(lines[start:end])
    write_file(f"routers/{name}.py", content)

print("Done")
