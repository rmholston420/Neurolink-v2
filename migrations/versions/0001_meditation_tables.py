"""extend sessions store with meditation session_frames + calibrations

Revision ID: 0001_meditation_tables
Revises:
Create Date: 2026-07-17

Adds the two MuseLink-derived tables to v2's existing session database rather
than a parallel DB: ``session_frames`` (per-frame classifier / EA-1 metrics,
FK -> sessions.id) and ``calibrations`` (per-band resting baselines).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_meditation_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "session_frames",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("sessions.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("ts", sa.Float(), nullable=False, index=True),
        sa.Column("alpha", sa.Float(), nullable=False, server_default="0"),
        sa.Column("theta", sa.Float(), nullable=False, server_default="0"),
        sa.Column("beta", sa.Float(), nullable=False, server_default="0"),
        sa.Column("delta", sa.Float(), nullable=False, server_default="0"),
        sa.Column("gamma", sa.Float(), nullable=False, server_default="0"),
        sa.Column("faa", sa.Float(), nullable=True),
        sa.Column("fmt", sa.Float(), nullable=True),
        sa.Column("region", sa.String(length=4), nullable=True),
        sa.Column("stage", sa.String(length=32), nullable=True),
        sa.Column("ea1_score", sa.Float(), nullable=True),
        sa.Column("ea1_eligible", sa.Integer(), nullable=True),
        sa.Column("hrv_rmssd", sa.Float(), nullable=True),
        sa.Column("rr_bpm", sa.Float(), nullable=True),
        sa.Column("motion_rms", sa.Float(), nullable=True),
    )
    op.create_table(
        "calibrations",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.String(length=64), nullable=False, server_default=""),
        sa.Column("label", sa.String(length=255), nullable=False, server_default="Baseline"),
        sa.Column("alpha_base", sa.Float(), nullable=False, server_default="1"),
        sa.Column("theta_base", sa.Float(), nullable=False, server_default="1"),
        sa.Column("beta_base", sa.Float(), nullable=False, server_default="1"),
        sa.Column("delta_base", sa.Float(), nullable=False, server_default="1"),
        sa.Column("gamma_base", sa.Float(), nullable=False, server_default="1"),
        sa.Column("faa_base", sa.Float(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("calibrations")
    op.drop_table("session_frames")
