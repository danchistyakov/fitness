from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, delete

from dependencies import (
    get_db, orm_to_dict,
    get_current_user, require_roles,
    _check_trainer_owns_client,
)
from schemas import ClientMetricsCreate
from models import ClientMetric

router = APIRouter()

# ==================== Client Metrics ====================

@router.get("/api/metrics/{client_id}")
async def get_client_metrics(
    client_id: int,
    limit: int = 50,
    user: dict = Depends(get_current_user),
):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        rows = session.execute(
            select(ClientMetric)
            .where(ClientMetric.client_id == client_id)
            .order_by(ClientMetric.measurement_date.desc())
            .limit(limit)
        ).scalars().all()
        return [orm_to_dict(r) for r in rows]


@router.post("/api/metrics")
async def create_metrics(
    m: ClientMetricsCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), m.client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        metric = ClientMetric(
            client_id=m.client_id,
            measurement_date=m.measurement_date,
            weight=m.weight,
            body_fat_percentage=m.body_fat_percentage,
            muscle_mass=m.muscle_mass,
            chest_cm=m.chest_cm,
            waist_cm=m.waist_cm,
            hips_cm=m.hips_cm,
            biceps_cm=m.biceps_cm,
            thighs_cm=m.thighs_cm,
            resting_heart_rate=m.resting_heart_rate,
            max_pushups=m.max_pushups,
            max_pullups=m.max_pullups,
            plank_seconds=m.plank_seconds,
            run_5km_minutes=m.run_5km_minutes,
        )
        session.add(metric)
        session.commit()
        session.refresh(metric)
    return {"id": metric.id}


@router.put("/api/metrics/{metric_id}")
async def update_metrics(
    metric_id: int,
    m: ClientMetricsCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    fields = m.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as session:
        existing = session.execute(select(ClientMetric).where(ClientMetric.id == metric_id)).scalar_one_or_none()
        if not existing:
            raise HTTPException(status_code=404, detail="Metric not found")
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), existing.client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        session.execute(update(ClientMetric).where(ClientMetric.id == metric_id).values(**fields))
        session.commit()
    return {"message": "Metric updated"}


@router.delete("/api/metrics/{metric_id}")
async def delete_metrics(
    metric_id: int,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as session:
        existing = session.execute(select(ClientMetric).where(ClientMetric.id == metric_id)).scalar_one_or_none()
        if not existing:
            raise HTTPException(status_code=404, detail="Metric not found")
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), existing.client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        session.execute(delete(ClientMetric).where(ClientMetric.id == metric_id))
        session.commit()
    return {"message": "Metric deleted"}


