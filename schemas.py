from datetime import date
from typing import Optional
from pydantic import BaseModel, Field



class ClientCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    subscription_type: str = "basic"
    subscription_start_date: Optional[date] = None
    fitness_goal: Optional[str] = None
    fitness_level: str = "beginner"
    health_notes: Optional[str] = None
    contraindications: Optional[str] = None
    height: Optional[float] = None
    trainer_id: Optional[int] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    subscription_type: Optional[str] = None
    fitness_goal: Optional[str] = None
    fitness_level: Optional[str] = None
    health_notes: Optional[str] = None
    contraindications: Optional[str] = None
    is_active: Optional[bool] = None
    height: Optional[float] = None
    trainer_id: Optional[int] = None


class TrainerCreate(BaseModel):
    name: str
    specialization: Optional[str] = None
    experience_years: Optional[int] = None


class TrainingProgramCreate(BaseModel):
    client_id: int
    trainer_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: int = 12
    sessions_per_week: int = 3
    difficulty_level: str = "medium"
    start_date: Optional[date] = None


class TrainingProgramUpdate(BaseModel):
    name: Optional[str] = None
    trainer_id: Optional[int] = None
    description: Optional[str] = None
    goal: Optional[str] = None
    duration_weeks: Optional[int] = None
    sessions_per_week: Optional[int] = None
    difficulty_level: Optional[str] = None
    start_date: Optional[date] = None
    is_active: Optional[bool] = None


class ProgramExerciseCreate(BaseModel):
    program_id: int
    exercise_id: int
    sets: int = 3
    reps: int = 12
    weight: Optional[float] = None
    rest_seconds: int = 60
    day_of_week: Optional[int] = None
    order_number: Optional[int] = None
    methodical_note: Optional[str] = None


class ExerciseCreate(BaseModel):
    name: str
    muscle_group: Optional[str] = None
    secondary_muscle_groups: Optional[str] = None
    equipment: Optional[str] = None
    difficulty: Optional[str] = None
    load_type: Optional[str] = None
    calories_per_minute: Optional[float] = None
    description: Optional[str] = None


class ExerciseUpdate(BaseModel):
    name: Optional[str] = None
    muscle_group: Optional[str] = None
    secondary_muscle_groups: Optional[str] = None
    equipment: Optional[str] = None
    difficulty: Optional[str] = None
    load_type: Optional[str] = None
    calories_per_minute: Optional[float] = None
    description: Optional[str] = None


class TrainingSessionCreate(BaseModel):
    client_id: int
    program_id: Optional[int] = None
    trainer_id: Optional[int] = None
    session_date: date
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    calories_burned: Optional[int] = None
    fatigue_level: Optional[int] = Field(None, ge=1, le=10)
    satisfaction_rating: Optional[int] = Field(None, ge=1, le=5)
    comment: Optional[str] = None


class SessionExerciseCreate(BaseModel):
    session_id: int
    exercise_id: int
    program_exercise_id: Optional[int] = None
    actual_sets: Optional[int] = None
    actual_reps: Optional[int] = None
    actual_weight: Optional[float] = None
    actual_duration_seconds: Optional[int] = None
    rpe: Optional[int] = Field(None, ge=1, le=10)
    calories_burned: Optional[int] = None


class ClientMetricsCreate(BaseModel):
    client_id: int
    measurement_date: date
    weight: Optional[float] = None
    body_fat_percentage: Optional[float] = None
    muscle_mass: Optional[float] = None
    chest_cm: Optional[float] = None
    waist_cm: Optional[float] = None
    hips_cm: Optional[float] = None
    biceps_cm: Optional[float] = None
    thighs_cm: Optional[float] = None
    resting_heart_rate: Optional[int] = None
    max_pushups: Optional[int] = None
    max_pullups: Optional[int] = None
    plank_seconds: Optional[int] = None
    run_5km_minutes: Optional[float] = None


class ClientGoalCreate(BaseModel):
    client_id: int
    metric: str
    target_value: Optional[float] = None
    target_date: Optional[date] = None
    status: str = "pending"


class LoginRequest(BaseModel):
    login: str
    password: str


class UserCreate(BaseModel):
    login: str
    password: str
    role: str = "client"
    full_name: str
    trainer_id: Optional[int] = None
    client_id: Optional[int] = None


class UserUpdate(BaseModel):
    role: Optional[str] = None
    full_name: Optional[str] = None
    trainer_id: Optional[int] = None
    client_id: Optional[int] = None
    is_active: Optional[bool] = None


class AssignTrainerRequest(BaseModel):
    trainer_id: int


class CalendarGenerateRequest(BaseModel):
    program_id: int




class TrainerUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[str] = None
    experience_years: Optional[int] = None
    rating: Optional[float] = Field(None, ge=0, le=5)
    is_active: Optional[bool] = None


class ClientGoalUpdate(BaseModel):
    metric: Optional[str] = None
    target_value: Optional[float] = None
    target_date: Optional[date] = None
