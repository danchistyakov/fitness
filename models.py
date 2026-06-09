"""
ORM-модели SQLAlchemy для информационной системы фитнес-центра.
Включают все сущности предметной области, описанные в ВКР.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Date, Time, DateTime, ForeignKey, Boolean, CheckConstraint,
    func,
)
from sqlalchemy.orm import relationship

from db import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String)
    birth_date = Column(Date)
    gender = Column(String)
    registration_date = Column(Date, default=func.current_date())
    subscription_type = Column(String, default="basic")
    subscription_start_date = Column(Date)
    fitness_goal = Column(String)
    fitness_level = Column(String, default="beginner")
    health_notes = Column(Text)
    contraindications = Column(Text)
    is_active = Column(Boolean, default=True)
    churn_date = Column(Date)                    # дата оттока (мягкое удаление)

    # Дополнительные поля, требуемые ВКР
    height = Column(Float)                       # рост (см)
    trainer_id = Column(Integer, ForeignKey("trainers.id"), nullable=True)

    trainer = relationship("Trainer", back_populates="clients")
    metrics = relationship("ClientMetric", back_populates="client", cascade="all, delete-orphan")
    goals = relationship("ClientGoal", back_populates="client", cascade="all, delete-orphan")
    programs = relationship("TrainingProgram", back_populates="client", cascade="all, delete-orphan")
    sessions = relationship("TrainingSession", back_populates="client", cascade="all, delete-orphan")
    users = relationship("User", back_populates="client")


class Trainer(Base):
    __tablename__ = "trainers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    specialization = Column(String)
    experience_years = Column(Integer)
    rating = Column(Float, default=4.5)
    is_active = Column(Boolean, default=True)

    clients = relationship("Client", back_populates="trainer")
    programs = relationship("TrainingProgram", back_populates="trainer")
    sessions = relationship("TrainingSession", back_populates="trainer")
    recommendations = relationship("Recommendation", back_populates="trainer")
    users = relationship("User", back_populates="trainer")


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    muscle_group = Column(String)
    secondary_muscle_groups = Column(String)     # вспомогательные мышечные группы
    equipment = Column(String)
    difficulty = Column(String)
    load_type = Column(String)                   # тип нагрузки: силовая, кардио, растяжка, функциональная
    calories_per_minute = Column(Float)
    description = Column(Text)

    program_exercises = relationship("ProgramExercise", back_populates="exercise")
    session_exercises = relationship("SessionExercise", back_populates="exercise")


class TrainingProgram(Base):
    __tablename__ = "training_programs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    trainer_id = Column(Integer, ForeignKey("trainers.id"))
    name = Column(String, nullable=False)
    description = Column(Text)
    goal = Column(String)
    duration_weeks = Column(Integer, default=12)
    sessions_per_week = Column(Integer, default=3)
    difficulty_level = Column(String, default="medium")
    start_date = Column(Date)                    # дата начала программы
    created_at = Column(DateTime, default=func.current_timestamp())
    is_active = Column(Boolean, default=True)

    client = relationship("Client", back_populates="programs")
    trainer = relationship("Trainer", back_populates="programs")
    exercises = relationship("ProgramExercise", back_populates="program", cascade="all, delete-orphan")
    sessions = relationship("TrainingSession", back_populates="program")
    calendar = relationship("TrainingCalendar", back_populates="program", cascade="all, delete-orphan")


class ProgramExercise(Base):
    __tablename__ = "program_exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    program_id = Column(Integer, ForeignKey("training_programs.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    sets = Column(Integer, default=3)
    reps = Column(Integer, default=12)
    weight = Column(Float)
    rest_seconds = Column(Integer, default=60)
    day_of_week = Column(Integer)
    order_number = Column(Integer)
    methodical_note = Column(Text)

    program = relationship("TrainingProgram", back_populates="exercises")
    exercise = relationship("Exercise", back_populates="program_exercises")


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    program_id = Column(Integer, ForeignKey("training_programs.id"))
    trainer_id = Column(Integer, ForeignKey("trainers.id"))
    session_date = Column(Date, nullable=False)
    start_time = Column(Time)
    duration_minutes = Column(Integer)
    calories_burned = Column(Integer)
    fatigue_level = Column(Integer, CheckConstraint("fatigue_level BETWEEN 1 AND 10"))
    satisfaction_rating = Column(Integer, CheckConstraint("satisfaction_rating BETWEEN 1 AND 5"))
    comment = Column(Text)

    client = relationship("Client", back_populates="sessions")
    program = relationship("TrainingProgram", back_populates="sessions")
    trainer = relationship("Trainer", back_populates="sessions")
    exercises = relationship("SessionExercise", back_populates="session", cascade="all, delete-orphan")


class SessionExercise(Base):
    __tablename__ = "session_exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("training_sessions.id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id"), nullable=False)
    program_exercise_id = Column(Integer, ForeignKey("program_exercises.id"))
    actual_sets = Column(Integer)
    actual_reps = Column(Integer)
    actual_weight = Column(Float)
    actual_duration_seconds = Column(Integer)
    rpe = Column(Integer, CheckConstraint("rpe BETWEEN 1 AND 10"))
    calories_burned = Column(Integer)

    session = relationship("TrainingSession", back_populates="exercises")
    exercise = relationship("Exercise", back_populates="session_exercises")


class ClientMetric(Base):
    __tablename__ = "client_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    measurement_date = Column(Date, nullable=False)
    weight = Column(Float)
    body_fat_percentage = Column(Float)
    muscle_mass = Column(Float)
    chest_cm = Column(Float)
    waist_cm = Column(Float)
    hips_cm = Column(Float)
    biceps_cm = Column(Float)
    thighs_cm = Column(Float)
    resting_heart_rate = Column(Integer)
    max_pushups = Column(Integer)
    max_pullups = Column(Integer)
    plank_seconds = Column(Integer)
    run_5km_minutes = Column(Float)

    client = relationship("Client", back_populates="metrics")


class ClientGoal(Base):
    __tablename__ = "client_goals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    metric = Column(String, nullable=False)
    target_value = Column(Float)
    target_date = Column(Date)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=func.current_timestamp())
    achieved_at = Column(DateTime)

    client = relationship("Client", back_populates="goals")


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trainer_id = Column(Integer, ForeignKey("trainers.id"))
    recommendation_type = Column(String)
    title = Column(String)
    description = Column(Text)
    priority = Column(Integer, default=5)
    created_at = Column(DateTime, default=func.current_timestamp())
    is_applied = Column(Boolean, default=False)

    trainer = relationship("Trainer", back_populates="recommendations")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    login = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="client")
    full_name = Column(String, nullable=False)
    trainer_id = Column(Integer, ForeignKey("trainers.id"))
    client_id = Column(Integer, ForeignKey("clients.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.current_timestamp())

    trainer = relationship("Trainer", back_populates="users")
    client = relationship("Client", back_populates="users")


class TrainingCalendar(Base):
    """Автоматически сгенерированный календарный план тренировок."""
    __tablename__ = "training_calendar"

    id = Column(Integer, primary_key=True, autoincrement=True)
    program_id = Column(Integer, ForeignKey("training_programs.id"), nullable=False)
    planned_date = Column(Date, nullable=False)
    day_of_week = Column(Integer)
    status = Column(String, default="planned")  # planned, completed, skipped

    program = relationship("TrainingProgram", back_populates="calendar")

