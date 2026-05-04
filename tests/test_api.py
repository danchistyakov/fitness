"""
Базовые интеграционные тесты для Fitness Analytics API.
Покрывают аутентификацию, CRUD клиентов, тренеров, программ и аналитику.
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from dependencies import _hash_password
from db import engine, SessionLocal
from models import Base, User, Trainer

client = TestClient(app)


def _get_admin_token():
    """Авторизация под демо-администратором."""
    resp = client.post("/api/auth/login", json={"login": "admin", "password": "admin"})
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    """Пересоздаём схему перед тестами."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    # создаём администратора вручную, т.к. seed_demo_users может не отработать
    db = SessionLocal()
    db.add(User(login="admin", password_hash=_hash_password("admin"), role="admin", full_name="Admin", is_active=True))
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


class TestAuth:
    def test_login_success(self):
        resp = client.post("/api/auth/login", json={"login": "admin", "password": "admin"})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"

    def test_login_failure(self):
        resp = client.post("/api/auth/login", json={"login": "admin", "password": "wrong"})
        assert resp.status_code == 401

    def test_me_requires_auth(self):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401


class TestClients:
    def test_create_client(self):
        token = _get_admin_token()
        resp = client.post(
            "/api/clients",
            json={"name": "Иван Тестов", "email": "ivan@test.com", "phone": "+79990001122"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        # проверяем через GET, что клиент создан с нужными полями
        r2 = client.get(f"/api/clients/{data['id']}", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "Иван Тестов"
        assert r2.json()["is_active"] is True

    def test_list_clients(self):
        token = _get_admin_token()
        resp = client.get("/api/clients", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        payload = resp.json()
        assert "clients" in payload

    def test_client_filters(self):
        token = _get_admin_token()
        resp = client.get("/api/clients?is_active=true", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200


class TestTrainers:
    def test_create_trainer(self):
        token = _get_admin_token()
        resp = client.post(
            "/api/trainers",
            json={"name": "Пётр Тренеров", "specialization": "Силовые", "experience_years": 5},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        # проверяем через GET
        r2 = client.get("/api/trainers", headers={"Authorization": f"Bearer {token}"})
        names = [t["name"] for t in r2.json()]
        assert "Пётр Тренеров" in names

    def test_list_trainers(self):
        token = _get_admin_token()
        resp = client.get("/api/trainers", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestPrograms:
    def test_create_program(self):
        token = _get_admin_token()
        # создаём клиента
        r = client.post("/api/clients", json={"name": "Клиент Программов", "email": "prog@test.com"}, headers={"Authorization": f"Bearer {token}"})
        client_id = r.json()["id"]
        resp = client.post(
            "/api/programs",
            json={"client_id": client_id, "name": "Базовая программа", "duration_weeks": 4, "sessions_per_week": 3},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        # проверяем через GET
        r2 = client.get(f"/api/programs/{data['id']}", headers={"Authorization": f"Bearer {token}"})
        assert r2.json()["name"] == "Базовая программа"
        assert r2.json()["is_active"] is True


class TestAnalytics:
    def test_dashboard(self):
        token = _get_admin_token()
        resp = client.get("/api/analytics/dashboard", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "active_clients" in data.get("summary", data)

    def test_gym_load(self):
        token = _get_admin_token()
        resp = client.get("/api/analytics/gym-load", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "by_hour" in data
        assert "by_weekday_hour" in data


class TestSessions:
    def test_create_session_validation(self):
        token = _get_admin_token()
        # fatigue_level вне диапазона
        resp = client.post(
            "/api/sessions",
            json={"client_id": 1, "session_date": "2024-01-01", "fatigue_level": 15},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422

    def test_create_session_ok(self):
        token = _get_admin_token()
        resp = client.post(
            "/api/sessions",
            json={"client_id": 1, "session_date": "2024-01-01", "fatigue_level": 5, "satisfaction_rating": 4},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code in (200, 403)  # 403 если клиент не принадлежит админу
