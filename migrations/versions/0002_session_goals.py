"""add session_goals + journal_notes tables (Tier-B meditation)

Revision ID: 0002_session_goals
Revises: 0001_meditation_tables
Create Date: 2026-07-17

Adds two Tier-B tables to v2's existing session database (following the PR #3 /
0001 pattern): ``session_goals`` (user intentions for a practice session) and
``journal_notes`` (free-text reflections captured mid-session, tagged with the
alchemical stage / s-space region at the moment of writing). Both FK -> the
existing ``sessions.id`` (nullable = a standing goal / note not tied to a
recorded session).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_session_goals"
down_revision: Union[str, None] = "0001_meditation_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_goals",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id", sa.Integer(), sa.ForeignKey("sessions.id"), nullable=True, index=True
        ),
        sa.Column("text", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("metric", sa.String(length=64), nullable=True),
        sa.Column("target", sa.Float(), nullable=True),
        sa.Column("progress", sa.Float(), nullable=False, server_default="0"),
        sa.Column("achieved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.String(length=64), nullable=False, server_default=""),
    )
    op.create_table(
        "journal_notes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id", sa.Integer(), sa.ForeignKey("sessions.id"), nullable=True, index=True
        ),
        sa.Column("text", sa.String(length=2000), nullable=False, server_default=""),
        sa.Column("stage", sa.String(length=32), nullable=True),
        sa.Column("region", sa.String(length=4), nullable=True),
        sa.Column("created_at", sa.String(length=64), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_table("journal_notes")
    op.drop_table("session_goals")
