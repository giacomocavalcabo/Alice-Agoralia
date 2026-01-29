"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-01-29 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Pricing configs
    op.create_table(
        'pricing_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_pricing_version', 'pricing_configs', ['version'], unique=False)
    
    # Translation bundles
    op.create_table(
        'translation_bundles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('language', sa.String(length=10), nullable=False),
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('hash', sa.String(length=64), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_translation_lang_key', 'translation_bundles', ['language', 'key'], unique=False)
    op.create_index('idx_translation_hash', 'translation_bundles', ['hash'], unique=False)
    
    # Financial transactions
    op.create_table(
        'financial_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('workspace_id', sa.String(), nullable=True),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('transaction_type', sa.String(length=50), nullable=False),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_financial_date_status', 'financial_transactions', ['created_at', 'status'], unique=False)
    op.create_index('idx_financial_user_date', 'financial_transactions', ['user_id', 'created_at'], unique=False)
    
    # Expenses
    op.create_table(
        'expenses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('provider', sa.String(length=100), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_expense_date_category', 'expenses', ['date', 'category'], unique=False)
    
    # Active calls
    op.create_table(
        'active_calls',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=True),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('estimated_cost_per_min_cents', sa.Integer(), nullable=True),
        sa.Column('country_code', sa.String(length=2), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_active_calls_status_time', 'active_calls', ['status', 'start_time'], unique=False)
    op.create_index('idx_active_calls_user_status', 'active_calls', ['user_id', 'status'], unique=False)
    
    # Config versions
    op.create_table(
        'config_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('config_type', sa.String(length=50), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('config_type')
    )


def downgrade() -> None:
    op.drop_table('config_versions')
    op.drop_table('active_calls')
    op.drop_table('expenses')
    op.drop_table('financial_transactions')
    op.drop_table('translation_bundles')
    op.drop_table('pricing_configs')
