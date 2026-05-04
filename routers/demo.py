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

# ==================== Demo data generation ====================

@router.post("/api/demo/generate")
async def generate_demo_data(user: dict = Depends(require_roles("admin"))):
    with get_db_raw() as conn:
        c = conn.cursor()
        c.execute("UPDATE users SET trainer_id = NULL, client_id = NULL")
        for t in ["session_exercises", "training_sessions", "program_exercises",
                  "training_calendar", "training_programs", "client_metrics",
                  "client_goals", "recommendations", "exercises", "clients", "trainers"]:
            c.execute(f"DELETE FROM {t}")
            try:
                c.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}'")
            except Exception:
                pass

        trainers_data = [
            ("Александр Петров", "Силовые тренировки", 8, 4.8),
            ("Мария Иванова", "Функциональный тренинг", 5, 4.9),
            ("Дмитрий Сидоров", "Кардио и выносливость", 6, 4.6),
            ("Елена Козлова", "Йога и растяжка", 10, 4.7),
            ("Игорь Волков", "Кроссфит", 4, 4.5),
            ("Анна Морозова", "Похудение", 7, 4.8),
            ("Сергей Кузнецов", "Бодибилдинг", 12, 4.9),
            ("Ольга Фёдорова", "Пилатес", 6, 4.7),
            ("Никита Орлов", "Бокс и единоборства", 9, 4.6),
            ("Виктория Соловьёва", "Реабилитация", 8, 4.8),
        ]
        for t in trainers_data:
            c.execute(
                "INSERT INTO trainers (name, specialization, experience_years, rating, is_active)"
                " VALUES (?, ?, ?, ?, 1)", t)
        num_trainers = len(trainers_data)

        exercises_data = [
            ("Жим штанги лёжа", "Грудь", "Трицепс, Передний дельтовид", "Штанга", "medium", "силовая", 8.0, "Классическое базовое упражнение для развития грудных мышц. Выполнять с контролем негативной фазы."),
            ("Приседания со штангой", "Ноги", "Спина, Кор, Ягодицы", "Штанга", "hard", "силовая", 10.0, "Король упражнений для нижней части тела. Следить за положением колен."),
            ("Становая тяга", "Спина", "Ноги, Кор, Трапеции", "Штанга", "hard", "силовая", 12.0, "Базовое тяговое движение. Держать спину прямой на протяжении всего движения."),
            ("Подтягивания", "Спина", "Бицепс, Кор", "Турник", "medium", "силовая", 7.0, "Лучшее упражнение для ширины спины. Доводить подбородок до перекладины."),
            ("Отжимания", "Грудь", "Трицепс, Кор, Передний дельтовид", "Без оборудования", "easy", "силовая", 5.0, "Универсальное упражнение для верха тела. Можно выполнять везде."),
            ("Планка", "Кор", "Спина, Плечи", "Без оборудования", "easy", "функциональная", 4.0, "Статическое упражнение для кора. Держать тело в одной линии."),
            ("Бег на дорожке", "Кардио", "Ноги, Икры", "Беговая дорожка", "medium", "кардио", 10.0, "Аэробная тренировка для развития выносливости. Поддерживать целевую ЧСС."),
            ("Велотренажёр", "Кардио", "Ноги, Икры", "Велотренажёр", "easy", "кардио", 8.0, "Щадящее кардио для суставов. Регулировать сопротивление."),
            ("Жим гантелей сидя", "Плечи", "Трицепс, Кор", "Гантели", "medium", "силовая", 6.0, "Изолированная работа на дельтовидные. Не сводить локти слишком сильно."),
            ("Сгибания на бицепс", "Руки", "Предплечья", "Гантели", "easy", "силовая", 4.0, "Изолирующее упражнение для бицепса. Без махов и раскачиваний."),
            ("Разведение гантелей", "Грудь", "Передний дельтовид", "Гантели", "easy", "силовая", 5.0, "Растягивающее упражнение для грудных мышц. Лёгкий вес, высокие повторения."),
            ("Тяга верхнего блока", "Спина", "Бицепс, Кор", "Блоковый тренажёр", "medium", "силовая", 6.0, "Альтернатива подтягиваниям. Вести локти вниз и назад."),
            ("Выпады с гантелями", "Ноги", "Ягодицы, Кор", "Гантели", "medium", "силовая", 7.0, "Упражнение на одну ногу. Следить за стабильностью колена."),
            ("Бёрпи", "Кор", "Грудь, Ноги, Плечи", "Без оборудования", "hard", "функциональная", 12.0, "Высокоинтенсивное упражнение. Контролировать дыхание."),
            ("Скакалка", "Кардио", "Икры, Плечи", "Скакалка", "easy", "кардио", 9.0, "Отличная разминка и кардио. Работать на быстрых вращениях запястий."),
            ("Подъёмы ног в висе", "Кор", "Бедра, Поясница", "Турник", "medium", "силовая", 5.0, "Упражнение для нижнего пресса. Не раскачиваться."),
            ("Тяга Т-грифа", "Спина", "Бицепс, Задний дельтовид", "Т-гриф", "medium", "силовая", 7.0, "Упражнение для толщины спины. Тянуть к поясу."),
            ("Французский жим", "Руки", "Трицепс", "Штанга EZ", "medium", "силовая", 5.0, "Изоляция трицепса. Локти не разводить в стороны."),
            ("Подъём на носки стоя", "Ноги", "Икры", "Тренажёр для икр", "easy", "силовая", 4.0, "Упражнение для икроножных мышц. Максимальная амплитуда."),
            ("Гиперэкстензия", "Спина", "Ягодицы, Задняя поверхность бедра", "Гиперэкстензия", "easy", "силовая", 4.0, "Укрепление поясницы. Не прогибаться слишком сильно."),
            ("Эллипсоид", "Кардио", "Ноги, Руки", "Эллиптический тренажёр", "easy", "кардио", 8.0, "Низкоударное кардио. Держать ровную осанку."),
            ("Гоблет-присед", "Ноги", "Кор, Ягодицы", "Гантель", "medium", "силовая", 7.0, "Приседания с гантелью у груди. Отличны для техники."),
            ("Русский мах", "Кор", "Плечи, Спина", "Гиря", "medium", "функциональная", 8.0, "Динамичное упражнение с гирей. Работа корпусом."),
            ("Боковая планка", "Кор", "Плечи, Ягодицы", "Без оборудования", "easy", "функциональная", 3.5, "Упражнение для косых мышц живота. Держать бедра поднятыми."),
            ("Степпер", "Кардио", "Ноги, Ягодицы", "Степпер", "easy", "кардио", 7.0, "Имитация ходьбы по лестнице. Хорошо прорабатывает ягодицы."),
        ]
        ex_ids = {}
        for e in exercises_data:
            c.execute(
                "INSERT INTO exercises (name, muscle_group, secondary_muscle_groups,"
                " equipment, difficulty, load_type, calories_per_minute, description)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)", e)
            ex_ids[e[0]] = c.lastrowid

        EX_BY_TYPE = {"силовая": [], "кардио": [], "функциональная": []}
        for name, eid in ex_ids.items():
            etype = next(ex[5] for ex in exercises_data if ex[0] == name)
            EX_BY_TYPE[etype].append(eid)

        male_first = ["Иван", "Пётр", "Сергей", "Андрей", "Михаил", "Алексей",
                      "Николай", "Дмитрий", "Виктор", "Роман", "Артём", "Максим",
                      "Кирилл", "Денис", "Евгений"]
        female_first = ["Анна", "Мария", "Елена", "Ольга", "Наталья",
                        "Татьяна", "Екатерина", "Юлия", "Светлана", "Ирина",
                        "Алёна", "Виктория", "Полина", "София", "Алиса"]
        male_last = ["Смирнов", "Кузнецов", "Попов", "Васильев", "Петров",
                     "Соколов", "Михайлов", "Новиков", "Фёдоров", "Морозов",
                     "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров",
                     "Павлов", "Козлов", "Степанов", "Орлов", "Николаев"]
        female_last = ["Смирнова", "Кузнецова", "Попова", "Васильева", "Петрова",
                       "Соколова", "Михайлова", "Новикова", "Фёдорова", "Морозова",
                       "Волкова", "Алексеева", "Лебедева", "Семёнова", "Егорова",
                       "Павлова", "Козлова", "Степанова", "Орлова", "Николаева"]

        sub_types = ["basic", "standard", "premium", "vip"]
        goals_list = ["weight_loss", "muscle_gain", "endurance", "flexibility", "general_fitness"]
        levels = ["beginner", "intermediate", "advanced"]
        genders = ["М", "Ж"]

        HEALTH_NOTES = [
            "Артериальное давление в норме. Хронических заболеваний нет.",
            "Лёгкая гипотония. Рекомендовано постепенное увеличение нагрузки.",
            "Сколиоз 1 степени. Избегать осевых нагрузок на позвоночник.",
            "Плоскостопие. Рекомендованы ортопедические стельки при беге.",
            "Повышенный холестерин. Акцент на кардионагрузки.",
            "Преддиабет. Контроль уровня сахара перед и после тренировок.",
            "Грыжа межпозвоночная L4-L5. Осторожно с наклонами и становой тягой.",
            "Астма лёгкой степени. Ингалятор при себе. Кардио умеренной интенсивности.",
            "Артроз коленного сустава 1 степени. Избегать глубоких приседаний.",
            "Варикозное расширение вен. Использовать компрессионное бельё.",
            "Без особенностей. Общее укрепление организма.",
            "Синдром хронической усталости. Низкая интенсивность, акцент на восстановление.",
            "Ожирение 1 степени. Постепенное снижение веса, мониторинг пульса.",
            "Гипертония 1 степени. Избегать резких смен положения и максимальных весов.",
            "Остеопороз начальной стадии. Упражнения с отягощением под контролем.",
            "Перелом ключицы 2 года назад. Полное восстановление. Нет ограничений.",
            "Мигрень. Избегать перегрева и резких перепадов давления.",
            "Бергерова болезнь в анамнезе. Тёплые тренировочные перчатки.",
            "Синдром запястного канала. Нейтральное положение запястий при жимах.",
            "Повышенная тревожность. Групповые занятия рекомендованы для мотивации.",
        ]

        CONTRAINDICATIONS = [
            None,
            "Острая лихорадка",
            "Обострение хронического гастрита",
            "Недавняя операция на колене (6 мес. назад)",
            "Травма плечевого сустава",
            "Острый ларингит",
            "Грыжа с давлением на корешок",
            "Нестабильная стенокардия",
            "Острый бронхит",
            "Перелом ребра (восстановление)",
            "Тендинит ахиллова сухожилия",
            "Воспаление седалищного нерва",
            None,
            None,
            "Гипертонический криз в анамнезе",
            None,
            "Беременность 2 триместр",
            None,
            "Острый артрит колена",
            None,
        ]

        client_profile_cycle = (
            ["loyal"] * 15 + ["regular"] * 20 + ["at_risk"] * 10 + ["churned"] * 5
        )
        random.shuffle(client_profile_cycle)

        TRAINER_WEIGHTS = [20, 18, 5, 15, 5, 17, 14, 12, 10, 8]
        DOW_WEIGHTS = [2, 25, 8, 22, 8, 20, 5]
        DOW_OPTIONS = list(range(7))

        client_ids = []
        client_profiles = {}
        for i in range(50):
            profile = client_profile_cycle[i]
            gender = random.choice(genders)
            if gender == "М":
                name = f"{random.choice(male_first)} {random.choice(male_last)}"
                height = round(random.uniform(168, 188), 1)
                base_weight = round(random.uniform(70, 105), 1)
            else:
                name = f"{random.choice(female_first)} {random.choice(female_last)}"
                height = round(random.uniform(155, 175), 1)
                base_weight = round(random.uniform(52, 78), 1)

            email = f"client{i+1:03d}@demo.fitness"
            phone = f"+7{random.randint(900, 999)}{random.randint(1000000, 9999999)}"
            birth_year = random.randint(1968, 2002)
            birth = f"{birth_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"

            reg_days = random.randint(90, 900)
            reg_date = (datetime.now() - timedelta(days=reg_days)).strftime("%Y-%m-%d")
            sub_start = (datetime.now() - timedelta(days=random.randint(0, reg_days))).strftime("%Y-%m-%d")

            if profile == "churned":
                is_active = 0
                fitness_level = random.choice(levels)
            elif profile == "at_risk":
                is_active = random.choice([0, 1])
                fitness_level = random.choice(["beginner", "intermediate"])
            elif profile == "regular":
                is_active = 1
                fitness_level = random.choice(["beginner", "intermediate"])
            else:
                is_active = 1
                fitness_level = random.choice(["intermediate", "advanced"])

            trainer_id = random.choices(range(1, num_trainers + 1), weights=TRAINER_WEIGHTS)[0]
            goal = random.choice(goals_list)
            sub_type = random.choice(sub_types)

            c.execute(
                """
                INSERT INTO clients (name, email, phone, birth_date, gender,
                    registration_date, subscription_type, subscription_start_date,
                    fitness_goal, fitness_level, health_notes, contraindications,
                    height, trainer_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (name, email, phone, birth, gender, reg_date, sub_type, sub_start,
                 goal, fitness_level, HEALTH_NOTES[i % len(HEALTH_NOTES)],
                 CONTRAINDICATIONS[i % len(CONTRAINDICATIONS)], height, trainer_id, is_active),
            )
            cid = c.lastrowid
            client_ids.append(cid)
            client_profiles[cid] = {
                "profile": profile,
                "gender": gender,
                "base_weight": base_weight,
                "height": height,
                "goal": goal,
                "fitness_level": fitness_level,
                "reg_date": reg_date,
                "sub_start": sub_start,
            }

            m_date = (datetime.strptime(reg_date, "%Y-%m-%d") + timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d")
            c.execute(
                """
                INSERT INTO client_metrics (client_id, measurement_date, weight, body_fat_percentage,
                    muscle_mass, chest_cm, waist_cm, hips_cm, biceps_cm, thighs_cm,
                    resting_heart_rate, max_pushups, max_pullups, plank_seconds, run_5km_minutes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (cid, m_date, base_weight,
                 round(random.uniform(12, 28), 1),
                 round(base_weight * random.uniform(0.35, 0.42), 1),
                 round(random.uniform(85, 115), 1),
                 round(random.uniform(65, 95), 1),
                 round(random.uniform(85, 110), 1),
                 round(random.uniform(28, 38), 1),
                 round(random.uniform(48, 62), 1),
                 random.randint(55, 80),
                 random.randint(5, 40),
                 random.randint(0, 15),
                 random.randint(30, 180),
                 round(random.uniform(20, 35), 1)),
            )

        for cid, prof in client_profiles.items():
            for g_name, target in [("weight", prof["base_weight"] * random.uniform(0.85, 1.05)),
                                    ("body_fat_percentage", random.uniform(10, 22)),
                                    ("max_pushups", random.randint(20, 60))]:
                c.execute(
                    "INSERT INTO client_goals (client_id, metric, target_value, target_date, status) VALUES (?, ?, ?, ?, ?)",
                    (cid, g_name, round(target, 1),
                     (datetime.now() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d"),
                     random.choice(["pending", "approved"])),
                )

        programs_pool = [
            ("Базовая силовая", "Силовые тренировки", "muscle_gain", 12, 3, "medium"),
            ("Похудение старт", "Снижение веса", "weight_loss", 8, 4, "medium"),
            ("Кардио база", "Выносливость", "endurance", 10, 3, "easy"),
            ("Кроссфит интенсив", "Функциональная подготовка", "general_fitness", 8, 4, "hard"),
            ("Йога-старт", "Гибкость и восстановление", "flexibility", 12, 2, "easy"),
            ("Бодибилдинг сплит", "Набор массы", "muscle_gain", 16, 5, "hard"),
            ("Реабилитация спины", "Восстановление", "general_fitness", 12, 3, "easy"),
            ("Бокс фитнес", "Координация и выносливость", "endurance", 8, 3, "medium"),
        ]

        for cid, prof in client_profiles.items():
            prog = random.choice(programs_pool)
            start = (datetime.strptime(prof["sub_start"], "%Y-%m-%d") + timedelta(days=random.randint(0, 14))).strftime("%Y-%m-%d")
            c.execute(
                """
                INSERT INTO training_programs (client_id, trainer_id, name, description, goal,
                    duration_weeks, sessions_per_week, difficulty_level, start_date, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (cid, prof.get("trainer_id", random.randint(1, num_trainers)),
                 prog[0], prog[1], prog[2], prog[3], prog[4], prog[5], start),
            )
            pid = c.lastrowid

            ex_pool = EX_BY_TYPE["силовая"] + EX_BY_TYPE["кардио"][:2] + EX_BY_TYPE["функциональная"][:2]
            for day in range(prog[4]):
                for ex_i in range(random.randint(3, 6)):
                    ex_id = random.choice(ex_pool)
                    c.execute(
                        """
                        INSERT INTO program_exercises (program_id, exercise_id, sets, reps, weight,
                            rest_seconds, day_of_week, order_number)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (pid, ex_id, random.randint(2, 4), random.randint(8, 15),
                         round(random.uniform(10, 60), 1) if random.random() > 0.3 else None,
                         random.randint(30, 120), day + 1, ex_i + 1),
                    )

            if start and prog[3] and prog[4]:
                _generate_calendar_raw(c, pid, start, prog[3], prog[4])

        for cid, prof in client_profiles.items():
            profile = prof["profile"]
            num_sessions = {"loyal": random.randint(40, 80), "regular": random.randint(20, 50),
                            "at_risk": random.randint(5, 18), "churned": random.randint(2, 12)}[profile]
            for s in range(num_sessions):
                s_date = (datetime.now() - timedelta(days=random.randint(1, 180))).strftime("%Y-%m-%d")
                dur = random.randint(30, 90)
                sat = random.randint(2, 5) if random.random() > 0.2 else None
                c.execute(
                    """
                    INSERT INTO training_sessions (client_id, program_id, trainer_id, session_date,
                        start_time, duration_minutes, calories_burned, fatigue_level,
                        satisfaction_rating, comment)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (cid, random.randint(1, 50), prof.get("trainer_id", random.randint(1, num_trainers)),
                     s_date, f"{random.randint(8,20):02d}:{random.randint(0,59):02d}",
                     dur, round(dur * random.uniform(5, 12)), random.randint(1, 5), sat, None),
                )

        conn.commit()
    return {"ok": True}


def _generate_calendar_raw(cursor, program_id: int, start_date: str, duration_weeks: int, sessions_per_week: int):
    from datetime import datetime, timedelta
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        return
    base_days = [0, 2, 4, 1, 3, 5, 6]
    chosen_days = base_days[:sessions_per_week]
    for week in range(duration_weeks):
        for dow in chosen_days:
            planned = start + timedelta(weeks=week, days=(dow - start.weekday()) % 7)
            cursor.execute(
                """
                INSERT INTO training_calendar (program_id, planned_date, day_of_week, status)
                VALUES (?, ?, ?, 'planned')
                """,
                (program_id, planned.strftime("%Y-%m-%d"), dow),
            )
