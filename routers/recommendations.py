from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from dependencies import (
    get_db_raw,
    get_current_user, require_roles,
    DAY_NAMES,
    sql_date_sub, sql_dow, sql_bool_true, sql_bool_false,
)

router = APIRouter()

# ==================== Recommendations ====================

def _recompute_recommendations(conn) -> int:
    conn.execute(text(f"DELETE FROM recommendations WHERE COALESCE(is_applied, {sql_bool_false()}) = {sql_bool_false()}"))
    result = conn.execute(
        text(f"""
        SELECT t.id, t.name, COUNT(ts.id) AS sessions
          FROM trainers t
          LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
               AND ts.session_date >= {sql_date_sub(30)}
         WHERE t.is_active = {sql_bool_true()}
         GROUP BY t.id
        """)
    )
    rows = result.fetchall()
    for r in rows:
        if r._mapping["sessions"] < 20:
            conn.execute(
                text("""
                INSERT INTO recommendations (trainer_id, recommendation_type, title, description, priority)
                VALUES (:trainer_id, :recommendation_type, :title, :description, :priority)
                """),
                {
                    "trainer_id": r._mapping["id"],
                    "recommendation_type": "trainer_load",
                    "title": f"Низкая загрузка тренера {r._mapping['name']}",
                    "description": f"За последние 30 дней проведено {r._mapping['sessions']} сессий (менее 20). Рекомендуется перераспределить клиентов.",
                    "priority": 8,
                },
            )
        elif r._mapping["sessions"] > 40:
            conn.execute(
                text("""
                INSERT INTO recommendations (trainer_id, recommendation_type, title, description, priority)
                VALUES (:trainer_id, :recommendation_type, :title, :description, :priority)
                """),
                {
                    "trainer_id": r._mapping["id"],
                    "recommendation_type": "trainer_overload",
                    "title": f"Высокая загрузка тренера {r._mapping['name']}",
                    "description": f"За последние 30 дней проведено {r._mapping['sessions']} сессий (более 40). Рекомендуется перераспределить часть клиентов.",
                    "priority": 7,
                },
            )
    result = conn.execute(
        text(f"""
        SELECT {sql_dow('session_date')} AS dow, COUNT(*) AS cnt
          FROM training_sessions
         WHERE session_date >= {sql_date_sub(30)}
         GROUP BY {sql_dow('session_date')}
        """)
    )
    rows = result.fetchall()
    counts = {int(r._mapping["dow"]): r._mapping["cnt"] for r in rows}
    if counts:
        avg = sum(counts.values()) / 7
        weak_days = [DAY_NAMES[d] for d in range(7) if counts.get(d, 0) < avg * 0.7]
        if weak_days and avg > 0:
            conn.execute(
                text("""
                INSERT INTO recommendations (recommendation_type, title, description, priority)
                VALUES (:recommendation_type, :title, :description, :priority)
                """),
                {
                    "recommendation_type": "weekday_load",
                    "title": "Неравномерная посещаемость по дням недели",
                    "description": f"Просадка посещений в дни: {', '.join(weak_days)}. Рекомендуется выровнять расписание или ввести стимулирующие акции.",
                    "priority": 6,
                },
            )
    result = conn.execute(text(f"SELECT COUNT(*) FROM recommendations WHERE COALESCE(is_applied, {sql_bool_false()}) = {sql_bool_false()}"))
    row = result.fetchone()
    return row[0]


@router.post("/api/recommendations/recompute")
async def recompute_recommendations(
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        n = _recompute_recommendations(conn)
        conn.commit()
    return {"count": n}


@router.get("/api/recommendations")
async def list_recommendations(
    include_applied: int = 0,
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        q = "SELECT * FROM recommendations"
        if not include_applied:
            q += f" WHERE COALESCE(is_applied, {sql_bool_false()}) = {sql_bool_false()}"
        q += " ORDER BY priority DESC, created_at DESC"
        result = conn.execute(text(q))
        rows = result.fetchall()
        return [dict(r._mapping) for r in rows]


@router.post("/api/recommendations/{rec_id}/apply")
async def apply_recommendation(
    rec_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        conn.execute(text(f"UPDATE recommendations SET is_applied = {sql_bool_true()} WHERE id = :rec_id"), {"rec_id": rec_id})
        conn.commit()
    return {"ok": True}
