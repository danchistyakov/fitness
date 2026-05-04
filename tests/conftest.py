import os
import tempfile
import pytest
from fastapi.testclient import TestClient

# Use an on-disk temp DB so the same SQLite file is shared across connections
os.environ["DATABASE"] = tempfile.mktemp(suffix=".db")

from main import app
from dependencies import init_db, seed_demo_users, seed_demo_trainers


@pytest.fixture(scope="session")
def client():
    init_db()
    seed_demo_users()
    seed_demo_trainers()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def admin_token(client):
    r = client.post("/api/auth/login", json={"login": "admin", "password": "admin123"})
    return r.json()["token"]


@pytest.fixture
def client_token(client):
    r = client.post("/api/auth/login", json={"login": "client1", "password": "client123"})
    return r.json()["token"]
