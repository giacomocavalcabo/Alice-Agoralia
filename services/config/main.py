"""Main FastAPI application"""

from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional
import json

from config import settings
from database import get_db, wait_for_database, engine
from models import Base
from redis_client import redis_client, publish_event
from routes import pricing, i18n, finance, admin, realtime

# Wait for database on startup
wait_for_database()

# Create tables (in production use Alembic migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Agoralia Config Service",
    description="Centralized configuration service for pricing, translations, and monitoring",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pricing.router, prefix="/pricing", tags=["pricing"])
app.include_router(i18n.router, prefix="/i18n", tags=["i18n"])
app.include_router(finance.router, prefix="/finance", tags=["finance"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(realtime.router, prefix="/realtime", tags=["realtime"])


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "database": "connected" if settings.database_url else "not configured",
        "redis": "connected" if redis_client else "not configured",
    }


@app.get("/configs/version")
async def get_config_version(
    config_type: str = Query(..., description="Config type: pricing, i18n, etc."),
    db: Session = Depends(get_db),
):
    """Get current version of a config type"""
    from models import ConfigVersion
    
    config = db.query(ConfigVersion).filter(
        ConfigVersion.config_type == config_type
    ).first()
    
    if not config:
        return {"config_type": config_type, "version": 1}
    
    return {
        "config_type": config.config_type,
        "version": config.version,
        "updated_at": config.updated_at.isoformat(),
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Agoralia Config Service",
        "version": "1.0.0",
        "docs": "/docs",
    }
