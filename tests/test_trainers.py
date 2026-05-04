def test_create_trainer_auto_user(client, admin_token):
    r = client.post(
        "/api/trainers",
        json={"name": "Тест Тренер", "specialization": "Сила", "experience_years": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "login" in data

    # проверим, что учётка создана
    r2 = client.post("/api/auth/login", json={"login": data["login"], "password": data["login"]})
    assert r2.status_code == 200


def test_update_trainer(client, admin_token):
    r = client.post(
        "/api/trainers",
        json={"name": "Тест2", "specialization": "Кардио", "experience_years": 3},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    tid = r.json()["id"]
    r2 = client.put(
        f"/api/trainers/{tid}",
        json={"rating": 4.8},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 200


def test_delete_trainer(client, admin_token):
    r = client.post(
        "/api/trainers",
        json={"name": "На удаление", "specialization": "Йога", "experience_years": 1},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    tid = r.json()["id"]
    r2 = client.delete(f"/api/trainers/{tid}", headers={"Authorization": f"Bearer {admin_token}"})
    assert r2.status_code == 200
