from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from dependencies import (
    get_db, orm_to_dict,
    get_current_user, require_roles,
    _check_trainer_owns_client,
)
from schemas import ClientGoalCreate, ClientGoalUpdate
from models import ClientGoal

router = APIRouter()

# ==================== Client Goals ====================

def _check_client_owns_goal(session: Session, client_id: Optional[int], goal_id: int) -> bool:
    if not client_id:
        return False
    goal = session.execute(select(ClientGoal).where(ClientGoal.id == goal_id)).scalar_one_or_none()
    return goal is not None and goal.client_id == client_id


@router.get("/api/goals/{client_id}")
async def get_client_goals(client_id: int, user: dict = Depends(get_current_user)):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        rows = session.execute(
            select(ClientGoal)
            .where(ClientGoal.client_id == client_id)
            .order_by(ClientGoal.created_at.desc())
        ).scalars().all()
        return [orm_to_dict(r) for r in rows]


@router.post("/api/goals")
async def create_goal(
    goal: ClientGoalCreate,
    user: dict = Depends(require_roles("admin", "trainer", "client")),
):
    if user["role"] == "client" and user.get("client_id") != goal.client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), goal.client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        init_status = goal.status if user["role"] in ("admin", "trainer") else "pending"
        db_goal = ClientGoal(
            client_id=goal.client_id,
            metric=goal.metric,
            target_value=goal.target_value,
            target_date=goal.target_date,
            status=init_status,
        )
        session.add(db_goal)
        session.commit()
        session.refresh(db_goal)
    return {"id": db_goal.id}


@router.post("/api/goals/{goal_id}/achieve")
async def mark_goal_achieved(
    goal_id: int,
    user: dict = Depends(require_roles("admin", "trainer", "client")),
):
    with get_db() as session:
        if user["role"] == "client" and not _check_client_owns_goal(session, user.get("client_id"), goal_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        session.execute(update(ClientGoal).where(ClientGoal.id == goal_id).values(achieved_at=func.current_timestamp()))
        session.commit()
    return {"ok": True}


@router.post("/api/goals/{goal_id}/status")
async def update_goal_status(
    goal_id: int,
    status: str,
    user: dict = Depends(require_roles("admin", "trainer", "client")),
):
    if status not in ("pending", "achieved", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    with get_db() as session:
        if user["role"] == "client" and not _check_client_owns_goal(session, user.get("client_id"), goal_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        session.execute(update(ClientGoal).where(ClientGoal.id == goal_id).values(status=status))
        session.commit()
    return {"ok": True}


@router.put("/api/goals/{goal_id}")
async def update_goal(
    goal_id: int,
    goal: ClientGoalUpdate,
    user: dict = Depends(require_roles("admin", "trainer", "client")),
):
    fields = goal.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "status" in fields and fields["status"] not in ("pending", "achieved", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    with get_db() as session:
        if user["role"] == "client" and not _check_client_owns_goal(session, user.get("client_id"), goal_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        # Клиенту нельзя менять achieved_at — только тренер/админ
        if user["role"] == "client" and "achieved_at" in fields:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        session.execute(update(ClientGoal).where(ClientGoal.id == goal_id).values(**fields))
        session.commit()
    return {"message": "Goal updated"}
