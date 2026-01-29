"""Database models"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, JSON, Numeric, Boolean, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from database import Base


class PricingConfig(Base):
    """Pricing configuration with versioning"""
    __tablename__ = "pricing_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(Integer, nullable=False, index=True)
    data = Column(JSONB, nullable=False)  # JSON con tutti i tier, valute, promo
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by = Column(String, nullable=True)  # admin user ID
    
    # Index per query veloci
    __table_args__ = (
        Index('idx_pricing_version', 'version'),
    )


class TranslationBundle(Base):
    """Translation bundles per lingua"""
    __tablename__ = "translation_bundles"
    
    id = Column(Integer, primary_key=True, index=True)
    language = Column(String(10), nullable=False, index=True)  # 'en', 'it', 'fr', etc.
    key = Column(String(255), nullable=False, index=True)  # chiave traduzione
    value = Column(Text, nullable=False)  # valore tradotto
    hash = Column(String(64), nullable=True, index=True)  # hash per cache invalidation
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Index per query veloci
    __table_args__ = (
        Index('idx_translation_lang_key', 'language', 'key'),
        Index('idx_translation_hash', 'hash'),
    )


class FinancialTransaction(Base):
    """Financial transactions (payments, invoices)"""
    __tablename__ = "financial_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=True, index=True)  # ID utente Agoralia
    workspace_id = Column(String, nullable=True, index=True)
    amount_cents = Column(Integer, nullable=False)  # importo in centesimi
    currency = Column(String(3), nullable=False, default='USD')
    provider = Column(String(50), nullable=False)  # 'stripe', 'dlocal', etc.
    status = Column(String(50), nullable=False, index=True)  # 'completed', 'pending', 'failed', 'refunded'
    transaction_type = Column(String(50), nullable=False)  # 'subscription', 'topup', 'one_time'
    metadata_json = Column("metadata", JSONB, nullable=True)  # dati aggiuntivi dal provider
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Index per analytics
    __table_args__ = (
        Index('idx_financial_date_status', 'created_at', 'status'),
        Index('idx_financial_user_date', 'user_id', 'created_at'),
    )


class Expense(Base):
    """Expenses (costi nostri: OpenAI, server, marketing, etc.)"""
    __tablename__ = "expenses"
    
    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, nullable=False, index=True)
    category = Column(String(100), nullable=False, index=True)  # 'openai', 'server', 'marketing', 'infrastructure'
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), nullable=False, default='USD')
    description = Column(Text, nullable=True)
    provider = Column(String(100), nullable=True)  # 'railway', 'openai', 'elevenlabs', etc.
    metadata_json = Column("metadata", JSONB, nullable=True)  # dati aggiuntivi
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Index per analytics
    __table_args__ = (
        Index('idx_expense_date_category', 'date', 'category'),
    )


class ActiveCall(Base):
    """Active calls tracking per realtime dashboard"""
    __tablename__ = "active_calls"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    workspace_id = Column(String, nullable=True, index=True)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    model = Column(String(100), nullable=True)  # modello voce usato
    estimated_cost_per_min_cents = Column(Integer, nullable=True)  # costo stimato per minuto
    country_code = Column(String(2), nullable=True)  # paese chiamata
    status = Column(String(50), default='active', nullable=False, index=True)  # 'active', 'completed', 'failed'
    ended_at = Column(DateTime, nullable=True)
    
    # Index per query realtime
    __table_args__ = (
        Index('idx_active_calls_status_time', 'status', 'start_time'),
        Index('idx_active_calls_user_status', 'user_id', 'status'),
    )


class ConfigVersion(Base):
    """Global config version per cache invalidation"""
    __tablename__ = "config_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    config_type = Column(String(50), nullable=False, unique=True)  # 'pricing', 'i18n', etc.
    version = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
