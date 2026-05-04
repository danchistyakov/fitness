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

# ==================== Dashboard analytics ====================

@router.get("/api/analytics/dashboard")
async def get_dashboard_analytics(user: dict = Depends(get_current_user)):
    with get_db_raw() as conn:
        c = conn.cursor()
        trainer_id = user.get("trainer_id") if user["role"] == "trainer" else None
        client_subquery = ""
        if trainer_id:
            client_subquery = f" AND client_id IN (SELECT id FROM clients WHERE trainer_id = {trainer_id})"

        c.execute(f"SELECT COUNT(*) FROM clients WHERE is_active = 1" + (f" AND trainer_id = {trainer_id}" if trainer_id else ""))
        active_clients = c.fetchone()[0]
        c.execute("SELECT COUNT(*) FROM trainers WHERE is_active = 1")
        active_trainers = c.fetchone()[0]
        c.execute(f"SELECT COUNT(*) FROM training_programs WHERE is_active = 1" + (client_subquery.replace("client_id", "client_id") if trainer_id else ""))
        active_programs = c.fetchone()[0]
        c.execute(
            f"SELECT COUNT(*) FROM training_sessions"
            f" WHERE session_date >= date('now', '-30 days'){client_subquery}"
        )
        sessions_30d = c.fetchone()[0]
        c.execute(
            f"SELECT AVG(satisfaction_rating) FROM training_sessions"
            f" WHERE satisfaction_rating IS NOT NULL"
            f" AND session_date >= date('now', '-30 days'){client_subquery}"
        )
        avg_satisfaction = c.fetchone()[0] or 0

        c.execute(
            f"SELECT strftime('%w', session_date) AS dow, COUNT(*) AS cnt"
            f" FROM training_sessions"
            f" WHERE session_date >= date('now', '-30 days'){client_subquery}"
            f" GROUP BY dow"
        )
        by_dow = {int(r[0]): r[1] for r in c.fetchall()}
        visits_by_weekday = [
            {"day": DAY_NAMES[i], "visits": by_dow.get(i, 0)} for i in range(7)
        ]

        goal_q = "SELECT COALESCE(fitness_goal, 'не указано') AS goal, COUNT(*) AS cnt FROM clients WHERE is_active = 1"
        if trainer_id:
            goal_q += f" AND trainer_id = {trainer_id}"
        goal_q += " GROUP BY goal"
        c.execute(goal_q)
        goal_distribution = [{"goal": r[0], "count": r[1]} for r in c.fetchall()]

        if trainer_id:
            c.execute(
                """
                SELECT t.name, COUNT(ts.id) AS sessions,
                       COALESCE(AVG(ts.satisfaction_rating), 0) AS rating
                  FROM trainers t
                  LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
                       AND ts.session_date >= date('now', '-90 days')
                 WHERE t.is_active = 1 AND t.id = ?
                 GROUP BY t.id
                 ORDER BY rating DESC, sessions DESC
                """,
                (trainer_id,),
            )
        else:
            c.execute(
                """
                SELECT t.name, COUNT(ts.id) AS sessions,
                       COALESCE(AVG(ts.satisfaction_rating), 0) AS rating
                  FROM trainers t
                  LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
                       AND ts.session_date >= date('now', '-90 days')
                 WHERE t.is_active = 1
                 GROUP BY t.id
                 ORDER BY rating DESC, sessions DESC
                 LIMIT 5
                """
            )
        top_trainers = [
            {"name": r[0], "sessions": r[1], "rating": round(r[2], 2)}
            for r in c.fetchall()
        ]

        c.execute(
            f"SELECT strftime('%Y-%W', session_date) AS week, COUNT(*) AS cnt"
            f" FROM training_sessions"
            f" WHERE session_date >= date('now', '-84 days'){client_subquery}"
            f" GROUP BY week ORDER BY week"
        )
        weekly_visits = [{"week": r[0], "visits": r[1]} for r in c.fetchall()]

        return {
            "summary": {
                "active_clients": active_clients,
                "active_trainers": active_trainers,
                "active_programs": active_programs,
                "sessions_30d": sessions_30d,
                "avg_satisfaction": round(avg_satisfaction, 2),
            },
            "visits_by_weekday": visits_by_weekday,
            "goal_distribution": goal_distribution,
            "top_trainers": top_trainers,
            "weekly_visits": weekly_visits,
        }


# ==================== Per-client analytics ====================

def _client_stats(conn, client_id: int) -> dict:
    s = conn.execute(
        "SELECT COUNT(*) AS total_sessions,"
        " AVG(duration_minutes) AS avg_duration,"
        " AVG(satisfaction_rating) AS avg_satisfaction,"
        " MAX(session_date) AS last_session"
        " FROM training_sessions WHERE client_id = ?",
        (client_id,),
    ).fetchone()
    recent = conn.execute(
        "SELECT COUNT(*) FROM training_sessions WHERE client_id = ?"
        " AND session_date >= date('now', '-30 days')",
        (client_id,),
    ).fetchone()[0]
    return {
        "total_sessions": s["total_sessions"] or 0,
        "avg_duration": s["avg_duration"] or 0,
        "avg_satisfaction": s["avg_satisfaction"] or 0,
        "last_session": s["last_session"],
        "sessions_30d": recent,
    }


def calculate_churn_risk(stats: dict) -> dict:
    """Балльная модель риска оттока, эвристический индикатор для тренера.

    По ВКР: три фактора, максимум 30 + 35 + 35 = 100.
    """
    score = 0.0
    factors: list = []

    # Фактор 1: частота посещений за месяц (макс. 30).
    visits_30d = stats.get("sessions_30d") or 0
    if visits_30d >= 12:
        f1 = 0
    elif visits_30d <= 0:
        f1 = 30
    else:
        f1 = round(30 * (1 - visits_30d / 12), 1)
    if f1 >= 15:
        factors.append("Низкая частота посещений за последние 30 дней")
    score += f1

    # Фактор 2: средняя удовлетворённость (макс. 35).
    sat = stats.get("avg_satisfaction") or 0
    if sat <= 0:
        f2 = 17.5  # данных нет — средний риск
        factors.append("Нет оценок удовлетворённости")
    else:
        f2 = max(0.0, round(35 * (5 - sat) / 4, 1))
        if f2 >= 17:
            factors.append("Низкая средняя оценка удовлетворённости")
    score += f2

    # Фактор 3: общее количество тренировок (макс. 35).
    total = stats.get("total_sessions") or 0
    if total >= 50:
        f3 = 0
    else:
        f3 = round(35 * (1 - total / 50), 1)
    if f3 >= 17:
        factors.append("Малое общее количество проведённых тренировок")
    score += f3

    score = round(min(100.0, score), 1)
    if score > 70:
        level = "high"
    elif score >= 40:
        level = "medium"
    else:
        level = "low"
    return {
        "score": score,
        "level": level,
        "factors": factors,
        "components": {
            "frequency": round(f1, 1),
            "satisfaction": round(f2, 1),
            "engagement": round(f3, 1),
        },
    }


def analyze_progress(metrics_history: list) -> dict:
    if len(metrics_history) < 2:
        return {"status": "insufficient_data", "changes": {}, "insights": []}
    first = metrics_history[0]
    last = metrics_history[-1]
    changes: dict = {}
    insights: list = []

    if first.get("weight") and last.get("weight"):
        d = last["weight"] - first["weight"]
        changes["weight"] = {
            "start": first["weight"], "current": last["weight"],
            "change": round(d, 1),
        }
        if d < -2:
            insights.append({"type": "positive", "message": f"Снижение веса на {abs(d):.1f} кг"})
        elif d > 2:
            insights.append({"type": "warning", "message": f"Прирост веса +{d:.1f} кг"})

    if first.get("body_fat_percentage") and last.get("body_fat_percentage"):
        d = last["body_fat_percentage"] - first["body_fat_percentage"]
        changes["body_fat"] = {
            "start": first["body_fat_percentage"],
            "current": last["body_fat_percentage"],
            "change": round(d, 1),
        }
        if d < -1:
            insights.append({"type": "positive",
                             "message": f"Снижение % жира на {abs(d):.1f}"})

    if first.get("max_pushups") and last.get("max_pushups"):
        d = last["max_pushups"] - first["max_pushups"]
        if d > 0:
            insights.append({"type": "positive",
                             "message": f"Отжимания: +{d}"})

    pos = sum(1 for i in insights if i["type"] == "positive")
    warn = sum(1 for i in insights if i["type"] == "warning")
    status = ("excellent" if pos >= 2 else
              "good" if pos == 1 else
              "needs_attention" if warn > pos else "stable")
    return {"status": status, "changes": changes, "insights": insights}


def goals_progress(conn, client_id: int) -> list:
    goals = conn.execute(
        "SELECT * FROM client_goals WHERE client_id = ?", (client_id,)
    ).fetchall()
    last_metrics = conn.execute(
        "SELECT * FROM client_metrics WHERE client_id = ?"
        " ORDER BY measurement_date DESC LIMIT 1",
        (client_id,),
    ).fetchone()
    out: list = []
    for g in goals:
        g = dict(g)
        current = None
        if last_metrics and g["metric"] in last_metrics.keys():
            current = last_metrics[g["metric"]]
        progress = None
        if current is not None and g["target_value"]:
            try:
                progress = round(min(100.0, current / g["target_value"] * 100), 1)
            except ZeroDivisionError:
                progress = None
        g["current_value"] = current
        g["progress_percent"] = progress
        out.append(g)
    return out


def analyze_client_programs(conn, client_id: int) -> list:
    """Аналитика по каждой программе клиента: выполнение, метрики, прогресс."""
    programs = conn.execute(
        """
        SELECT tp.*, t.name AS trainer_name
          FROM training_programs tp
          LEFT JOIN trainers t ON tp.trainer_id = t.id
         WHERE tp.client_id = ?
         ORDER BY tp.start_date DESC, tp.created_at DESC
        """,
        (client_id,),
    ).fetchall()

    results = []
    for prog in programs:
        prog = dict(prog)
        program_id = prog["id"]

        # Статистика сессий по программе
        sess = conn.execute(
            """
            SELECT COUNT(*) AS cnt,
                   AVG(satisfaction_rating) AS avg_sat,
                   AVG(duration_minutes) AS avg_dur,
                   SUM(calories_burned) AS total_cal
              FROM training_sessions
             WHERE program_id = ? AND client_id = ?
            """,
            (program_id, client_id),
        ).fetchone()

        # Запланированные сессии
        planned_row = conn.execute(
            "SELECT COUNT(*) FROM training_calendar WHERE program_id = ?",
            (program_id,),
        ).fetchone()
        planned = planned_row[0] if planned_row and planned_row[0] else (
            (prog.get("duration_weeks") or 0) * (prog.get("sessions_per_week") or 0)
        )

        completion_rate = 0.0
        if planned and planned > 0 and sess["cnt"]:
            completion_rate = round(sess["cnt"] / planned, 2)

        # Метрики до и после программы
        metrics_before = None
        metrics_after = None
        metrics_change = {}

        start_date = prog.get("start_date")
        if start_date:
            before_row = conn.execute(
                """
                SELECT * FROM client_metrics
                 WHERE client_id = ? AND measurement_date <= ?
                 ORDER BY measurement_date DESC LIMIT 1
                """,
                (client_id, start_date),
            ).fetchone()
            if before_row:
                metrics_before = dict(before_row)

            after_row = conn.execute(
                """
                SELECT * FROM client_metrics
                 WHERE client_id = ? AND measurement_date >= ?
                 ORDER BY measurement_date DESC LIMIT 1
                """,
                (client_id, start_date),
            ).fetchone()
            if after_row:
                metrics_after = dict(after_row)

            if metrics_before and metrics_after:
                for col in ["weight", "body_fat_percentage", "muscle_mass",
                            "max_pushups", "plank_seconds"]:
                    b = metrics_before.get(col)
                    a = metrics_after.get(col)
                    if b is not None and a is not None:
                        metrics_change[col] = round(a - b, 2)

        # Прогресс по упражнениям (первые 3 vs последние 3 сессии)
        exercise_progress = []
        if sess["cnt"] and sess["cnt"] >= 2:
            prog_exercises = conn.execute(
                """
                SELECT pe.exercise_id, e.name AS exercise_name
                  FROM program_exercises pe
                  JOIN exercises e ON pe.exercise_id = e.id
                 WHERE pe.program_id = ?
                """,
                (program_id,),
            ).fetchall()

            for pe in prog_exercises:
                early = conn.execute(
                    """
                    WITH early AS (
                        SELECT se.actual_weight, se.actual_reps, se.rpe
                          FROM session_exercises se
                          JOIN training_sessions ts ON se.session_id = ts.id
                         WHERE ts.program_id = ? AND se.exercise_id = ?
                         ORDER BY ts.session_date ASC
                         LIMIT 3
                    )
                    SELECT AVG(actual_weight) AS avg_w,
                           AVG(actual_reps) AS avg_r,
                           AVG(rpe) AS avg_rpe
                      FROM early
                    """,
                    (program_id, pe["exercise_id"]),
                ).fetchone()

                late = conn.execute(
                    """
                    WITH late AS (
                        SELECT se.actual_weight, se.actual_reps, se.rpe
                          FROM session_exercises se
                          JOIN training_sessions ts ON se.session_id = ts.id
                         WHERE ts.program_id = ? AND se.exercise_id = ?
                         ORDER BY ts.session_date DESC
                         LIMIT 3
                    )
                    SELECT AVG(actual_weight) AS avg_w,
                           AVG(actual_reps) AS avg_r,
                           AVG(rpe) AS avg_rpe
                      FROM late
                    """,
                    (program_id, pe["exercise_id"]),
                ).fetchone()

                has_early = early and (early["avg_w"] is not None or early["avg_r"] is not None)
                has_late = late and (late["avg_w"] is not None or late["avg_r"] is not None)
                if has_early or has_late:
                    exercise_progress.append({
                        "exercise_name": pe["exercise_name"],
                        "early_avg_weight": round(early["avg_w"], 1) if early and early["avg_w"] else None,
                        "late_avg_weight": round(late["avg_w"], 1) if late and late["avg_w"] else None,
                        "early_avg_reps": round(early["avg_r"], 1) if early and early["avg_r"] else None,
                        "late_avg_reps": round(late["avg_r"], 1) if late and late["avg_r"] else None,
                        "early_avg_rpe": round(early["avg_rpe"], 1) if early and early["avg_rpe"] else None,
                        "late_avg_rpe": round(late["avg_rpe"], 1) if late and late["avg_rpe"] else None,
                    })

        # Управленческие рекомендации по коррекции
        recommendations = []
        goal = prog.get("goal") or ""
        avg_sat = sess["avg_sat"] if sess["avg_sat"] else None

        if planned and planned > 0 and completion_rate < 0.5:
            recommendations.append(
                "Низкая выполняемость программы — рассмотреть снижение частоты или сложности"
            )
        elif planned and planned > 0 and completion_rate > 0.9:
            recommendations.append(
                "Высокая выполняемость — можно увеличить нагрузку для прогрессии"
            )

        if avg_sat is not None and avg_sat < 3:
            recommendations.append(
                "Низкая удовлетворенность — пересмотреть подбор упражнений или тренера"
            )
        elif avg_sat is not None and avg_sat >= 4.5:
            recommendations.append(
                "Клиент доволен программой — зафиксировать подход как эффективный"
            )

        if metrics_change:
            if "weight_loss" in goal or goal == "похудение":
                if metrics_change.get("weight", 0) >= 0:
                    recommendations.append(
                        "Вес не снижается — усилить кардио-компонент или скорректировать питание"
                    )
                elif metrics_change.get("weight", 0) < -1:
                    recommendations.append(
                        "Хорошая динамика веса — поддерживать текущий подход"
                    )
            if "muscle_gain" in goal or goal == "набор массы":
                if metrics_change.get("muscle_mass", 0) <= 0:
                    recommendations.append(
                        "Мышечная масса не растет — увеличить объем силовой нагрузки"
                    )
                elif metrics_change.get("muscle_mass", 0) > 0.5:
                    recommendations.append(
                        "Положительная динамика мышечной массы — подход работает"
                    )
            if "endurance" in goal or goal == "выносливость":
                if metrics_change.get("max_pushups", 0) <= 0 and metrics_change.get("plank_seconds", 0) <= 0:
                    recommendations.append(
                        "Показатели выносливости стагнируют — повысить интенсивность"
                    )
                elif metrics_change.get("max_pushups", 0) > 3 or metrics_change.get("plank_seconds", 0) > 10:
                    recommendations.append(
                        "Выносливость растет — программа эффективна"
                    )
        else:
            recommendations.append(
                "Нет данных по изменению метрик — рекомендуется провести замеры для оценки эффективности"
            )

        results.append({
            "program_id": program_id,
            "program_name": prog["name"],
            "goal": prog.get("goal"),
            "trainer_name": prog.get("trainer_name"),
            "start_date": start_date,
            "is_active": prog.get("is_active", 1),
            "sessions_count": sess["cnt"] or 0,
            "avg_satisfaction": round(avg_sat, 1) if avg_sat is not None else None,
            "avg_duration": round(sess["avg_dur"], 0) if sess["avg_dur"] else None,
            "total_calories": sess["total_cal"] or 0,
            "planned_sessions": planned,
            "completion_rate": completion_rate,
            "metrics_before": ({k: v for k, v in metrics_before.items()
                                if k in ("weight", "body_fat_percentage", "muscle_mass",
                                         "max_pushups", "plank_seconds") and v is not None}
                               if metrics_before else None),
            "metrics_after": ({k: v for k, v in metrics_after.items()
                               if k in ("weight", "body_fat_percentage", "muscle_mass",
                                        "max_pushups", "plank_seconds") and v is not None}
                              if metrics_after else None),
            "metrics_change": metrics_change,
            "exercise_progress": exercise_progress,
            "recommendations": recommendations,
        })

    return results


@router.get("/api/analytics/client/{client_id}")
async def get_client_analytics(client_id: int, user: dict = Depends(get_current_user)):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db_raw() as conn:
        client = conn.execute(
            "SELECT * FROM clients WHERE id = ?", (client_id,)
        ).fetchone()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        client = dict(client)

        stats = _client_stats(conn, client_id)
        monthly = conn.execute(
            "SELECT strftime('%Y-%m', session_date) AS month, COUNT(*) AS visits"
            " FROM training_sessions WHERE client_id = ?"
            " GROUP BY month ORDER BY month DESC LIMIT 12",
            (client_id,),
        ).fetchall()
        monthly_visits = [{"month": r[0], "visits": r[1]} for r in monthly]

        metrics_history = [
            dict(r) for r in conn.execute(
                "SELECT * FROM client_metrics WHERE client_id = ?"
                " ORDER BY measurement_date",
                (client_id,),
            ).fetchall()
        ]
        progress = analyze_progress(metrics_history)
        goals = goals_progress(conn, client_id)

        current_program = conn.execute(
            """
            SELECT tp.*, t.name AS trainer_name
              FROM training_programs tp
              LEFT JOIN trainers t ON tp.trainer_id = t.id
             WHERE tp.client_id = ? AND tp.is_active = 1
             ORDER BY tp.created_at DESC LIMIT 1
            """,
            (client_id,),
        ).fetchone()
        churn = calculate_churn_risk(stats)
        program_analytics = analyze_client_programs(conn, client_id)

        return {
            "client": client,
            "session_stats": stats,
            "monthly_visits": monthly_visits,
            "metrics_history": metrics_history,
            "progress_analysis": progress,
            "goals": goals,
            "current_program": dict(current_program) if current_program else None,
            "churn_risk": churn,
            "program_analytics": program_analytics,
        }


# ==================== Churn analytics (heuristic + survival) ====================

@router.get("/api/analytics/churn")
async def get_churn_analytics(user: dict = Depends(require_roles("admin", "trainer"))):
    """Аналитика оттока клиентов: оперативный балльный индикатор + анализ
    выживаемости (Каплан—Майер по группам типов абонементов)."""
    with get_db_raw() as conn:
        clients = [dict(r) for r in conn.execute(
            "SELECT * FROM clients").fetchall()]
        scored = []
        for cl in clients:
            if not cl["is_active"]:
                continue
            stats = _client_stats(conn, cl["id"])
            risk = calculate_churn_risk(stats)
            scored.append({
                "client_id": cl["id"],
                "client_name": cl["name"],
                "subscription_type": cl["subscription_type"],
                "last_session": stats.get("last_session"),
                "total_sessions": stats.get("total_sessions"),
                "risk": risk,
            })
        scored.sort(key=lambda x: x["risk"]["score"], reverse=True)
        risk_distribution = {
            "high": sum(1 for s in scored if s["risk"]["level"] == "high"),
            "medium": sum(1 for s in scored if s["risk"]["level"] == "medium"),
            "low": sum(1 for s in scored if s["risk"]["level"] == "low"),
        }

        survival = _kaplan_meier_by_subscription(conn)
        cox = _cox_regression(conn)

    return {
        "clients": scored[:200],
        "risk_distribution": risk_distribution,
        "survival_analysis": survival,
        "cox_regression": cox,
    }


def _kaplan_meier_by_subscription(conn) -> dict:
    """Кривые Каплана—Майера по группам типов абонементов + log-rank."""
    try:
        from lifelines import KaplanMeierFitter
        from lifelines.statistics import multivariate_logrank_test
    except ImportError:
        return {"available": False, "reason": "lifelines не установлен"}

    rows = conn.execute(
        """
        SELECT c.id, c.subscription_type, c.is_active,
               COALESCE(c.subscription_start_date, c.registration_date)
                   AS start_date,
               (SELECT MAX(session_date) FROM training_sessions ts
                 WHERE ts.client_id = c.id) AS last_session
          FROM clients c
        """
    ).fetchall()

    durations: list = []
    events: list = []
    groups: list = []
    today = datetime.now()
    for r in rows:
        try:
            start = datetime.strptime(r["start_date"], "%Y-%m-%d")
        except (TypeError, ValueError):
            continue
        # Отток: клиент неактивен — событие наступило в момент last_session
        # (или сегодня, если сессий не было). Активный клиент = цензура.
        if r["is_active"] == 0:
            try:
                end = datetime.strptime(r["last_session"], "%Y-%m-%d")
            except (TypeError, ValueError):
                end = today
            event = 1
        else:
            end = today
            event = 0
        days = max(1, (end - start).days)
        durations.append(days)
        events.append(event)
        groups.append(r["subscription_type"] or "unknown")

    if len(durations) < 5:
        return {"available": False, "reason": "недостаточно данных"}

    durations_a = np.array(durations, dtype=float)
    events_a = np.array(events, dtype=int)
    groups_a = np.array(groups)

    curves: list = []
    for g in sorted(set(groups_a)):
        mask = groups_a == g
        if mask.sum() < 3:
            continue
        kmf = KaplanMeierFitter()
        kmf.fit(durations_a[mask], events_a[mask], label=g)
        timeline = kmf.survival_function_.index.tolist()
        survival = kmf.survival_function_[g].tolist()
        curves.append({
            "group": g,
            "n": int(mask.sum()),
            "events": int(events_a[mask].sum()),
            "median_survival_days": (None if math.isinf(kmf.median_survival_time_)
                                     else float(kmf.median_survival_time_)),
            "timeline": [float(t) for t in timeline],
            "survival": [round(float(s), 4) for s in survival],
        })

    logrank = None
    if len({g for g in groups_a}) > 1:
        try:
            test = multivariate_logrank_test(durations_a, groups_a, events_a)
            logrank = {
                "statistic": round(float(test.test_statistic), 3),
                "p_value": round(float(test.p_value), 5),
            }
        except Exception:
            logrank = None

    return {"available": True, "curves": curves, "logrank": logrank}


def _cox_regression(conn) -> dict:
    """Регрессия Кокса по признакам клиента."""
    try:
        from lifelines import CoxPHFitter
    except ImportError:
        return {"available": False, "reason": "lifelines не установлен"}

    import pandas as pd

    rows = conn.execute(
        """
        SELECT c.id, c.is_active, c.birth_date,
               COALESCE(c.subscription_start_date, c.registration_date) AS start_date,
               (SELECT MAX(session_date) FROM training_sessions ts
                 WHERE ts.client_id = c.id) AS last_session,
               (SELECT COUNT(*) FROM training_sessions ts
                 WHERE ts.client_id = c.id) AS total_sessions,
               (SELECT AVG(satisfaction_rating) FROM training_sessions ts
                 WHERE ts.client_id = c.id) AS avg_satisfaction
          FROM clients c
        """
    ).fetchall()

    today = datetime.now()
    records: list = []
    for r in rows:
        try:
            start = datetime.strptime(r["start_date"], "%Y-%m-%d")
        except (TypeError, ValueError):
            continue
        if r["is_active"] == 0:
            try:
                end = datetime.strptime(r["last_session"], "%Y-%m-%d")
            except (TypeError, ValueError):
                end = today
            event = 1
        else:
            end = today
            event = 0
        days = max(1, (end - start).days)
        try:
            age = (today - datetime.strptime(r["birth_date"], "%Y-%m-%d")).days / 365.25
        except (TypeError, ValueError):
            age = 30.0
        records.append({
            "duration": days,
            "event": event,
            "age": age,
            "total_sessions": r["total_sessions"] or 0,
            "avg_satisfaction": float(r["avg_satisfaction"]) if r["avg_satisfaction"] else 3.0,
            "subscription_days": days,
        })

    if len(records) < 20 or sum(r["event"] for r in records) < 3:
        return {"available": False, "reason": "недостаточно событий для модели Кокса"}

    df = pd.DataFrame(records)
    try:
        cph = CoxPHFitter(penalizer=0.01)
        cph.fit(df.drop(columns=["subscription_days"]),
                duration_col="duration", event_col="event")
        summary = cph.summary
        coefs = []
        for name, row in summary.iterrows():
            coefs.append({
                "covariate": name,
                "hazard_ratio": round(float(row["exp(coef)"]), 3),
                "ci_lower": round(float(row["exp(coef) lower 95%"]), 3),
                "ci_upper": round(float(row["exp(coef) upper 95%"]), 3),
                "p_value": round(float(row["p"]), 5),
            })
        return {
            "available": True,
            "n": len(df),
            "events": int(df["event"].sum()),
            "concordance_index": round(float(cph.concordance_index_), 3),
            "coefficients": coefs,
        }
    except Exception as exc:
        return {"available": False, "reason": str(exc)}


# ==================== Clustering (k-means + PCA) ====================

@router.get("/api/analytics/segments")
async def get_client_segments(
    k: int = 4,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    """Сегментация клиентской базы методом k-средних с проекцией PCA."""
    try:
        from sklearn.cluster import KMeans
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import silhouette_score
    except ImportError:
        return {"available": False, "reason": "scikit-learn не установлен"}

    with get_db_raw() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.name, c.birth_date, c.fitness_goal,
                   (SELECT weight FROM client_metrics m
                     WHERE m.client_id = c.id ORDER BY m.measurement_date LIMIT 1)
                       AS init_weight,
                   (SELECT body_fat_percentage FROM client_metrics m
                     WHERE m.client_id = c.id ORDER BY m.measurement_date LIMIT 1)
                       AS init_bf,
                   (SELECT max_pushups FROM client_metrics m
                     WHERE m.client_id = c.id ORDER BY m.measurement_date LIMIT 1)
                       AS init_pushups,
                   (SELECT plank_seconds FROM client_metrics m
                     WHERE m.client_id = c.id ORDER BY m.measurement_date LIMIT 1)
                       AS init_plank,
                   (SELECT COUNT(*) * 1.0 / 4.3 FROM training_sessions ts
                     WHERE ts.client_id = c.id
                       AND ts.session_date >= date('now', '-30 days'))
                       AS visits_per_week
              FROM clients c
             WHERE c.is_active = 1
            """
        ).fetchall()

    today = datetime.now()
    feats = []
    meta = []
    for r in rows:
        try:
            age = (today - datetime.strptime(r["birth_date"], "%Y-%m-%d")).days / 365.25
        except (TypeError, ValueError):
            continue
        if any(r[col] is None for col in
               ["init_weight", "init_bf", "init_pushups", "init_plank"]):
            continue
        feats.append([
            age, r["init_weight"], r["init_bf"], r["init_pushups"],
            r["init_plank"], r["visits_per_week"] or 0,
        ])
        meta.append({"id": r["id"], "name": r["name"], "goal": r["fitness_goal"]})

    if len(feats) < max(8, k * 2):
        return {"available": False, "reason": "недостаточно клиентов с замерами"}

    X = np.array(feats, dtype=float)
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(Xs)

    sil = float(silhouette_score(Xs, labels)) if len(set(labels)) > 1 else None

    pca = PCA(n_components=2)
    Xp = pca.fit_transform(Xs)

    points = [
        {
            "client_id": meta[i]["id"],
            "name": meta[i]["name"],
            "goal": meta[i]["goal"],
            "cluster": int(labels[i]),
            "x": round(float(Xp[i, 0]), 3),
            "y": round(float(Xp[i, 1]), 3),
        }
        for i in range(len(meta))
    ]

    centroids_orig = scaler.inverse_transform(km.cluster_centers_)
    feature_names = ["age", "weight", "body_fat", "pushups", "plank_sec",
                     "visits_per_week"]
    clusters_summary = []
    for j in range(k):
        size = int((labels == j).sum())
        clusters_summary.append({
            "cluster": j,
            "size": size,
            "centroid": {
                feature_names[m]: round(float(centroids_orig[j, m]), 2)
                for m in range(len(feature_names))
            },
        })

    return {
        "available": True,
        "k": k,
        "silhouette": round(sil, 3) if sil is not None else None,
        "explained_variance": [
            round(float(v), 3) for v in pca.explained_variance_ratio_
        ],
        "points": points,
        "clusters": clusters_summary,
    }


# ==================== Statistical comparison of programs ====================

def _holm_correction(p_values: list) -> list:
    """Поправка Холма на множественные сравнения."""
    n = len(p_values)
    indexed = sorted(enumerate(p_values), key=lambda x: x[1])
    adjusted = [0.0] * n
    running_max = 0.0
    for rank, (orig_idx, p) in enumerate(indexed):
        adj = min(1.0, p * (n - rank))
        running_max = max(running_max, adj)
        adjusted[orig_idx] = round(running_max, 5)
    return adjusted


def _cohens_d(a: list, b: list) -> float:
    a = np.array(a, dtype=float); b = np.array(b, dtype=float)
    if len(a) < 2 or len(b) < 2:
        return 0.0
    s1, s2 = a.var(ddof=1), b.var(ddof=1)
    pooled = math.sqrt(((len(a) - 1) * s1 + (len(b) - 1) * s2) / (len(a) + len(b) - 2))
    if pooled == 0:
        return 0.0
    return float((a.mean() - b.mean()) / pooled)


@router.get("/api/analytics/programs")
async def get_programs_analytics(
    metric: str = "weight_change",
    user: dict = Depends(require_roles("admin", "trainer")),
):
    """Сравнение эффективности программ по выбранной целевой метрике.

    Поддерживаемые метрики:
      weight_change       — снижение массы тела (в кг, отрицательное = снижение);
      bodyfat_change      — изменение процента жировой ткани;
      pushups_change      — прирост максимума отжиманий.
    """
    try:
        from scipy import stats
    except ImportError:
        return {"available": False, "reason": "scipy не установлен"}

    column_map = {
        "weight_change": "weight",
        "bodyfat_change": "body_fat_percentage",
        "pushups_change": "max_pushups",
    }
    if metric not in column_map:
        raise HTTPException(status_code=400, detail="Unknown metric")
    col = column_map[metric]

    with get_db_raw() as conn:
        # Программы группируются по наименованию: одна и та же методика
        # может быть назначена многим клиентам как разные записи training_programs.
        programs = conn.execute(
            "SELECT name, GROUP_CONCAT(client_id) AS client_ids"
            " FROM training_programs"
            " GROUP BY name"
        ).fetchall()
        program_data: dict = {}
        for p in programs:
            if not p["client_ids"]:
                continue
            client_ids = [int(x) for x in p["client_ids"].split(",")]
            values: list = []
            for cid in set(client_ids):
                ms = conn.execute(
                    f"SELECT {col} FROM client_metrics WHERE client_id = ?"
                    f" AND {col} IS NOT NULL ORDER BY measurement_date",
                    (cid,),
                ).fetchall()
                if len(ms) >= 2:
                    values.append(float(ms[-1][0]) - float(ms[0][0]))
            if len(values) >= 3:
                program_data[p["name"]] = values

    if len(program_data) < 2:
        return {"available": False,
                "reason": "недостаточно программ с замерами клиентов"}

    # Проверка нормальности в каждой группе.
    normality = {}
    all_normal = True
    for name, vals in program_data.items():
        if len(vals) >= 3:
            stat, p_val = stats.shapiro(vals)
            normality[name] = {"statistic": round(float(stat), 3),
                                "p_value": round(float(p_val), 5)}
            if p_val < 0.05:
                all_normal = False

    program_names = list(program_data.keys())
    descriptive = [
        {
            "program": n,
            "n": len(v),
            "mean": round(float(np.mean(v)), 3),
            "std": round(float(np.std(v, ddof=1)), 3) if len(v) > 1 else 0.0,
            "median": round(float(np.median(v)), 3),
        }
        for n, v in program_data.items()
    ]

    # Глобальный тест по всем группам.
    samples = list(program_data.values())
    if all_normal:
        if len(samples) == 2:
            stat, p_val = stats.ttest_ind(samples[0], samples[1], equal_var=False)
            test_name = "Welch t-test"
        else:
            stat, p_val = stats.f_oneway(*samples)
            test_name = "One-way ANOVA"
    else:
        if len(samples) == 2:
            stat, p_val = stats.mannwhitneyu(samples[0], samples[1],
                                              alternative="two-sided")
            test_name = "Mann–Whitney U"
        else:
            stat, p_val = stats.kruskal(*samples)
            test_name = "Kruskal–Wallis"

    overall = {
        "test": test_name,
        "statistic": round(float(stat), 3),
        "p_value": round(float(p_val), 5),
    }

    # Попарные сравнения.
    pairwise: list = []
    raw_p: list = []
    for i in range(len(program_names)):
        for j in range(i + 1, len(program_names)):
            a = program_data[program_names[i]]
            b = program_data[program_names[j]]
            if all_normal:
                s, pv = stats.ttest_ind(a, b, equal_var=False)
                method = "Welch t-test"
            else:
                s, pv = stats.mannwhitneyu(a, b, alternative="two-sided")
                method = "Mann–Whitney U"
            d = _cohens_d(a, b)
            # 95% ДИ разности средних (нормальная аппроксимация).
            mean_diff = float(np.mean(a) - np.mean(b))
            se = math.sqrt(np.var(a, ddof=1) / len(a) + np.var(b, ddof=1) / len(b))
            ci = (round(mean_diff - 1.96 * se, 3), round(mean_diff + 1.96 * se, 3))
            pairwise.append({
                "program_a": program_names[i],
                "program_b": program_names[j],
                "method": method,
                "statistic": round(float(s), 3),
                "p_value": round(float(pv), 5),
                "cohens_d": round(d, 3),
                "mean_diff": round(mean_diff, 3),
                "ci95": ci,
            })
            raw_p.append(float(pv))

    holm = _holm_correction(raw_p)
    for i, hp in enumerate(holm):
        pairwise[i]["p_value_holm"] = hp

    return {
        "available": True,
        "metric": metric,
        "all_normal": all_normal,
        "normality": normality,
        "descriptive": descriptive,
        "overall_test": overall,
        "pairwise": pairwise,
    }


# ==================== Gym Load ====================

@router.get("/api/analytics/gym-load")
async def get_gym_load(user: dict = Depends(require_roles("admin"))):
    with get_db_raw() as conn:
        total_30d = conn.execute(
            "SELECT COUNT(*) FROM training_sessions"
            " WHERE session_date >= date('now', '-30 days')"
        ).fetchone()[0]

        by_hour = conn.execute(
            """
            SELECT CAST(strftime('%H', start_time) AS INTEGER) AS hour, COUNT(*) AS cnt
              FROM training_sessions
             WHERE session_date >= date('now', '-30 days')
               AND start_time IS NOT NULL
             GROUP BY hour
             ORDER BY hour
            """
        ).fetchall()
        by_hour_list = [{"hour": r[0] or 0, "visits": r[1]} for r in by_hour]

        peak = sorted(by_hour_list, key=lambda x: x["visits"], reverse=True)[:5]

        by_weekday_hour = conn.execute(
            """
            SELECT CAST(strftime('%w', session_date) AS INTEGER) AS weekday,
                   CAST(strftime('%H', start_time) AS INTEGER) AS hour,
                   COUNT(*) AS cnt
              FROM training_sessions
             WHERE session_date >= date('now', '-30 days')
               AND start_time IS NOT NULL
             GROUP BY weekday, hour
             ORDER BY weekday, hour
            """
        ).fetchall()
        by_weekday_hour_list = [
            {"weekday": r[0] or 0, "hour": r[1] or 0, "visits": r[2]} for r in by_weekday_hour
        ]

        return {
            "total_sessions_30d": total_30d,
            "avg_per_day": round(total_30d / 30, 1) if total_30d else 0,
            "by_hour": by_hour_list,
            "by_weekday_hour": by_weekday_hour_list,
            "peak_hours": peak,
        }


