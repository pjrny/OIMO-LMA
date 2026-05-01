"""init

Revision ID: 0001
Revises:
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "characters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(64), index=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="processing"),
        sa.Column("embedding_hash", sa.String(128)),
        sa.Column("reference_keys", sa.JSON, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(64), index=True, nullable=False),
        sa.Column("character_id", sa.String(36), sa.ForeignKey("characters.id"), nullable=False),
        sa.Column("scene_id", sa.String(64)),
        sa.Column("prompt", sa.String(4000), nullable=False),
        sa.Column("width", sa.Integer, nullable=False, server_default="1024"),
        sa.Column("height", sa.Integer, nullable=False, server_default="1536"),
        sa.Column("seed", sa.Integer),
        sa.Column("guidance", sa.Float, nullable=False, server_default="6.5"),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("output_key", sa.String(512)),
        sa.Column("provider", sa.String(64)),
        sa.Column("cost_seconds", sa.Float, nullable=False, server_default="0"),
        sa.Column("error", sa.String(2000)),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("jobs")
    op.drop_table("characters")
