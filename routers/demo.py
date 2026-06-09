from datetime import datetime, timedelta
import random
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from dependencies import (
    get_db_raw,
    get_current_user, require_roles,
    _hash_password,
    TRAINER_NAMES,
    clear_demo_tables, sql_bool_true, sql_bool_false,
)
from models import TrainingCalendar

router = APIRouter()

# ==================== Demo data generation ====================

@router.post("/api/demo/generate")
async def generate_demo_data(user: dict = Depends(require_roles("admin"))):
    with get_db_raw() as conn:
        clear_demo_tables(conn)

        trainers_data = [
            (name, spec, exp, round(random.uniform(4.0, 5.0), 1))
            for name, spec, exp in TRAINER_NAMES
        ]
        for t in trainers_data:
            conn.execute(
                text(
                    "INSERT INTO trainers (name, specialization, experience_years, rating, is_active)"
                    f" VALUES (:name, :spec, :exp, :rating, {sql_bool_true()}) "
                ),
                {"name": t[0], "spec": t[1], "exp": t[2], "rating": t[3]}
            )
        num_trainers = len(trainers_data)

        for i, t in enumerate(trainers_data, 1):
            login = f"trainer{i:02d}"
            result = conn.execute(text("SELECT id FROM users WHERE login = :login"), {"login": login})
            existing = result.fetchone()
            if existing:
                conn.execute(
                    text(
                        "UPDATE users SET trainer_id = :tid, full_name = :name, password_hash = :pwd WHERE id = :id"
                    ),
                    {"tid": i, "name": t[0], "pwd": _hash_password("trainer123"), "id": existing[0]}
                )
            else:
                conn.execute(
                    text(
                        "INSERT INTO users (login, password_hash, role, full_name, trainer_id, is_active)"
                        f" VALUES (:login, :pwd, :role, :name, :tid, {sql_bool_true()}) "
                    ),
                    {"login": login, "pwd": _hash_password("trainer123"), "role": "trainer", "name": t[0], "tid": i}
                )

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
            result = conn.execute(
                text(
                    "INSERT INTO exercises (name, muscle_group, secondary_muscle_groups,"
                    " equipment, difficulty, load_type, calories_per_minute, description)"
                    " VALUES (:name, :mg, :smg, :eq, :diff, :lt, :cpm, :desc) RETURNING id"
                ),
                {
                    "name": e[0], "mg": e[1], "smg": e[2], "eq": e[3],
                    "diff": e[4], "lt": e[5], "cpm": e[6], "desc": e[7]
                }
            )
            ex_ids[e[0]] = result.scalar()

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

        TRAINER_WEIGHTS = [20, 18, 15, 17, 14, 12, 16, 13, 19, 11]
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
                is_active = False
                fitness_level = random.choice(levels)
            elif profile == "at_risk":
                is_active = random.choice([False, True])
                fitness_level = random.choice(["beginner", "intermediate"])
            elif profile == "regular":
                is_active = True
                fitness_level = random.choice(["beginner", "intermediate"])
            else:
                is_active = True
                fitness_level = random.choice(["intermediate", "advanced"])

            if i < num_trainers:
                trainer_id = i + 1
            else:
                trainer_id = random.choices(range(1, num_trainers + 1), weights=TRAINER_WEIGHTS)[0]
            goal = random.choice(goals_list)
            sub_type = random.choice(sub_types)

            result = conn.execute(
                text(
                    """
                    INSERT INTO clients (name, email, phone, birth_date, gender,
                        registration_date, subscription_type, subscription_start_date,
                        fitness_goal, fitness_level, health_notes, contraindications,
                        height, trainer_id, is_active)
                    VALUES (:name, :email, :phone, :birth, :gender, :reg_date, :sub_type, :sub_start,
                        :goal, :level, :health, :contra, :height, :trainer_id, :is_active)
                    RETURNING id
                    """
                ),
                {
                    "name": name, "email": email, "phone": phone, "birth": birth,
                    "gender": gender, "reg_date": reg_date, "sub_type": sub_type,
                    "sub_start": sub_start, "goal": goal, "level": fitness_level,
                    "health": HEALTH_NOTES[i % len(HEALTH_NOTES)],
                    "contra": CONTRAINDICATIONS[i % len(CONTRAINDICATIONS)],
                    "height": height, "trainer_id": trainer_id, "is_active": is_active
                },
            )
            cid = result.scalar()
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
                "trainer_id": trainer_id,
            }

        # Привязываем демо-пользователя client1 к первому созданному клиенту
        demo_client_id = client_ids[0]
        conn.execute(text("UPDATE users SET client_id = :cid WHERE login = :login"), {"cid": demo_client_id, "login": "client1"})

        for cid in client_ids:
            prof = client_profiles[cid]
            m_date = (datetime.strptime(prof["reg_date"], "%Y-%m-%d") + timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d")
            base_weight = prof["base_weight"]
            init_metrics = {
                "weight": base_weight,
                "body_fat_percentage": round(random.uniform(12, 28), 1),
                "muscle_mass": round(base_weight * random.uniform(0.35, 0.42), 1),
                "chest_cm": round(random.uniform(85, 115), 1),
                "waist_cm": round(random.uniform(65, 95), 1),
                "hips_cm": round(random.uniform(85, 110), 1),
                "biceps_cm": round(random.uniform(28, 38), 1),
                "thighs_cm": round(random.uniform(48, 62), 1),
                "resting_heart_rate": random.randint(55, 80),
                "max_pushups": random.randint(5, 40),
                "max_pullups": random.randint(0, 15),
                "plank_seconds": random.randint(30, 180),
                "run_5km_minutes": round(random.uniform(20, 35), 1),
            }
            client_profiles[cid]["init_metrics"] = init_metrics
            client_profiles[cid]["init_m_date"] = m_date
            conn.execute(
                text(
                    """
                    INSERT INTO client_metrics (client_id, measurement_date, weight, body_fat_percentage,
                        muscle_mass, chest_cm, waist_cm, hips_cm, biceps_cm, thighs_cm,
                        resting_heart_rate, max_pushups, max_pullups, plank_seconds, run_5km_minutes)
                    VALUES (:cid, :m_date, :weight, :bfp, :muscle, :chest, :waist, :hips, :biceps, :thighs,
                        :hr, :pushups, :pullups, :plank, :run5k)
                    """
                ),
                {
                    "cid": cid, "m_date": m_date,
                    "weight": init_metrics["weight"],
                    "bfp": init_metrics["body_fat_percentage"],
                    "muscle": init_metrics["muscle_mass"],
                    "chest": init_metrics["chest_cm"],
                    "waist": init_metrics["waist_cm"],
                    "hips": init_metrics["hips_cm"],
                    "biceps": init_metrics["biceps_cm"],
                    "thighs": init_metrics["thighs_cm"],
                    "hr": init_metrics["resting_heart_rate"],
                    "pushups": init_metrics["max_pushups"],
                    "pullups": init_metrics["max_pullups"],
                    "plank": init_metrics["plank_seconds"],
                    "run5k": init_metrics["run_5km_minutes"]
                },
            )

        # Повторные замеры для демонстрации динамики
        for cid, prof in client_profiles.items():
            init = prof["init_metrics"]
            init_m_date = datetime.strptime(prof["init_m_date"], "%Y-%m-%d")
            for follow_up in range(random.randint(1, 3)):
                days_offset = random.randint(30, 90) * (follow_up + 1)
                m_date = (init_m_date + timedelta(days=days_offset)).strftime("%Y-%m-%d")
                goal = prof["goal"]
                weight_delta = random.uniform(-3, -0.5) if goal == "weight_loss" else random.uniform(-0.5, 2) if goal == "muscle_gain" else random.uniform(-1, 1)
                bf_delta = random.uniform(-2, -0.3) if goal == "weight_loss" else random.uniform(-0.5, 0.5)
                muscle_delta = random.uniform(0, 1.5) if goal == "muscle_gain" else random.uniform(-0.5, 0.5)
                pushups_delta = random.randint(1, 10) if goal in ("endurance", "general_fitness") else random.randint(0, 5)
                mult = follow_up + 1
                conn.execute(
                    text(
                        """
                        INSERT INTO client_metrics (client_id, measurement_date, weight, body_fat_percentage,
                            muscle_mass, chest_cm, waist_cm, hips_cm, biceps_cm, thighs_cm,
                            resting_heart_rate, max_pushups, max_pullups, plank_seconds, run_5km_minutes)
                        VALUES (:cid, :m_date, :weight, :bfp, :muscle, :chest, :waist, :hips, :biceps, :thighs,
                            :hr, :pushups, :pullups, :plank, :run5k)
                        """
                    ),
                    {
                        "cid": cid, "m_date": m_date,
                        "weight": round(max(30, init["weight"] + weight_delta * mult), 1),
                        "bfp": round(max(5, init["body_fat_percentage"] + bf_delta * mult), 1),
                        "muscle": round(max(10, init["muscle_mass"] + muscle_delta * mult), 1),
                        "chest": round(init["chest_cm"] + random.uniform(-1, 2) * mult, 1),
                        "waist": round(init["waist_cm"] + random.uniform(-2, 1) * mult, 1),
                        "hips": round(init["hips_cm"] + random.uniform(-1, 1.5) * mult, 1),
                        "biceps": round(init["biceps_cm"] + random.uniform(-0.5, 1) * mult, 1),
                        "thighs": round(init["thighs_cm"] + random.uniform(-0.5, 1.5) * mult, 1),
                        "hr": random.randint(50, 75),
                        "pushups": max(0, init["max_pushups"] + pushups_delta * mult),
                        "pullups": max(0, init["max_pullups"] + random.randint(0, 3) * mult),
                        "plank": init["plank_seconds"] + random.randint(5, 30) * mult,
                        "run5k": round(max(10, init["run_5km_minutes"] + random.uniform(-3, 1) * mult), 1)
                    },
                )

        for cid, prof in client_profiles.items():
            for g_name, target in [("weight", prof["base_weight"] * random.uniform(0.85, 1.05)),
                                    ("body_fat_percentage", random.uniform(10, 22)),
                                    ("max_pushups", random.randint(20, 60))]:
                conn.execute(
                    text(
                        "INSERT INTO client_goals (client_id, metric, target_value, target_date, status) VALUES (:cid, :metric, :target, :tdate, :status)"
                    ),
                    {
                        "cid": cid, "metric": g_name, "target": round(target, 1),
                        "tdate": (datetime.now() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d"),
                        "status": random.choice(["pending", "achieved", "cancelled"])
                    },
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

        # Создаём программы для 30 случайных клиентов (достаточно для статистики)
        # Гарантируем, что демо-клиент получит программу
        demo_client_id = client_ids[0]
        other_items = [(cid, prof) for cid, prof in client_profiles.items() if cid != demo_client_id]
        program_clients = [(demo_client_id, client_profiles[demo_client_id])]
        program_clients.extend(random.sample(other_items, min(29, len(other_items))))
        program_ids = []
        for idx, (cid, prof) in enumerate(program_clients):
            prog = programs_pool[idx % len(programs_pool)]
            start = (datetime.strptime(prof["sub_start"], "%Y-%m-%d") + timedelta(days=random.randint(0, 14))).strftime("%Y-%m-%d")
            result = conn.execute(
                text(
                    """
                    INSERT INTO training_programs (client_id, trainer_id, name, description, goal,
                        duration_weeks, sessions_per_week, difficulty_level, start_date, is_active)
                    VALUES (:cid, :tid, :name, :desc, :goal, :dur, :spw, :diff, :start, true)
                    RETURNING id
                    """
                ),
                {
                    "cid": cid, "tid": prof.get("trainer_id", random.randint(1, num_trainers)),
                    "name": prog[0], "desc": prog[1], "goal": prog[2], "dur": prog[3],
                    "spw": prog[4], "diff": prog[5], "start": start
                },
            )
            pid = result.scalar()
            program_ids.append(pid)

            ex_pool = EX_BY_TYPE["силовая"] + EX_BY_TYPE["кардио"][:2] + EX_BY_TYPE["функциональная"][:2]
            for day in range(prog[4]):
                for ex_i in range(random.randint(3, 6)):
                    ex_id = random.choice(ex_pool)
                    conn.execute(
                        text(
                            """
                            INSERT INTO program_exercises (program_id, exercise_id, sets, reps, weight,
                                rest_seconds, day_of_week, order_number)
                            VALUES (:pid, :eid, :sets, :reps, :weight, :rest, :dow, :ord)
                            """
                        ),
                        {
                            "pid": pid, "eid": ex_id, "sets": random.randint(2, 4), "reps": random.randint(8, 15),
                            "weight": round(random.uniform(10, 60), 1) if random.random() > 0.3 else None,
                            "rest": random.randint(30, 120), "dow": day + 1, "ord": ex_i + 1
                        },
                    )

            if start and prog[3] and prog[4]:
                _generate_calendar_raw(conn, pid, start, prog[3], prog[4])

        # Генерация сессий с учётом профиля клиента (реалистичный риск оттока)
        for cid, prof in client_profiles.items():
            profile = prof["profile"]
            if profile == "loyal":
                num_sessions = random.randint(45, 70)
                recent_days = 30
                sat_range = (4, 5)
            elif profile == "regular":
                num_sessions = random.randint(20, 40)
                recent_days = 60
                sat_range = (3, 5)
            elif profile == "at_risk":
                num_sessions = random.randint(5, 18)
                recent_days = 120
                sat_range = (2, 4)
            else:  # churned
                num_sessions = random.randint(0, 5)
                recent_days = 240
                sat_range = (1, 3)

            reg_dt = datetime.strptime(prof["reg_date"], "%Y-%m-%d")
            days_since_reg = (datetime.now() - reg_dt).days
            for s_i in range(num_sessions):
                # Даты: для активных — в основном недавние, для оттока — давние
                if profile in ("loyal", "regular"):
                    # 70% сессий за последние recent_days, остальные — ранее
                    if random.random() < 0.7:
                        days_ago = random.randint(1, recent_days)
                    else:
                        days_ago = random.randint(recent_days, max(recent_days, min(180, days_since_reg)))
                elif profile == "at_risk":
                    days_ago = random.randint(recent_days // 2, recent_days)
                else:
                    days_ago = random.randint(recent_days, max(recent_days, min(360, days_since_reg)))

                s_date = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
                dur = random.randint(30, 90)
                sat = random.randint(*sat_range) if random.random() > 0.15 else None
                pid_ref = random.choice(program_ids) if program_ids and random.random() > 0.4 else None
                result = conn.execute(
                    text(
                        """
                        INSERT INTO training_sessions (client_id, program_id, trainer_id, session_date,
                            start_time, duration_minutes, calories_burned, fatigue_level,
                            satisfaction_rating, comment)
                        VALUES (:cid, :pid, :tid, :sdate, :stime, :dur, :cal, :fatigue, :sat, :comment)
                        RETURNING id
                        """
                    ),
                    {
                        "cid": cid, "pid": pid_ref, "tid": prof.get("trainer_id", random.randint(1, num_trainers)),
                        "sdate": s_date, "stime": f"{random.randint(8,20):02d}:{random.randint(0,59):02d}",
                        "dur": dur, "cal": round(dur * random.uniform(5, 12)), "fatigue": random.randint(1, 5),
                        "sat": sat, "comment": None
                    },
                )
                session_id = result.scalar()

                # Заполняем упражнения для сессии
                if pid_ref:
                    result = conn.execute(
                        text("SELECT exercise_id, sets, reps, weight FROM program_exercises WHERE program_id = :pid"),
                        {"pid": pid_ref}
                    )
                    prog_exercises = result.fetchall()
                    if prog_exercises:
                        minutes_per_exercise = dur / len(prog_exercises)
                        for pe in prog_exercises:
                            ex_calories = round(random.uniform(5, 12) * minutes_per_exercise)
                            conn.execute(
                                text(
                                    """
                                    INSERT INTO session_exercises (session_id, exercise_id, actual_sets,
                                        actual_reps, actual_weight, actual_duration_seconds, rpe, calories_burned)
                                    VALUES (:sid, :eid, :sets, :reps, :weight, :dur_sec, :rpe, :cal)
                                    """
                                ),
                                {
                                    "sid": session_id, "eid": pe[0], "sets": pe[1], "reps": pe[2],
                                    "weight": pe[3], "dur_sec": int(minutes_per_exercise * 60),
                                    "rpe": random.randint(6, 9), "cal": ex_calories
                                }
                            )
                    else:
                        _add_random_session_exercises(conn, session_id, dur, ex_ids)
                else:
                    _add_random_session_exercises(conn, session_id, dur, ex_ids)

        from routers.recommendations import _recompute_recommendations
        _recompute_recommendations(conn)

        conn.commit()
    return {"ok": True}


def _generate_calendar_raw(conn, program_id: int, start_date: str, duration_weeks: int, sessions_per_week: int):
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
            conn.execute(
                text(
                    """
                    INSERT INTO training_calendar (program_id, planned_date, day_of_week, status)
                    VALUES (:pid, :planned, :dow, 'planned')
                    """
                ),
                {"pid": program_id, "planned": planned.strftime("%Y-%m-%d"), "dow": dow},
            )


def _add_random_session_exercises(conn, session_id, duration, ex_ids):
    num_exercises = random.randint(3, 6)
    all_ex_ids = list(ex_ids.values())
    chosen = random.sample(all_ex_ids, min(num_exercises, len(all_ex_ids)))
    if not chosen:
        return
    minutes_per_exercise = duration / len(chosen)
    for ex_id in chosen:
        ex_calories = round(random.uniform(5, 12) * minutes_per_exercise)
        conn.execute(
            text(
                """
                INSERT INTO session_exercises (session_id, exercise_id, actual_sets,
                    actual_reps, actual_weight, actual_duration_seconds, rpe, calories_burned)
                VALUES (:sid, :eid, :sets, :reps, :weight, :dur_sec, :rpe, :cal)
                """
            ),
            {
                "sid": session_id, "eid": ex_id, "sets": random.randint(2, 4), "reps": random.randint(8, 15),
                "weight": round(random.uniform(10, 60), 1) if random.random() > 0.3 else None,
                "dur_sec": int(minutes_per_exercise * 60), "rpe": random.randint(6, 9), "cal": ex_calories
            }
        )
