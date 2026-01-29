"""Pydantic schemas for API requests/responses"""

from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


# Pricing schemas
class PricingResponse(BaseModel):
    """Pricing response with dynamic pricing"""
    plans: list[Dict[str, Any]]
    currency: str
    currency_symbol: str
    country_code: Optional[str] = None
    version: int


class PricingUpdateRequest(BaseModel):
    """Request to update pricing config"""
    data: Dict[str, Any]
    version: Optional[int] = None  # Se None, incrementa automaticamente


# Translation schemas
class TranslationResponse(BaseModel):
    """Translation bundle response"""
    language: str
    translations: Dict[str, str]
    version: int
    hash: Optional[str] = None


class TranslationUpdateRequest(BaseModel):
    """Request to update translations"""
    language: str
    translations: Dict[str, str]


# Finance schemas
class FinancialTransactionCreate(BaseModel):
    """Create financial transaction"""
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    amount_cents: int
    currency: str = "USD"
    provider: str
    status: str
    transaction_type: str
    metadata: Optional[Dict[str, Any]] = None


class ExpenseCreate(BaseModel):
    """Create expense"""
    date: datetime
    category: str
    amount_cents: int
    currency: str = "USD"
    description: Optional[str] = None
    provider: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class RevenueStats(BaseModel):
    """Revenue statistics"""
    period: str  # 'month', 'year', 'all'
    total_revenue_cents: int
    total_transactions: int
    mrr_cents: Optional[int] = None  # Monthly Recurring Revenue
    arpu_cents: Optional[int] = None  # Average Revenue Per User
    breakdown_by_tier: Dict[str, int]
    breakdown_by_country: Dict[str, int]


class ExpenseStats(BaseModel):
    """Expense statistics"""
    period: str
    total_expenses_cents: int
    breakdown_by_category: Dict[str, int]
    breakdown_by_provider: Dict[str, int]


# Active call schemas
class ActiveCallCreate(BaseModel):
    """Create active call"""
    user_id: str
    workspace_id: Optional[str] = None
    model: Optional[str] = None
    estimated_cost_per_min_cents: Optional[int] = None
    country_code: Optional[str] = None


class ActiveCallResponse(BaseModel):
    """Active call response"""
    id: int
    user_id: str
    workspace_id: Optional[str]
    start_time: datetime
    model: Optional[str]
    estimated_cost_per_min_cents: Optional[int]
    country_code: Optional[str]
    status: str
    duration_seconds: Optional[int] = None


# Config version schema
class ConfigVersionResponse(BaseModel):
    """Config version response"""
    config_type: str
    version: int
    updated_at: datetime
