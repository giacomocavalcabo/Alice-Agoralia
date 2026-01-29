"""Realtime routes for active calls"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import json

from database import get_db
from models import ActiveCall
from schemas import ActiveCallCreate, ActiveCallResponse
from redis_client import redis_client, publish_event

router = APIRouter()

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()


@router.post("/calls")
async def create_active_call(
    call: ActiveCallCreate,
    db: Session = Depends(get_db),
):
    """Create/update active call"""
    
    # Check if call already exists
    existing = db.query(ActiveCall).filter(
        ActiveCall.user_id == call.user_id,
        ActiveCall.status == "active",
    ).first()
    
    if existing:
        # Update existing
        existing.model = call.model
        existing.estimated_cost_per_min_cents = call.estimated_cost_per_min_cents
        existing.country_code = call.country_code
        db.commit()
        db.refresh(existing)
        
        # Broadcast update
        await manager.broadcast({
            "type": "call_updated",
            "data": {
                "id": existing.id,
                "user_id": existing.user_id,
                "start_time": existing.start_time.isoformat(),
                "model": existing.model,
            },
        })
        
        return {"success": True, "id": existing.id}
    
    # Create new
    active_call = ActiveCall(
        user_id=call.user_id,
        workspace_id=call.workspace_id,
        model=call.model,
        estimated_cost_per_min_cents=call.estimated_cost_per_min_cents,
        country_code=call.country_code,
        status="active",
    )
    
    db.add(active_call)
    db.commit()
    db.refresh(active_call)
    
    # Broadcast new call
    await manager.broadcast({
        "type": "call_started",
        "data": {
            "id": active_call.id,
            "user_id": active_call.user_id,
            "start_time": active_call.start_time.isoformat(),
        },
    })
    
    # Publish to Redis
    publish_event("calls:active", {
        "user_id": call.user_id,
        "action": "started",
    })
    
    return {"success": True, "id": active_call.id}


@router.post("/calls/{call_id}/end")
async def end_active_call(
    call_id: int,
    db: Session = Depends(get_db),
):
    """End an active call"""
    
    active_call = db.query(ActiveCall).filter(
        ActiveCall.id == call_id,
        ActiveCall.status == "active",
    ).first()
    
    if not active_call:
        raise HTTPException(status_code=404, detail="Active call not found")
    
    active_call.status = "completed"
    active_call.ended_at = datetime.utcnow()
    
    db.commit()
    
    # Broadcast end
    await manager.broadcast({
        "type": "call_ended",
        "data": {
            "id": active_call.id,
            "user_id": active_call.user_id,
        },
    })
    
    # Publish to Redis
    publish_event("calls:active", {
        "user_id": active_call.user_id,
        "action": "ended",
    })
    
    return {"success": True, "message": "Call ended"}


@router.get("/calls")
async def get_active_calls(
    db: Session = Depends(get_db),
):
    """Get all active calls"""
    
    active_calls = db.query(ActiveCall).filter(
        ActiveCall.status == "active",
    ).all()
    
    results = []
    for call in active_calls:
        duration = None
        if call.start_time:
            duration = int((datetime.utcnow() - call.start_time).total_seconds())
        
        results.append({
            "id": call.id,
            "user_id": call.user_id,
            "workspace_id": call.workspace_id,
            "start_time": call.start_time.isoformat(),
            "model": call.model,
            "estimated_cost_per_min_cents": call.estimated_cost_per_min_cents,
            "country_code": call.country_code,
            "duration_seconds": duration,
        })
    
    return {"active_calls": results, "count": len(results)}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for realtime updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and send periodic updates
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
