from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from dependencies import (
    get_db_raw,
    get_current_user, require_roles,
    _hash_password,
    sql_bool_true, sql_bool_false,
)
from schemas import UserCreate, UserUpdate

router = APIRouter()

# ==================== Users management ====================

@router.get("/api/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    with get_db_raw() as conn:
        result = conn.execute(
            text("""
            SELECT u.id, u.login, u.role, u.full_name, u.trainer_id, u.client_id,
                   u.is_active, u.created_at, t.name AS trainer_name, c.name AS client_name
              FROM users u
              LEFT JOIN trainers t ON u.trainer_id = t.id
              LEFT JOIN clients c ON u.client_id = c.id
             ORDER BY u.id DESC
            """)
        )
        rows = result.fetchall()
        return [dict(r._mapping) for r in rows]


@router.post("/api/users")
async def create_user(
    body: UserCreate,
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        result = conn.execute(text("SELECT id FROM users WHERE login = :login"), {"login": body.login})
        existing = result.fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Login already exists")
        result = conn.execute(
            text("""
            INSERT INTO users (login, password_hash, role, full_name, trainer_id, client_id, is_active)
            VALUES (:login, :password_hash, :role, :full_name, :trainer_id, :client_id, :is_active)
            RETURNING id
            """),
            {
                "login": body.login,
                "password_hash": _hash_password(body.password),
                "role": body.role,
                "full_name": body.full_name,
                "trainer_id": body.trainer_id,
                "client_id": body.client_id,
                "is_active": True if body.is_active is None else bool(body.is_active),
            },
        )
        user_id = result.scalar()
        conn.commit()
    return {"id": user_id, "message": "User created"}


@router.put("/api/users/{user_id}")
async def update_user(
    user_id: int,
    body: UserUpdate,
    user: dict = Depends(require_roles("admin")),
):
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    with get_db_raw() as conn:
        sets = ", ".join(f"{k} = :{k}" for k in fields)
        params = dict(fields)
        params["user_id"] = user_id
        conn.execute(text(f"UPDATE users SET {sets} WHERE id = :user_id"), params)
        conn.commit()
    return {"message": "User updated"}


@router.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    user: dict = Depends(require_roles("admin")),
):
    with get_db_raw() as conn:
        conn.execute(text(f"UPDATE users SET is_active = {sql_bool_false()} WHERE id = :user_id"), {"user_id": user_id})
        conn.commit()
    return {"message": "User deactivated"}
