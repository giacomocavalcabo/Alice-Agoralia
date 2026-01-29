"""Database configuration"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings

# Create engine with connection pooling for Railway
connect_args = {}
if settings.database_url.startswith("postgresql") or settings.database_url.startswith("postgres"):
    connect_args = {
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }

engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=5,
    pool_timeout=30,
    pool_recycle=3600,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass


def get_db():
    """Dependency for FastAPI to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def wait_for_database(max_retries=10, retry_interval=2):
    """Wait for database to be available"""
    import time
    
    if not settings.database_url:
        print("⚠ DATABASE_URL not set")
        return
    
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"✓ Database connected after {attempt} attempt(s)")
            return
        except Exception as e:
            if attempt < max_retries:
                print(f"⚠ Database not ready (attempt {attempt}/{max_retries}), retrying...")
                time.sleep(retry_interval)
            else:
                print(f"✗ Database connection failed: {e}")
                raise
