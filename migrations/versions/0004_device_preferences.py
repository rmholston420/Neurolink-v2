"""add device_preferences table (last-paired device for auto-reconnect)

Revision ID: 0004_device_preferences
Revises: 0003_wandering_events
Create Date: 2026-07-17

Adds ``device_preferences`` so a successful ``POST /api/device/connect`` can
persist the paired headset (BLE address, display name, preset, board id). On the
next backend startup the app reads the single ``last_paired_device`` sentinel row
and attempts one background auto-reconnect, sparing the operator a manual
Scan+Connect after every uvicorn restart.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_device_preferences"
down_revision: Union[str, None] = "0003_wandering_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "device_preferences",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("ble_address", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("display_name", sa.String(length=128), nullable=False, server_default=""),
        sa.Column("preset", sa.String(length=32), nullable=False, server_default=""),
        sa.Column("board_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_device_preferences_key", "device_preferences", ["key"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_device_preferences_key", table_name="device_preferences")
    op.drop_table("device_preferences")
