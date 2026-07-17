"""add wandering_events table (Tier-C mind-wandering tag persistence)

Revision ID: 0003_wandering_events
Revises: 0002_session_goals
Create Date: 2026-07-17

Adds ``wandering_events`` so the Practice-page WanderingLog can persist each
tagged mind-wandering episode in real time (planning / memory / body / emotion /
drowsy) and the Journal SessionDetailView can render a wandering timeline. FK ->
the existing ``sessions.id`` (nullable = an event not tied to a recorded
session).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_wandering_events"
down_revision: Union[str, None] = "0002_session_goals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "wandering_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id", sa.Integer(), sa.ForeignKey("sessions.id"), nullable=True, index=True
        ),
        sa.Column("ts", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tag", sa.String(length=32), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("intensity", sa.Float(), nullable=True),
        sa.Column("created_at", sa.String(length=64), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_table("wandering_events")
