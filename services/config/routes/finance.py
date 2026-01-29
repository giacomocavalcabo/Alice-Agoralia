"""Finance routes for revenue and expenses"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import Optional

from database import get_db
from models import FinancialTransaction, Expense
from schemas import (
    FinancialTransactionCreate,
    ExpenseCreate,
    RevenueStats,
    ExpenseStats,
)
from routes.admin import verify_admin_auth

router = APIRouter()


@router.post("/transactions")
async def create_transaction(
    transaction: FinancialTransactionCreate,
    db: Session = Depends(get_db),
):
    """Create a financial transaction (called by webhooks)"""
    
    db_transaction = FinancialTransaction(
        user_id=transaction.user_id,
        workspace_id=transaction.workspace_id,
        amount_cents=transaction.amount_cents,
        currency=transaction.currency,
        provider=transaction.provider,
        status=transaction.status,
        transaction_type=transaction.transaction_type,
        metadata=transaction.metadata,
    )
    
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    
    return {
        "success": True,
        "id": db_transaction.id,
        "message": "Transaction recorded",
    }


@router.get("/revenue", response_model=RevenueStats)
async def get_revenue_stats(
    period: str = Query("month", description="Period: month, year, all"),
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin_auth),
):
    """Get revenue statistics (admin only)"""
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "year":
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = datetime(2020, 1, 1)  # All time
    
    # Query completed transactions
    query = db.query(FinancialTransaction).filter(
        and_(
            FinancialTransaction.status == "completed",
            FinancialTransaction.created_at >= start_date,
        )
    )
    
    transactions = query.all()
    
    total_revenue_cents = sum(t.amount_cents for t in transactions)
    total_transactions = len(transactions)
    
    # Breakdown by tier (from metadata)
    breakdown_by_tier = {}
    breakdown_by_country = {}
    
    for t in transactions:
        if t.metadata:
            tier = t.metadata.get("tier", "unknown")
            breakdown_by_tier[tier] = breakdown_by_tier.get(tier, 0) + t.amount_cents
            
            country = t.metadata.get("country_code", "unknown")
            breakdown_by_country[country] = breakdown_by_country.get(country, 0) + t.amount_cents
    
    # Calculate MRR (Monthly Recurring Revenue) for subscriptions
    mrr_query = db.query(func.sum(FinancialTransaction.amount_cents)).filter(
        and_(
            FinancialTransaction.status == "completed",
            FinancialTransaction.transaction_type == "subscription",
            FinancialTransaction.created_at >= now.replace(day=1),
        )
    )
    mrr_cents = mrr_query.scalar() or 0
    
    # Calculate ARPU (Average Revenue Per User)
    unique_users = db.query(func.count(func.distinct(FinancialTransaction.user_id))).filter(
        and_(
            FinancialTransaction.status == "completed",
            FinancialTransaction.created_at >= start_date,
        )
    ).scalar() or 0
    
    arpu_cents = total_revenue_cents // unique_users if unique_users > 0 else 0
    
    return RevenueStats(
        period=period,
        total_revenue_cents=total_revenue_cents,
        total_transactions=total_transactions,
        mrr_cents=mrr_cents,
        arpu_cents=arpu_cents,
        breakdown_by_tier=breakdown_by_tier,
        breakdown_by_country=breakdown_by_country,
    )


@router.post("/expenses")
async def create_expense(
    expense: ExpenseCreate,
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin_auth),
):
    """Create an expense (admin only)"""
    
    db_expense = Expense(
        date=expense.date,
        category=expense.category,
        amount_cents=expense.amount_cents,
        currency=expense.currency,
        description=expense.description,
        provider=expense.provider,
        metadata=expense.metadata,
    )
    
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    return {
        "success": True,
        "id": db_expense.id,
        "message": "Expense recorded",
    }


@router.get("/expenses", response_model=ExpenseStats)
async def get_expense_stats(
    period: str = Query("month", description="Period: month, year, all"),
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin_auth),
):
    """Get expense statistics (admin only)"""
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "month":
        start_date = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "year":
        start_date = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_date = datetime(2020, 1, 1)
    
    expenses = db.query(Expense).filter(
        Expense.date >= start_date
    ).all()
    
    total_expenses_cents = sum(e.amount_cents for e in expenses)
    
    breakdown_by_category = {}
    breakdown_by_provider = {}
    
    for e in expenses:
        breakdown_by_category[e.category] = breakdown_by_category.get(e.category, 0) + e.amount_cents
        if e.provider:
            breakdown_by_provider[e.provider] = breakdown_by_provider.get(e.provider, 0) + e.amount_cents
    
    return ExpenseStats(
        period=period,
        total_expenses_cents=total_expenses_cents,
        breakdown_by_category=breakdown_by_category,
        breakdown_by_provider=breakdown_by_provider,
    )
