"""i18n translation routes"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict
import hashlib
import json

from database import get_db
from models import TranslationBundle, ConfigVersion
from schemas import TranslationResponse, TranslationUpdateRequest
from redis_client import get_cache, set_cache, delete_cache
from routes.admin import verify_admin_auth

router = APIRouter()


@router.get("/{locale}.json", response_model=TranslationResponse)
async def get_translations(
    locale: str,
    db: Session = Depends(get_db),
):
    """Get translation bundle for locale"""
    
    # Try cache first
    cache_key = f"i18n:{locale}"
    cached = get_cache(cache_key)
    if cached:
        return TranslationResponse(**cached)
    
    # Get all translations for locale
    translations = db.query(TranslationBundle).filter(
        TranslationBundle.language == locale.lower()
    ).all()
    
    if not translations:
        raise HTTPException(
            status_code=404,
            detail=f"Translations not found for locale: {locale}",
        )
    
    # Build translations dict
    translations_dict = {t.key: t.value for t in translations}
    
    # Calculate hash
    content_str = json.dumps(translations_dict, sort_keys=True)
    content_hash = hashlib.sha256(content_str.encode()).hexdigest()
    
    # Get version
    config_version = db.query(ConfigVersion).filter(
        ConfigVersion.config_type == "i18n"
    ).first()
    version = config_version.version if config_version else 1
    
    result = {
        "language": locale,
        "translations": translations_dict,
        "version": version,
        "hash": content_hash,
    }
    
    # Cache for 24 hours
    set_cache(cache_key, result, ttl=86400)
    
    return TranslationResponse(**result)


@router.post("/update")
async def update_translations(
    request: TranslationUpdateRequest,
    db: Session = Depends(get_db),
    _: None = Depends(verify_admin_auth),
):
    """Update translations for a language (admin only)"""
    
    language = request.language.lower()
    
    # Delete existing translations for this language
    db.query(TranslationBundle).filter(
        TranslationBundle.language == language
    ).delete()
    
    # Insert new translations
    for key, value in request.translations.items():
        translation = TranslationBundle(
            language=language,
            key=key,
            value=value,
        )
        db.add(translation)
    
    # Update config version
    config_version = db.query(ConfigVersion).filter(
        ConfigVersion.config_type == "i18n"
    ).first()
    
    if not config_version:
        config_version = ConfigVersion(config_type="i18n", version=2)
        db.add(config_version)
    else:
        config_version.version += 1
    
    db.commit()
    
    # Invalidate cache
    delete_cache(f"i18n:{language}")
    
    # Publish event
    publish_event("config:i18n:updated", {
        "language": language,
        "version": config_version.version,
    })
    
    return {
        "success": True,
        "language": language,
        "version": config_version.version,
        "keys_count": len(request.translations),
        "message": "Translations updated successfully",
    }
