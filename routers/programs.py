from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, delete, text

from dependencies import (
    get_db, get_db_raw, orm_to_dict,
    get_current_user, require_roles,
    _check_trainer_owns_client, _check_trainer_owns_program,
)
from schemas import TrainingProgramCreate, TrainingProgramUpdate, ProgramExerciseCreate
from models import Client, Trainer, Exercise, TrainingProgram, ProgramExercise, TrainingCalendar

router = APIRouter()

# ==================== Programs ====================

@router.get("/api/programs")
async def get_programs(
    client_id: Optional[int] = None,
    is_active: Optional[bool] = True,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    if user["role"] == "client":
        client_id = user.get("client_id")
        if not client_id:
            return []
    with get_db() as session:
        trainer_filter = None
        if user["role"] == "trainer":
            trainer_filter = user.get("trainer_id")
            if client_id and trainer_filter:
                if not _check_trainer_owns_client(session, trainer_filter, client_id):
                    raise HTTPException(status_code=403, detail="Недостаточно прав")
        stmt = (
            select(TrainingProgram, Client.name.label("client_name"), Trainer.name.label("trainer_name"))
            .join(Client, TrainingProgram.client_id == Client.id, isouter=True)
            .join(Trainer, TrainingProgram.trainer_id == Trainer.id, isouter=True)
        )
        if client_id:
            stmt = stmt.where(TrainingProgram.client_id == client_id)
        if trainer_filter is not None:
            stmt = stmt.where(TrainingProgram.client_id.in_(select(Client.id).where(Client.trainer_id == trainer_filter)))
        if is_active is not None:
            stmt = stmt.where(TrainingProgram.is_active.is_(is_active))
        if search:
            stmt = stmt.where(
                (TrainingProgram.name.ilike(f"%{search}%")) |
                (Client.name.ilike(f"%{search}%")) |
                (Trainer.name.ilike(f"%{search}%"))
            )
        stmt = stmt.order_by(TrainingProgram.created_at.desc())
        rows = session.execute(stmt).all()
        return [{**orm_to_dict(r.TrainingProgram), "client_name": r.client_name, "trainer_name": r.trainer_name} for r in rows]


@router.post("/api/programs")
async def create_program(
    program: TrainingProgramCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as session:
        db_program = TrainingProgram(
            client_id=program.client_id,
            trainer_id=program.trainer_id,
            name=program.name,
            description=program.description,
            goal=program.goal,
            duration_weeks=program.duration_weeks,
            sessions_per_week=program.sessions_per_week,
            difficulty_level=program.difficulty_level,
            start_date=program.start_date,
        )
        session.add(db_program)
        session.commit()
        session.refresh(db_program)
        if program.start_date and program.duration_weeks and program.sessions_per_week:
            _generate_calendar(session, db_program.id, program.start_date, program.duration_weeks, program.sessions_per_week)
            session.commit()
    return {"id": db_program.id, "message": "Program created"}


def _generate_calendar(session, program_id: int, start_date, duration_weeks: int, sessions_per_week: int):
    try:
        start = datetime.strptime(str(start_date), "%Y-%m-%d")
    except (TypeError, ValueError):
        return
    base_days = [0, 2, 4, 1, 3, 5, 6]
    chosen_days = base_days[:sessions_per_week]
    for week in range(duration_weeks):
        for dow in chosen_days:
            planned = start + timedelta(weeks=week, days=(dow - start.weekday()) % 7)
            session.add(TrainingCalendar(
                program_id=program_id,
                planned_date=planned.strftime("%Y-%m-%d"),
                day_of_week=dow,
                status="planned",
            ))


@router.put("/api/programs/{program_id}")
async def update_program(
    program_id: int,
    program: TrainingProgramUpdate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    fields = program.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db() as session:
        if user["role"] == "trainer":
            if not _check_trainer_owns_program(session, user.get("trainer_id"), program_id):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
            if "client_id" in fields or "trainer_id" in fields:
                raise HTTPException(status_code=403, detail="Недостаточно прав для изменения владельца программы")
        session.execute(update(TrainingProgram).where(TrainingProgram.id == program_id).values(**fields))
        session.commit()
    return {"message": "Program updated"}


@router.post("/api/programs/{program_id}/copy")
async def copy_program(
    program_id: int,
    target_client_id: int,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as session:
        src = session.execute(select(TrainingProgram).where(TrainingProgram.id == program_id)).scalar_one_or_none()
        if not src:
            raise HTTPException(status_code=404, detail="Program not found")
        if user["role"] == "trainer":
            if not _check_trainer_owns_program(session, user.get("trainer_id"), program_id):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
            if not _check_trainer_owns_client(session, user.get("trainer_id"), target_client_id):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
        # Архивируем исходную программу только при смене цикла для того же клиента (согласно ВКР)
        if target_client_id == src.client_id:
            session.execute(
                update(TrainingProgram)
                .where(TrainingProgram.id == program_id)
                .values(is_active=False)
            )
        new_trainer_id = src.trainer_id
        if user["role"] == "trainer":
            new_trainer_id = user.get("trainer_id")
        new_program = TrainingProgram(
            client_id=target_client_id,
            trainer_id=new_trainer_id,
            name=src.name,
            description=src.description,
            goal=src.goal,
            duration_weeks=src.duration_weeks,
            sessions_per_week=src.sessions_per_week,
            difficulty_level=src.difficulty_level,
            start_date=src.start_date,
        )
        session.add(new_program)
        session.commit()
        session.refresh(new_program)
        for pe in session.execute(select(ProgramExercise).where(ProgramExercise.program_id == program_id)).scalars().all():
            session.add(ProgramExercise(
                program_id=new_program.id,
                exercise_id=pe.exercise_id,
                sets=pe.sets,
                reps=pe.reps,
                weight=pe.weight,
                rest_seconds=pe.rest_seconds,
                day_of_week=pe.day_of_week,
                order_number=pe.order_number,
                methodical_note=pe.methodical_note,
            ))
        if src.start_date and src.duration_weeks and src.sessions_per_week:
            _generate_calendar(session, new_program.id, src.start_date, src.duration_weeks, src.sessions_per_week)
        session.commit()
    return {"id": new_program.id, "source_id": program_id}


@router.get("/api/programs/{program_id}")
async def get_program(
    program_id: int,
    user: dict = Depends(get_current_user),
):
    with get_db() as session:
        if user["role"] == "client":
            client_id = user.get("client_id")
            prog = session.execute(
                select(TrainingProgram).where(TrainingProgram.id == program_id, TrainingProgram.client_id == client_id)
            ).scalar_one_or_none()
            if not prog:
                raise HTTPException(status_code=403, detail="Недостаточно прав")
        stmt = (
            select(TrainingProgram, Client.name.label("client_name"), Trainer.name.label("trainer_name"))
            .join(Client, TrainingProgram.client_id == Client.id, isouter=True)
            .join(Trainer, TrainingProgram.trainer_id == Trainer.id, isouter=True)
            .where(TrainingProgram.id == program_id)
        )
        if user["role"] == "trainer":
            stmt = stmt.where(TrainingProgram.client_id.in_(
                select(Client.id).where(Client.trainer_id == user.get("trainer_id"))
            ))
        row = session.execute(stmt).one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Program not found")
        return {**orm_to_dict(row.TrainingProgram), "client_name": row.client_name, "trainer_name": row.trainer_name}


@router.get("/api/programs/{program_id}/exercises")
async def get_program_exercises(
    program_id: int,
    user: dict = Depends(get_current_user),
):
    with get_db() as session:
        if user["role"] == "client":
            prog = session.execute(select(TrainingProgram).where(TrainingProgram.id == program_id)).scalar_one_or_none()
            if not prog or prog.client_id != user.get("client_id"):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
        elif user["role"] == "trainer":
            if not _check_trainer_owns_program(session, user.get("trainer_id"), program_id):
                raise HTTPException(status_code=403, detail="Недостаточно прав")
        rows = session.execute(
            select(ProgramExercise, Exercise.name.label("exercise_name"), Exercise.muscle_group)
            .join(Exercise, ProgramExercise.exercise_id == Exercise.id)
            .where(ProgramExercise.program_id == program_id)
            .order_by(ProgramExercise.day_of_week, ProgramExercise.order_number)
        ).all()
        return [{**orm_to_dict(r.ProgramExercise), "exercise_name": r.exercise_name, "muscle_group": r.muscle_group} for r in rows]


@router.post("/api/programs/{program_id}/exercises")
async def add_program_exercise(
    program_id: int,
    pe: ProgramExerciseCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    if pe.program_id != program_id:
        raise HTTPException(status_code=400, detail="program_id mismatch")
    with get_db() as session:
        exercise = ProgramExercise(
            program_id=program_id,
            exercise_id=pe.exercise_id,
            sets=pe.sets,
            reps=pe.reps,
            weight=pe.weight,
            rest_seconds=pe.rest_seconds,
            day_of_week=pe.day_of_week,
            order_number=pe.order_number,
            methodical_note=pe.methodical_note,
        )
        session.add(exercise)
        session.commit()
        session.refresh(exercise)
    return {"id": exercise.id}


@router.put("/api/programs/{program_id}/exercises/{pe_id}")
async def update_program_exercise(
    program_id: int,
    pe_id: int,
    pe: ProgramExerciseCreate,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    fields = pe.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    fields.pop("program_id", None)
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_program(session, user.get("trainer_id"), program_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        existing = session.execute(
            select(ProgramExercise).where(ProgramExercise.id == pe_id, ProgramExercise.program_id == program_id)
        ).scalar_one_or_none()
        if not existing:
            raise HTTPException(status_code=404, detail="Exercise not found in program")
        session.execute(update(ProgramExercise).where(ProgramExercise.id == pe_id).values(**fields))
        session.commit()
    return {"message": "Program exercise updated"}


@router.delete("/api/programs/{program_id}/exercises/{pe_id}")
async def delete_program_exercise(
    program_id: int,
    pe_id: int,
    user: dict = Depends(require_roles("admin", "trainer")),
):
    with get_db() as session:
        if user["role"] == "trainer" and not _check_trainer_owns_program(session, user.get("trainer_id"), program_id):
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        existing = session.execute(
            select(ProgramExercise).where(ProgramExercise.id == pe_id, ProgramExercise.program_id == program_id)
        ).scalar_one_or_none()
        if not existing:
            raise HTTPException(status_code=404, detail="Exercise not found in program")
        session.execute(delete(ProgramExercise).where(ProgramExercise.id == pe_id))
        session.commit()
    return {"message": "Program exercise deleted"}


@router.get("/api/programs/{program_id}/calendar")
async def get_program_calendar(
    program_id: int,
    user: dict = Depends(get_current_user),
):
    with get_db_raw() as conn:
        result = conn.execute(
            text("SELECT * FROM training_programs WHERE id = :program_id"),
            {"program_id": program_id},
        )
        program = result.fetchone()
        if not program:
            raise HTTPException(status_code=404, detail="Program not found")
        if user["role"] == "client" and user.get("client_id") != program._mapping["client_id"]:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        result = conn.execute(
            text("""
            SELECT * FROM training_calendar
             WHERE program_id = :program_id
             ORDER BY planned_date
            """),
            {"program_id": program_id},
        )
        rows = result.fetchall()
        return [dict(r._mapping) for r in rows]
