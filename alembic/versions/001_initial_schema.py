"""initial schema with VKR requirements

Revision ID: 001
Revises:
Create Date: 2026-04-29 17:35:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Новые колонки для существующих таблиц
    op.add_column("clients", sa.Column("height", sa.Float(), nullable=True))
    op.add_column("clients", sa.Column("churn_date", sa.Date(), nullable=True))
    op.add_column("clients", sa.Column("trainer_id", sa.Integer(), nullable=True))

    op.add_column("exercises", sa.Column("secondary_muscle_groups", sa.String(), nullable=True))
    op.add_column("exercises", sa.Column("load_type", sa.String(), nullable=True))

    op.add_column("training_programs", sa.Column("start_date", sa.Date(), nullable=True))

    # Новая таблица календаря
    op.create_table(
        "training_calendar",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("program_id", sa.Integer(), sa.ForeignKey("training_programs.id"), nullable=False),
        sa.Column("planned_date", sa.Date(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(), nullable=True, server_default="planned"),
    )


def downgrade() -> None:
    op.drop_table("training_calendar")
    op.drop_column("training_programs", "start_date")
    op.drop_column("exercises", "load_type")
    op.drop_column("exercises", "secondary_muscle_groups")
    op.drop_column("clients", "trainer_id")
    op.drop_column("clients", "height")
