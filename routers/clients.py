from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select, insert, update, delete, func, text

from dependencies import get_db, orm_to_dict, get_current_user, require_roles, _check_trainer_owns_client
from schemas import *
from models import Client, Trainer

router = APIRouter()

# ==================== Clients ====================

@router.get("/api/clients")
async def get_clients(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    subscription_type: Optional[str] = None,
    fitness_goal: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    with get_db() as session:
        stmt = select(Client)
        if user["role"] == "client":
            if not user.get("client_id"):
                return {"clients": [], "total": 0}
            stmt = stmt.where(Client.id == user["client_id"])
        if user["role"] == "trainer":
            if not user.get("trainer_id"):
                return {"clients": [], "total": 0}
            stmt = stmt.where(Client.trainer_id == user["trainer_id"])
        if is_active is not None:
            stmt = stmt.where(Client.is_active.is_(is_active))
        if subscription_type:
            stmt = stmt.where(Client.subscription_type == subscription_type)
        if fitness_goal:
            stmt = stmt.where(Client.fitness_goal == fitness_goal)
        if search:
            stmt = stmt.where((Client.name.ilike(f"%{search}%")) | (Client.email.ilike(f"%{search}%")))
        stmt = stmt.order_by(Client.id.desc()).limit(limit).offset(skip)
        rows = session.execute(stmt).scalars().all()
        clients = [orm_to_dict(r) for r in rows]
        total = session.execute(select(func.count()).select_from(Client)).scalar()
        return {"clients": clients, "total": total}


@router.get("/api/clients/{client_id}")
async def get_client(client_id: int, user: dict = Depends(get_current_user)):
    if user["role"] == "client" and user.get("client_id") != client_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_client(session, user.get("trainer_id"), client_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        client = session.execute(select(Client).where(Client.id == client_id)).scalar_one_or_none()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        return orm_to_dict(client)


@router.post("/api/clients", status_code=status.HTTP_201_CREATED)
async def create_client(
    client: ClientCreate,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        try:
            db_client = Client(
                name=client.name,
                email=client.email,
                phone=client.phone,
                birth_date=client.birth_date,
                gender=client.gender,
                subscription_type=client.subscription_type,
                subscription_start_date=client.subscription_start_date,
                fitness_goal=client.fitness_goal,
                fitness_level=client.fitness_level,
                health_notes=client.health_notes,
                contraindications=client.contraindications,
                height=client.height,
                trainer_id=client.trainer_id,
            )
            session.add(db_client)
            session.commit()
            session.refresh(db_client)

            # Сохраняем первичные антропометрические замеры, если переданы
            metric_fields = {
                "weight": client.weight,
                "body_fat_percentage": client.body_fat_percentage,
                "muscle_mass": client.muscle_mass,
                "chest_cm": client.chest_cm,
                "waist_cm": client.waist_cm,
                "hips_cm": client.hips_cm,
                "biceps_cm": client.biceps_cm,
                "thighs_cm": client.thighs_cm,
                "resting_heart_rate": client.resting_heart_rate,
                "max_pushups": client.max_pushups,
                "max_pullups": client.max_pullups,
                "plank_seconds": client.plank_seconds,
                "run_5km_minutes": client.run_5km_minutes,
            }
            if any(v is not None for v in metric_fields.values()):
                from models import ClientMetric
                session.add(ClientMetric(
                    client_id=db_client.id,
                    measurement_date=datetime.now().date(),
                    **{k: v for k, v in metric_fields.items() if v is not None},
                ))
                session.commit()
        except Exception:
            session.rollback()
            raise HTTPException(status_code=400, detail="Email already exists")
    return orm_to_dict(db_client)



@router.put("/api/clients/{client_id}")
async def update_client(
    client_id: int,
    client: ClientUpdate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    fields = client.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    metric_names = {
        "weight", "body_fat_percentage", "muscle_mass", "chest_cm",
        "waist_cm", "hips_cm", "biceps_cm", "thighs_cm",
        "resting_heart_rate", "max_pushups", "max_pullups",
        "plank_seconds", "run_5km_minutes",
    }
    metric_fields = {k: v for k, v in fields.items() if k in metric_names}
    client_fields = {k: v for k, v in fields.items() if k not in metric_names}

    with get_db() as session:
        if user["role"] == "trainer":
            if not _check_trainer_owns_client(session, user.get("trainer_id"), client_id):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
            if "trainer_id" in client_fields:
                raise HTTPException(status_code=403, detail="Недостаточно прав для изменения тренера")
        if client_fields:
            session.execute(update(Client).where(Client.id == client_id).values(**client_fields))
        if metric_fields:
            from models import ClientMetric
            session.add(ClientMetric(
                client_id=client_id,
                measurement_date=datetime.now().date(),
                **metric_fields,
            ))
        session.commit()
    return {"message": "Client updated"}


@router.post("/api/clients/{client_id}/assign-trainer")
async def assign_trainer_to_client(
    client_id: int,
    body: AssignTrainerRequest,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        trainer = session.execute(select(Trainer).where(Trainer.id == body.trainer_id, Trainer.is_active == 1)).scalar_one_or_none()
        if not trainer:
            raise HTTPException(status_code=404, detail="Trainer not found")
        session.execute(update(Client).where(Client.id == client_id).values(trainer_id=body.trainer_id))
        session.commit()
    return {"message": "Trainer assigned"}


@router.delete("/api/clients/{client_id}")
async def delete_client(
    client_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db() as session:
        session.execute(
            update(Client).where(Client.id == client_id).values(
                is_active=False,
                churn_date=datetime.now().date(),
            )
        )
        session.commit()
    return {"message": "Client deactivated"}


