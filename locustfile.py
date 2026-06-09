"""
Нагрузочное тестирование Fitness Analytics API.
Инструмент: Locust (https://locust.io).
Профиль нагрузки: смешанный (чтение 80 %, запись 20 %).
Длительность: 5 минут стабилизации + 10 минут измерения.
"""

import random
from locust import HttpUser, task, between


class FitnessUser(HttpUser):
    wait_time = between(1, 3)
    token: str = ""
    client_ids: list = []

    def on_start(self):
        """Авторизация перед сессией и загрузка валидных client_id."""
        resp = self.client.post("/api/auth/login", json={
            "login": "admin",
            "password": "admin123"
        })
        if resp.status_code == 200:
            self.token = resp.json().get("token", "")
            clients_resp = self.client.get(
                "/api/clients",
                headers={"Authorization": f"Bearer {self.token}"}
            )
            if clients_resp.status_code == 200:
                self.client_ids = [c["id"] for c in clients_resp.json().get("clients", [])]
            else:
                self.client_ids = [1]

    @task(5)
    def get_dashboard(self):
        """Загрузка Панели управления (типовая операция чтения)."""
        self.client.get(
            "/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(4)
    def get_clients(self):
        """Получение списка клиентов."""
        self.client.get(
            "/api/clients",
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(3)
    def get_client_profile(self):
        """Просмотр профиля клиента."""
        if not self.client_ids:
            return
        client_id = random.choice(self.client_ids)
        self.client.get(
            f"/api/clients/{client_id}",
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(2)
    def create_session(self):
        """Создание тренировочной сессии (операция записи)."""
        if not self.client_ids:
            return
        client_id = random.choice(self.client_ids)
        self.client.post(
            "/api/sessions",
            json={
                "client_id": client_id,
                "session_date": "2026-04-20",
                "start_time": "10:00",
                "duration_minutes": 60,
                "satisfaction_rating": random.randint(1, 5),
            },
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(1)
    def get_analytics_programs(self):
        """Сложный аналитический запрос: сравнение программ."""
        self.client.get(
            "/api/analytics/programs?metric=weight_change",
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(1)
    def get_analytics_segments(self):
        """Сложный аналитический запрос: кластеризация."""
        self.client.get(
            "/api/analytics/segments?k=4",
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(1)
    def get_analytics_churn(self):
        """Сложный аналитический запрос: анализ выживаемости + Кокс."""
        self.client.get(
            "/api/analytics/churn",
            headers={"Authorization": f"Bearer {self.token}"}
        )
