"""Configuration settings"""

import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "")
    
    # Redis
    redis_url: str = os.getenv("REDIS_URL", "")
    
    # JWT
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production")
    jwt_algorithm: str = "HS256"
    
    # Admin
    admin_api_key: str = os.getenv("ADMIN_API_KEY", "")
    
    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    railway_environment: bool = bool(os.getenv("RAILWAY_ENVIRONMENT"))
    
    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://agoralia.com",
        "https://www.agoralia.com",
        "https://app.agoralia.com",
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
