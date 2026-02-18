"""WebSocket endpoint for real-time analysis progress updates."""
import asyncio
import json
from collections import defaultdict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# In-memory store of connected clients per project
_connections: dict[int, set[WebSocket]] = defaultdict(set)


async def broadcast_to_project(project_id: int, message: dict):
    """Send a message to all WebSocket clients watching a project."""
    dead = set()
    for ws in _connections.get(project_id, set()):
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    _connections[project_id] -= dead


@router.websocket("/ws/projects/{project_id}")
async def analysis_ws(websocket: WebSocket, project_id: int):
    await websocket.accept()
    _connections[project_id].add(websocket)
    try:
        while True:
            # Keep connection alive; client can send pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        _connections[project_id].discard(websocket)
        if not _connections[project_id]:
            del _connections[project_id]
