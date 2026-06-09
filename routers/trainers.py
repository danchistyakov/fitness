import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, BaseModel
from sqlalchemy import select, update, func

from dependencies import (
    get_db, orm_to_dict,
    get_current_user, require_roles,
    _hash_password,
)
from schemas import TrainerCreate
from models import Trainer, TrainingSession, User

router = APIRouter()

# ==================== Trainers ====================

@router.get("/api/trainers")
async def get_trainers(user: dict = Depends(get_current_user)):
    with get_db() as session:
        rows = session.execute(select(Trainer).where(Trainer.is_active.is_(True)).order_by(Trainer.rating.desc())).scalars().all()
        return [orm_to_dict(r) for r in rows]


class TrainerUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    experience_years: Optional[int] = None
    rating: Optional[float] = Field(None, ge=0, le=5)
    is_active: Optional[bool] = None


@router.post("/api/trainers")
async def create_trainer(
    trainer: TrainerCreate,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        db_trainer = Trainer(name=trainer.name, specialization=trainer.specialization, experience_years=trainer.experience_years)
        session.add(db_trainer)
        session.commit()
        session.refresh(db_trainer)
        trainer_id = db_trainer.id

        # Автоматическая генерация учётной записи тренера
        login = trainer.login or f"trainer{trainer_id:02d}"
        existing_user = session.execute(select(User).where(User.login == login)).scalar_one_or_none()
        if existing_user:
            login = f"trainer{trainer_id:02d}_{secrets.token_hex(2)}"

        password = trainer.password or secrets.token_urlsafe(8)
        db_user = User(
            login=login,
            password_hash=_hash_password(password),
            role="trainer",
            full_name=trainer.name,
            trainer_id=trainer_id,
            is_active=True,
        )
        session.add(db_user)
        session.commit()

    return {"id": trainer_id, "login": login, "password": password, "message": "Trainer created"}


@router.put("/api/trainers/{trainer_id}")
async def update_trainer(
    trainer_id: int,
    trainer: TrainerUpdate,
    user: dict = Depends(require_roles("admin")),
):
    fields = trainer.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as session:
        session.execute(update(Trainer).where(Trainer.id == trainer_id).values(**fields))
        session.commit()
    return {"message": "Trainer updated"}


@router.delete("/api/trainers/{trainer_id}")
async def delete_trainer(
    trainer_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        session.execute(update(Trainer).where(Trainer.id == trainer_id).values(is_active=False))
        session.commit()
    return {"message": "Trainer deactivated"}


def _recalculate_trainer_rating(session, trainer_id: int) -> float:
    """Пересчитывает рейтинг тренера на основании средней оценки
    удовлетворённости клиентов за последние 90 дней."""
    from sqlalchemy import func
    from models import TrainingSession
    cutoff = (datetime.now() - timedelta(days=90)).date()
    avg_sat = session.execute(
        func.avg(TrainingSession.satisfaction_rating)
        .where(
            TrainingSession.trainer_id == trainer_id,
            TrainingSession.satisfaction_rating.isnot(None),
            TrainingSession.session_date >= cutoff,
        )
    ).scalar()
    if avg_sat is not None:
        new_rating = round(float(avg_sat), 2)
        session.execute(
            update(Trainer).where(Trainer.id == trainer_id).values(rating=new_rating)
        )
        session.commit()
        return new_rating
    return 0.0


@router.post("/api/trainers/{trainer_id}/recalculate-rating")
async def recalculate_trainer_rating(
    trainer_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        trainer = session.execute(select(Trainer).where(Trainer.id == trainer_id)).scalar_one_or_none()
        if not trainer:
            raise HTTPException(status_code=404, detail="Trainer not found")
        new_rating = _recalculate_trainer_rating(session, trainer_id)
    return {"trainer_id": trainer_id, "new_rating": new_rating}


