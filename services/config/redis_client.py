"""Redis client for cache and pub/sub"""

import redis
from config import settings
import json

# Create Redis client
redis_client = None

if settings.redis_url:
    try:
        redis_client = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        # Test connection
        redis_client.ping()
        print("✓ Redis connected")
    except Exception as e:
        print(f"⚠ Redis connection failed: {e}")
        redis_client = None
else:
    print("⚠ REDIS_URL not set, Redis features disabled")


def get_cache(key: str):
    """Get value from cache"""
    if not redis_client:
        return None
    try:
        value = redis_client.get(key)
        if value:
            return json.loads(value)
    except Exception:
        pass
    return None


def set_cache(key: str, value: any, ttl: int = 300):
    """Set value in cache with TTL (default 5 minutes)"""
    if not redis_client:
        return False
    try:
        redis_client.setex(key, ttl, json.dumps(value))
        return True
    except Exception:
        return False


def delete_cache(key: str):
    """Delete key from cache"""
    if not redis_client:
        return False
    try:
        redis_client.delete(key)
        return True
    except Exception:
        return False


def publish_event(channel: str, data: dict):
    """Publish event to Redis pub/sub"""
    if not redis_client:
        return False
    try:
        redis_client.publish(channel, json.dumps(data))
        return True
    except Exception:
        return False
