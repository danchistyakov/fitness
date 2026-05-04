def test_login_admin(client):
    r = client.post("/api/auth/login", json={"login": "admin", "password": "admin123"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["user"]["role"] == "admin"


def test_login_invalid(client):
    r = client.post("/api/auth/login", json={"login": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_me(client, admin_token):
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
