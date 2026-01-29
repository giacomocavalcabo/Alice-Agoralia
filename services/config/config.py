"""Configuration settings"""

import os
from pydantic import field_validator
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
    railway_environment: bool = False
    
    @field_validator('railway_environment', mode='before')
    @classmethod
    def parse_railway_environment(cls, v):
        """Parse railway_environment from env var"""
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower() in ('true', '1', 'yes')
        return bool(v)
    
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
