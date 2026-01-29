"""Pricing routes"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
import json

from database import get_db
from models import PricingConfig, ConfigVersion
from schemas import PricingResponse, PricingUpdateRequest
from redis_client import get_cache, set_cache, delete_cache
from routes.admin import verify_admin_auth

router = APIRouter()

# Default pricing data (fallback)
DEFAULT_PRICING = {
    "plans": [
        {
            "id": "free",
            "name": "Free",
            "price": {"monthly": 0, "yearly": 0},
            "features": ["100 minutes/month", "5 languages", "Basic compliance"],
        },
        {
            "id": "core",
            "name": "Core",
            "price": {"monthly": 299, "yearly": 2990},
            "features": ["1,000 minutes/month", "20 languages", "Full compliance"],
        },
        {
            "id": "pro",
            "name": "Pro",
            "price": {"monthly": 799, "yearly": 7990},
            "features": ["Unlimited minutes", "40+ voices", "Full compliance"],
        },
    ],
    "currency": "USD",
    "currency_symbol": "$",
}


def get_country_currency(country_code: Optional[str]) -> tuple[str, str]:
    """Get currency for country code"""
    # Mapping semplificato - puoi espandere
    currency_map = {
        "US": ("USD", "$"),
        "GB": ("GBP", "£"),
        "EU": ("EUR", "€"),
        "IT": ("EUR", "€"),
        "FR": ("EUR", "€"),
        "DE": ("EUR", "€"),
        "ES": ("EUR", "€"),
        "BR": ("BRL", "R$"),
        "IN": ("INR", "₹"),
        "JP": ("JPY", "¥"),
        "CN": ("CNY", "¥"),
    }
    
    if country_code and country_code.upper() in currency_map:
        return currency_map[country_code.upper()]
    
    return ("USD", "$")


@router.get("", response_model=PricingResponse)
async def get_pricing(
    country: Optional[str] = Query(None, description="Country code (e.g., IT, US)"),
    ip: Optional[str] = Query(None, description="Client IP address"),
    db: Session = Depends(get_db),
):
    """Get dynamic pricing based on country/IP"""
    
    # Try cache first
    cache_key = f"pricing:{country or 'default'}"
    cached = get_cache(cache_key)
    if cached:
        return PricingResponse(**cached)
    
    # Get latest pricing config
    latest_config = db.query(PricingConfig).order_by(
        PricingConfig.version.desc()
    ).first()
    
    if not latest_config:
        # Use default pricing
        currency, symbol = get_country_currency(country)
        result = {
            "plans": DEFAULT_PRICING["plans"],
            "currency": currency,
            "currency_symbol": symbol,
            "country_code": country,
            "version": 1,
        }
    else:
        # Use config from DB
        config_data = latest_config.data
        currency, symbol = get_country_currency(country)
        
        # Apply country-specific pricing if available
        if country and "country_overrides" in config_data:
            overrides = config_data.get("country_overrides", {}).get(country.upper(), {})
            if overrides:
                config_data = {**config_data, **overrides}
        
        result = {
            "plans": config_data.get("plans", DEFAULT_PRICING["plans"]),
            "currency": currency,
            "currency_symbol": symbol,
            "country_code": country,
            "version": latest_config.version,
        }
    
    # Cache for 5 minutes
    set_cache(cache_key, result, ttl=300)
    
    return PricingResponse(**result)


@router.post("/update")
async def update_pricing(
    request: PricingUpdateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin_auth),
):
    """Update pricing configuration (admin only)"""
    
    # Get current version
    latest_config = db.query(PricingConfig).order_by(
        PricingConfig.version.desc()
    ).first()
    
    new_version = (latest_config.version + 1) if latest_config else 1
    
    if request.version:
        new_version = request.version
    
    # Create new config
    new_config = PricingConfig(
        version=new_version,
        data=request.data,
    )
    db.add(new_config)
    
    # Update config version
    config_version = db.query(ConfigVersion).filter(
        ConfigVersion.config_type == "pricing"
    ).first()
    
    if not config_version:
        config_version = ConfigVersion(config_type="pricing", version=new_version)
        db.add(config_version)
    else:
        config_version.version = new_version
    
    db.commit()
    
    # Invalidate cache
    delete_cache("pricing:*")
    
    # Publish event
    publish_event("config:pricing:updated", {"version": new_version})
    
    return {
        "success": True,
        "version": new_version,
        "message": "Pricing updated successfully",
    }
