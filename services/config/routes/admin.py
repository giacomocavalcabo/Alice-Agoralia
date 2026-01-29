"""Admin authentication utilities"""

from fastapi import HTTPException, Header, Depends
from config import settings


def verify_admin_auth(
    authorization: str = Header(None),
    x_admin_api_key: str = Header(None, alias="X-Admin-API-Key"),
):
    """Verify admin authentication"""
    
    # Check API key header
    if x_admin_api_key and x_admin_api_key == settings.admin_api_key:
        return None
    
    # Check Authorization header (Bearer token)
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
        # TODO: Verify JWT token
        # For now, just check if it matches admin API key
        if token == settings.admin_api_key:
            return None
    
    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Admin access required",
    )
