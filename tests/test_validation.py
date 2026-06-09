def test_session_ratings_validation(client, admin_token):
    # Сначала создадим клиента
    r = client.post(
        "/api/clients",
        json={"name": "Валид", "email": "valid@test.fitness"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 201
    cid = r.json()["id"]

    # fatigue_level > 10 — должно отклониться
    r2 = client.post(
        "/api/sessions",
        json={"client_id": cid, "session_date": "2024-01-01", "fatigue_level": 15},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r2.status_code == 422

    # satisfaction_rating > 5 — должно отклониться
    r3 = client.post(
        "/api/sessions",
        json={"client_id": cid, "session_date": "2024-01-01", "satisfaction_rating": 6},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 422

    # Корректные значения — проходят
    r4 = client.post(
        "/api/sessions",
        json={"client_id": cid, "session_date": "2024-01-01", "fatigue_level": 5, "satisfaction_rating": 4},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r4.status_code == 200
