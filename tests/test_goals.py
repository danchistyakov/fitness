def test_update_goal(client, admin_token):
    r = client.post(
        "/api/clients",
        json={"name": "Цели", "email": "goals@test.fitness"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    cid = r.json()["id"]

    r2 = client.post(
        "/api/goals",
        json={"client_id": cid, "metric": "weight", "target_value": 70, "target_date": "2024-12-31"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    gid = r2.json()["id"]

    r3 = client.put(
        f"/api/goals/{gid}",
        json={"target_value": 68},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r3.status_code == 200
