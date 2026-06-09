def test_create_trainer_and_user(client, admin_token):
    # 1. Создаём тренера — учётная запись генерируется автоматически
    r = client.post(
        "/api/trainers",
        json={"name": "Тест Тренер", "specialization": "Сила", "experience_years": 5},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    trainer_id = data["id"]
    login = data["login"]
    password = data["password"]
    assert login is not None
    assert password is not None

    # проверим, что можно войти под сгенерированными credentials
    r3 = client.post("/api/auth/login", json={"login": login, "password": password})
    assert r3.status_code == 200
    assert r3.json()["user"]["role"] == "trainer"


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
