"""add product image fields

Revision ID: 20260527_0001
Revises:
Create Date: 2026-05-27
"""

from alembic import op
import sqlalchemy as sa


revision = "20260527_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("thumbnail_url", sa.String(length=255), nullable=True))
    op.add_column("products", sa.Column("image_urls", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "image_urls")
    op.drop_column("products", "thumbnail_url")
