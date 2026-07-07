"""Famrak backend - family tracking API."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import string
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import asyncio
import json
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Famrak API")
api_router = APIRouter(prefix="/api")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("famrak")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    if isinstance(dt, str):
        return dt
    return dt.replace(tzinfo=timezone.utc).isoformat() if dt.tzinfo is None else dt.isoformat()


def gen_id() -> str:
    return str(uuid.uuid4())


def gen_invite_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    # Avoid ambiguous chars
    alphabet = alphabet.replace("O", "").replace("0", "").replace("I", "").replace("1", "")
    return "".join(secrets.choice(alphabet) for _ in range(length))


# ============ MODELS ============
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=64)
    consent: bool = False  # user must accept T&C + Privacy Policy


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    name: str
    avatar_url: Optional[str] = None
    family_id: Optional[str] = None
    role: str = "member"  # "owner" or "member"
    sharing_enabled: bool = True
    consented_at: Optional[str] = None
    emergency_contacts: List[Dict[str, str]] = Field(default_factory=list)


class SharingUpdate(BaseModel):
    enabled: bool


class EmergencyContact(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    phone: str = Field(min_length=4, max_length=32)


class AuthResponse(BaseModel):
    access_token: str
    user: UserPublic


class FamilyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)


class Family(BaseModel):
    id: str
    name: str
    invite_code: str
    owner_id: str
    created_at: str


class JoinFamilyReq(BaseModel):
    invite_code: str


class JoinRequest(BaseModel):
    id: str
    family_id: str
    user_id: str
    user_name: str
    user_email: EmailStr
    status: str  # "pending" | "approved" | "rejected"
    created_at: str
    decided_at: Optional[str] = None


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None  # m/s
    battery: Optional[int] = None  # 0-100
    activity: Optional[str] = None  # "still" | "walking" | "driving"


class LocationPublic(BaseModel):
    user_id: str
    lat: float
    lng: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    battery: Optional[int] = None
    activity: Optional[str] = None
    updated_at: str


class PlaceCreate(BaseModel):
    name: str
    lat: float
    lng: float
    radius: float = 150.0  # meters
    icon: Optional[str] = "home"


class Place(BaseModel):
    id: str
    family_id: str
    name: str
    lat: float
    lng: float
    radius: float
    icon: Optional[str] = "home"
    created_by: str
    created_at: str


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class Message(BaseModel):
    id: str
    family_id: str
    user_id: str
    user_name: str
    text: str
    created_at: str


class CheckIn(BaseModel):
    id: str
    family_id: str
    user_id: str
    user_name: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    note: Optional[str] = None
    created_at: str


class CheckInCreate(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    note: Optional[str] = None


class SOSCreate(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None


class SOSAlert(BaseModel):
    id: str
    family_id: str
    user_id: str
    user_name: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    resolved: bool = False
    created_at: str


# ============ AUTH HELPERS ============
def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(pw, hashed)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": now_utc() + timedelta(days=JWT_EXPIRE_DAYS),
        "iat": now_utc(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    if not creds:
        raise HTTPException(status_code=401, detail="Missing token")
    user_id = decode_token(creds.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def to_user_public(u: Dict[str, Any]) -> UserPublic:
    consented_at = u.get("consented_at")
    if consented_at and not isinstance(consented_at, str):
        consented_at = iso(consented_at)
    return UserPublic(
        id=u["id"],
        email=u["email"],
        name=u["name"],
        avatar_url=u.get("avatar_url"),
        family_id=u.get("family_id"),
        role=u.get("role", "member"),
        sharing_enabled=u.get("sharing_enabled", True),
        consented_at=consented_at,
        emergency_contacts=u.get("emergency_contacts", []),
    )


# ============ WEBSOCKET MANAGER ============
class ConnectionManager:
    def __init__(self):
        # family_id -> set of (user_id, websocket)
        self.rooms: Dict[str, List[Dict[str, Any]]] = {}

    async def connect(self, family_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(family_id, []).append({"user_id": user_id, "ws": ws})

    def disconnect(self, family_id: str, ws: WebSocket):
        conns = self.rooms.get(family_id, [])
        self.rooms[family_id] = [c for c in conns if c["ws"] is not ws]

    async def broadcast(self, family_id: str, message: Dict[str, Any], exclude_ws: Optional[WebSocket] = None):
        conns = list(self.rooms.get(family_id, []))
        for c in conns:
            if exclude_ws is not None and c["ws"] is exclude_ws:
                continue
            try:
                await c["ws"].send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


# ============ ROUTES: AUTH ============
@api_router.get("/")
async def root():
    return {"status": "ok", "app": "Famrak"}


@api_router.post("/auth/register", response_model=AuthResponse)
async def register(body: UserRegister):
    if not body.consent:
        raise HTTPException(status_code=400, detail="You must accept the Privacy Policy and Terms to continue")
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = gen_id()
    now = now_utc()
    doc = {
        "id": user_id,
        "email": body.email.lower(),
        "password": hash_password(body.password),
        "name": body.name.strip(),
        "avatar_url": None,
        "family_id": None,
        "role": "member",
        "sharing_enabled": True,
        "consented_at": now,
        "emergency_contacts": [],
        "created_at": now,
    }
    await db.users.insert_one(doc)
    token = create_token(user_id)
    return AuthResponse(access_token=token, user=to_user_public(doc))


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid email or password")
    token = create_token(user["id"])
    return AuthResponse(access_token=token, user=to_user_public(user))


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user=Depends(get_current_user)):
    return to_user_public(user)


# ============ ROUTES: FAMILY ============
@api_router.post("/family/create", response_model=Family)
async def create_family(body: FamilyCreate, user=Depends(get_current_user)):
    if user.get("family_id"):
        raise HTTPException(status_code=400, detail="Already in a family. Leave first.")
    fam_id = gen_id()
    code = gen_invite_code()
    while await db.families.find_one({"invite_code": code}):
        code = gen_invite_code()
    doc = {
        "id": fam_id,
        "name": body.name.strip(),
        "invite_code": code,
        "owner_id": user["id"],
        "created_at": now_utc(),
    }
    await db.families.insert_one(doc)
    await db.users.update_one({"id": user["id"]}, {"$set": {"family_id": fam_id, "role": "owner"}})
    return Family(id=fam_id, name=doc["name"], invite_code=code, owner_id=user["id"], created_at=iso(doc["created_at"]))


@api_router.post("/family/join", response_model=Dict[str, Any])
async def join_family_request(body: JoinFamilyReq, user=Depends(get_current_user)):
    """Create a pending join request. Owner must approve before user gets access."""
    if user.get("family_id"):
        raise HTTPException(status_code=400, detail="Already in a family. Leave first.")
    fam = await db.families.find_one({"invite_code": body.invite_code.strip().upper()})
    if not fam:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    # Existing pending request?
    existing = await db.join_requests.find_one({
        "family_id": fam["id"], "user_id": user["id"], "status": "pending"
    })
    if existing:
        return {"status": "pending", "family_name": fam["name"], "request_id": existing["id"]}
    r_id = gen_id()
    now = now_utc()
    doc = {
        "id": r_id,
        "family_id": fam["id"],
        "user_id": user["id"],
        "user_name": user["name"],
        "user_email": user["email"],
        "status": "pending",
        "created_at": now,
        "decided_at": None,
    }
    await db.join_requests.insert_one(doc)
    # Broadcast to the family owner's room (they'll see a request notification)
    asyncio.create_task(manager.broadcast(fam["id"], {
        "type": "join_request",
        "data": {"id": r_id, "user_name": user["name"], "user_email": user["email"], "at": iso(now)},
    }))
    return {"status": "pending", "family_name": fam["name"], "request_id": r_id}


@api_router.get("/family/join-requests", response_model=List[JoinRequest])
async def list_join_requests(user=Depends(get_current_user)):
    if not user.get("family_id"):
        return []
    fam = await db.families.find_one({"id": user["family_id"]})
    if not fam or fam["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the family owner can view requests")
    docs = await db.join_requests.find(
        {"family_id": user["family_id"], "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [JoinRequest(**{**d, "created_at": iso(d["created_at"]),
                           "decided_at": iso(d["decided_at"]) if d.get("decided_at") else None}) for d in docs]


@api_router.get("/family/my-request", response_model=Optional[JoinRequest])
async def my_pending_request(user=Depends(get_current_user)):
    """Current user's most recent pending join request (for status display)."""
    doc = await db.join_requests.find_one(
        {"user_id": user["id"], "status": "pending"}, {"_id": 0}, sort=[("created_at", -1)]
    )
    if not doc:
        return None
    return JoinRequest(**{**doc, "created_at": iso(doc["created_at"]),
                          "decided_at": iso(doc["decided_at"]) if doc.get("decided_at") else None})


@api_router.post("/family/join-requests/{req_id}/approve", response_model=Family)
async def approve_join_request(req_id: str, user=Depends(get_current_user)):
    req = await db.join_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    fam = await db.families.find_one({"id": req["family_id"]})
    if not fam or fam["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the family owner can approve")
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already decided")
    # Ensure the requester isn't already in another family
    requester = await db.users.find_one({"id": req["user_id"]})
    if requester and requester.get("family_id"):
        await db.join_requests.update_one({"id": req_id}, {"$set": {"status": "rejected", "decided_at": now_utc()}})
        raise HTTPException(status_code=400, detail="User already joined a different family")
    await db.users.update_one({"id": req["user_id"]}, {"$set": {"family_id": fam["id"], "role": "member"}})
    await db.join_requests.update_one({"id": req_id}, {"$set": {"status": "approved", "decided_at": now_utc()}})
    asyncio.create_task(manager.broadcast(fam["id"], {
        "type": "join_approved",
        "data": {"user_id": req["user_id"], "user_name": req["user_name"]},
    }))
    return Family(id=fam["id"], name=fam["name"], invite_code=fam["invite_code"],
                  owner_id=fam["owner_id"], created_at=iso(fam["created_at"]))


@api_router.post("/family/join-requests/{req_id}/reject")
async def reject_join_request(req_id: str, user=Depends(get_current_user)):
    req = await db.join_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    fam = await db.families.find_one({"id": req["family_id"]})
    if not fam or fam["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the family owner can reject")
    await db.join_requests.update_one({"id": req_id}, {"$set": {"status": "rejected", "decided_at": now_utc()}})
    return {"ok": True}


@api_router.post("/family/my-request/cancel")
async def cancel_my_request(user=Depends(get_current_user)):
    await db.join_requests.update_many(
        {"user_id": user["id"], "status": "pending"},
        {"$set": {"status": "rejected", "decided_at": now_utc()}}
    )
    return {"ok": True}


@api_router.get("/family", response_model=Family)
async def get_family(user=Depends(get_current_user)):
    if not user.get("family_id"):
        raise HTTPException(status_code=404, detail="Not in a family")
    fam = await db.families.find_one({"id": user["family_id"]})
    if not fam:
        raise HTTPException(status_code=404, detail="Family not found")
    return Family(
        id=fam["id"], name=fam["name"], invite_code=fam["invite_code"],
        owner_id=fam["owner_id"], created_at=iso(fam["created_at"]),
    )


@api_router.post("/family/leave")
async def leave_family(user=Depends(get_current_user)):
    if not user.get("family_id"):
        raise HTTPException(status_code=400, detail="Not in a family")
    await db.users.update_one({"id": user["id"]}, {"$set": {"family_id": None, "role": "member"}})
    return {"ok": True}


@api_router.get("/family/members", response_model=List[UserPublic])
async def family_members(user=Depends(get_current_user)):
    if not user.get("family_id"):
        return []
    members = await db.users.find({"family_id": user["family_id"]}, {"_id": 0, "password": 0}).to_list(200)
    return [to_user_public(m) for m in members]


@api_router.delete("/family/members/{member_id}")
async def remove_family_member(member_id: str, user=Depends(get_current_user)):
    """Owner removes a member; user can remove themselves (same as leave)."""
    if not user.get("family_id"):
        raise HTTPException(status_code=400, detail="Not in a family")
    fam = await db.families.find_one({"id": user["family_id"]})
    if not fam:
        raise HTTPException(status_code=404, detail="Family not found")
    target = await db.users.find_one({"id": member_id})
    if not target or target.get("family_id") != fam["id"]:
        raise HTTPException(status_code=404, detail="Member not in this family")
    is_owner = fam["owner_id"] == user["id"]
    is_self = user["id"] == member_id
    if not is_owner and not is_self:
        raise HTTPException(status_code=403, detail="Only the family owner can remove other members")
    if is_owner and is_self:
        raise HTTPException(status_code=400, detail="Owner cannot remove self; transfer ownership or delete family instead")
    # Remove
    await db.users.update_one({"id": member_id}, {"$set": {"family_id": None, "role": "member"}})
    # Purge their location + geofence state for this family
    await db.locations.delete_many({"user_id": member_id})
    await db.location_history.delete_many({"user_id": member_id, "family_id": fam["id"]})
    await db.geofence_state.delete_one({"user_id": member_id})
    asyncio.create_task(manager.broadcast(fam["id"], {
        "type": "member_removed",
        "data": {"user_id": member_id, "by": user["id"]},
    }))
    return {"ok": True}


# ============ ROUTES: PRIVACY / ACCOUNT ============
@api_router.put("/user/sharing", response_model=UserPublic)
async def toggle_sharing(body: SharingUpdate, user=Depends(get_current_user)):
    """Turn location sharing ON/OFF. When OFF the user's location is not
    broadcast, not returned to family members, and updates are rejected."""
    await db.users.update_one({"id": user["id"]}, {"$set": {"sharing_enabled": body.enabled}})
    if not body.enabled and user.get("family_id"):
        # Also purge latest location + notify family so they don't keep a stale pin.
        await db.locations.delete_one({"user_id": user["id"]})
        await db.geofence_state.delete_one({"user_id": user["id"]})
        asyncio.create_task(manager.broadcast(user["family_id"], {
            "type": "sharing_off",
            "data": {"user_id": user["id"], "user_name": user["name"]},
        }))
    else:
        asyncio.create_task(manager.broadcast(user.get("family_id") or "", {
            "type": "sharing_on",
            "data": {"user_id": user["id"], "user_name": user["name"]},
        }))
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return to_user_public(fresh)


@api_router.put("/user/emergency-contacts", response_model=UserPublic)
async def set_emergency_contacts(contacts: List[EmergencyContact], user=Depends(get_current_user)):
    payload = [{"name": c.name.strip(), "phone": c.phone.strip()} for c in contacts[:10]]
    await db.users.update_one({"id": user["id"]}, {"$set": {"emergency_contacts": payload}})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return to_user_public(fresh)


@api_router.delete("/user/location-history")
async def clear_my_location_history(user=Depends(get_current_user)):
    """User can wipe their own location history at any time."""
    res = await db.location_history.delete_many({"user_id": user["id"]})
    await db.locations.delete_one({"user_id": user["id"]})
    await db.geofence_state.delete_one({"user_id": user["id"]})
    if user.get("family_id"):
        asyncio.create_task(manager.broadcast(user["family_id"], {
            "type": "history_cleared",
            "data": {"user_id": user["id"]},
        }))
    return {"ok": True, "deleted": res.deleted_count}


@api_router.delete("/user/account")
async def delete_my_account(user=Depends(get_current_user)):
    """Delete account and all associated data. If user is a family owner,
    also disband the family and remove all members' family association."""
    uid = user["id"]
    fam_id = user.get("family_id")
    # If owner, disband family
    if fam_id:
        fam = await db.families.find_one({"id": fam_id})
        if fam and fam.get("owner_id") == uid:
            await db.users.update_many({"family_id": fam_id}, {"$set": {"family_id": None, "role": "member"}})
            await db.families.delete_one({"id": fam_id})
            await db.places.delete_many({"family_id": fam_id})
            await db.messages.delete_many({"family_id": fam_id})
            await db.checkins.delete_many({"family_id": fam_id})
            await db.sos_alerts.delete_many({"family_id": fam_id})
            await db.join_requests.delete_many({"family_id": fam_id})
            await db.location_history.delete_many({"family_id": fam_id})
            asyncio.create_task(manager.broadcast(fam_id, {"type": "family_disbanded", "data": {}}))
    # Delete user-owned data everywhere
    await db.locations.delete_many({"user_id": uid})
    await db.location_history.delete_many({"user_id": uid})
    await db.geofence_state.delete_one({"user_id": uid})
    await db.messages.delete_many({"user_id": uid})
    await db.checkins.delete_many({"user_id": uid})
    await db.sos_alerts.delete_many({"user_id": uid})
    await db.join_requests.delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# ============ ROUTES: LOCATION ============
@api_router.post("/location/update", response_model=LocationPublic)
async def update_location(body: LocationUpdate, user=Depends(get_current_user)):
    if not user.get("family_id"):
        raise HTTPException(status_code=400, detail="Join a family first")
    if not user.get("sharing_enabled", True):
        raise HTTPException(status_code=403, detail="Location sharing is off. Turn it on in Settings to share.")
    now = now_utc()
    doc = {
        "user_id": user["id"],
        "family_id": user["family_id"],
        "lat": body.lat,
        "lng": body.lng,
        "accuracy": body.accuracy,
        "speed": body.speed,
        "battery": body.battery,
        "activity": body.activity,
        "updated_at": now,
    }
    # Upsert latest
    await db.locations.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    # History
    await db.location_history.insert_one({**doc, "id": gen_id()})

    payload = LocationPublic(
        user_id=user["id"], lat=body.lat, lng=body.lng,
        accuracy=body.accuracy, speed=body.speed, battery=body.battery,
        activity=body.activity, updated_at=iso(now),
    )
    # Broadcast to family websocket room
    asyncio.create_task(manager.broadcast(user["family_id"], {
        "type": "location",
        "data": payload.model_dump(),
    }))
    # Check geofence transitions
    asyncio.create_task(check_geofence_transitions(user, body.lat, body.lng))
    # Driving detection
    if body.speed is not None and body.speed > 8.0:  # ~29 km/h
        asyncio.create_task(manager.broadcast(user["family_id"], {
            "type": "driving",
            "data": {"user_id": user["id"], "user_name": user["name"], "speed": body.speed, "at": iso(now)},
        }))
    return payload


@api_router.get("/location/family", response_model=List[LocationPublic])
async def get_family_locations(user=Depends(get_current_user)):
    if not user.get("family_id"):
        return []
    # Only include members with sharing enabled (self always visible to self)
    members = await db.users.find(
        {"family_id": user["family_id"]}, {"_id": 0, "id": 1, "sharing_enabled": 1}
    ).to_list(200)
    allowed_ids = [m["id"] for m in members if m["id"] == user["id"] or m.get("sharing_enabled", True)]
    docs = await db.locations.find(
        {"family_id": user["family_id"], "user_id": {"$in": allowed_ids}}, {"_id": 0}
    ).to_list(200)
    return [
        LocationPublic(
            user_id=d["user_id"], lat=d["lat"], lng=d["lng"],
            accuracy=d.get("accuracy"), speed=d.get("speed"),
            battery=d.get("battery"), activity=d.get("activity"),
            updated_at=iso(d["updated_at"]),
        ) for d in docs
    ]


@api_router.get("/location/history/{user_id}", response_model=List[LocationPublic])
async def get_history(user_id: str, limit: int = 100, user=Depends(get_current_user)):
    if not user.get("family_id"):
        raise HTTPException(status_code=400, detail="Not in a family")
    target = await db.users.find_one({"id": user_id})
    if not target or target.get("family_id") != user["family_id"]:
        raise HTTPException(status_code=403, detail="Not a family member")
    # Respect sharing preference: only allow self, or a member with sharing enabled
    if user_id != user["id"] and not target.get("sharing_enabled", True):
        raise HTTPException(status_code=403, detail="This member has paused location sharing")
    docs = await db.location_history.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).to_list(limit)
    return [
        LocationPublic(
            user_id=d["user_id"], lat=d["lat"], lng=d["lng"],
            accuracy=d.get("accuracy"), speed=d.get("speed"),
            battery=d.get("battery"), activity=d.get("activity"),
            updated_at=iso(d["updated_at"]),
        ) for d in docs
    ]


# ============ ROUTES: PLACES / GEOFENCES ============
@api_router.post("/places", response_model=Place)
async def create_place(body: PlaceCreate, user=Depends(get_current_user)):
    if not user.get("family_id"):
        raise HTTPException(status_code=400, detail="Join a family first")
    p_id = gen_id()
    now = now_utc()
    doc = {
        "id": p_id,
        "family_id": user["family_id"],
        "name": body.name.strip(),
        "lat": body.lat,
        "lng": body.lng,
        "radius": max(50.0, min(2000.0, body.radius)),
        "icon": body.icon or "home",
        "created_by": user["id"],
        "created_at": now,
    }
    await db.places.insert_one(doc)
    return Place(**{**doc, "created_at": iso(now)})


@api_router.get("/places", response_model=List[Place])
async def list_places(user=Depends(get_current_user)):
    if not user.get("family_id"):
        return []
    docs = await db.places.find({"family_id": user["family_id"]}, {"_id": 0}).to_list(200)
    return [Place(**{**d, "created_at": iso(d["created_at"])}) for d in docs]


@api_router.delete("/places/{place_id}")
async def delete_place(place_id: str, user=Depends(get_current_user)):
    res = await db.places.delete_one({"id": place_id, "family_id": user.get("family_id")})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Place not found")
    return {"ok": True}


def haversine_m(lat1, lng1, lat2, lng2) -> float:
    R = 6371000
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))


async def check_geofence_transitions(user: Dict[str, Any], lat: float, lng: float):
    """Detect entry/exit for a user across family places, broadcast events."""
    fam_id = user.get("family_id")
    if not fam_id:
        return
    places = await db.places.find({"family_id": fam_id}, {"_id": 0}).to_list(200)
    prev = await db.geofence_state.find_one({"user_id": user["id"]}, {"_id": 0}) or {"inside": []}
    prev_inside = set(prev.get("inside", []))
    now_inside = set()
    for p in places:
        d = haversine_m(lat, lng, p["lat"], p["lng"])
        if d <= p["radius"]:
            now_inside.add(p["id"])
    entered = now_inside - prev_inside
    exited = prev_inside - now_inside
    for pid in entered:
        pl = next((x for x in places if x["id"] == pid), None)
        if pl:
            await manager.broadcast(fam_id, {
                "type": "geofence",
                "data": {"event": "enter", "user_id": user["id"], "user_name": user["name"],
                         "place_id": pid, "place_name": pl["name"], "at": iso(now_utc())},
            })
    for pid in exited:
        pl = next((x for x in places if x["id"] == pid), None)
        if pl:
            await manager.broadcast(fam_id, {
                "type": "geofence",
                "data": {"event": "exit", "user_id": user["id"], "user_name": user["name"],
                         "place_id": pid, "place_name": pl["name"], "at": iso(now_utc())},
            })
    await db.geofence_state.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "inside": list(now_inside)}},
        upsert=True,
    )


# ============ ROUTES: CHAT ============
@api_router.get("/chat/messages", response_model=List[Message])
async def list_messages(limit: int = 50, user=Depends(get_current_user)):
    if not user.get("family_id"):
        return []
    docs = await db.messages.find({"family_id": user["family_id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    docs.reverse()
    return [Message(**{**d, "created_at": iso(d["created_at"])}) for d in docs]


@api_router.post("/chat/send", response_model=Message)
async def send_message(body: MessageCreate, user=Depends(get_current_user)):
    if not user.get("family_id"):
        raise HTTPException(status_code=400, detail="Join a family first")
    m_id = gen_id()
    now = now_utc()
    doc = {
        "id": m_id,
        "family_id": user["family_id"],
        "user_id": user["id"],
        "user_name": user["name"],
        "text": body.text.strip(),
        "created_at": now,
    }
    await db.messages.insert_one(doc)
    payload = Message(**{**doc, "created_at": iso(now)})
    asyncio.create_task(manager.broadcast(user["family_id"], {
        "type": "message",
        "data": payload.model_dump(),
    }))
    return payload


# ============ ROUTES: CHECK-IN ============
@api_router.post("/checkin", response_model=CheckIn)
async def create_checkin(body: CheckInCreate, user=Depends(get_current_user)):
    if not user.get("family_id"):
        raise HTTPException(status_code=400, detail="Join a family first")
    c_id = gen_id()
    now = now_utc()
    doc = {
        "id": c_id,
        "family_id": user["family_id"],
        "user_id": user["id"],
        "user_name": user["name"],
        "lat": body.lat,
        "lng": body.lng,
        "note": body.note,
        "created_at": now,
    }
    await db.checkins.insert_one(doc)
    payload = CheckIn(**{**doc, "created_at": iso(now)})
    asyncio.create_task(manager.broadcast(user["family_id"], {
        "type": "checkin",
        "data": payload.model_dump(),
    }))
    return payload


@api_router.get("/checkin", response_model=List[CheckIn])
async def list_checkins(limit: int = 30, user=Depends(get_current_user)):
    if not user.get("family_id"):
        return []
    docs = await db.checkins.find({"family_id": user["family_id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [CheckIn(**{**d, "created_at": iso(d["created_at"])}) for d in docs]


# ============ ROUTES: SOS ============
@api_router.post("/sos", response_model=SOSAlert)
async def trigger_sos(body: SOSCreate, user=Depends(get_current_user)):
    if not user.get("family_id"):
        raise HTTPException(status_code=400, detail="Join a family first")
    a_id = gen_id()
    now = now_utc()
    doc = {
        "id": a_id,
        "family_id": user["family_id"],
        "user_id": user["id"],
        "user_name": user["name"],
        "lat": body.lat,
        "lng": body.lng,
        "resolved": False,
        "created_at": now,
    }
    await db.sos_alerts.insert_one(doc)
    payload = SOSAlert(**{**doc, "created_at": iso(now)})
    asyncio.create_task(manager.broadcast(user["family_id"], {
        "type": "sos",
        "data": payload.model_dump(),
    }))
    return payload


@api_router.get("/sos/active", response_model=List[SOSAlert])
async def active_sos(user=Depends(get_current_user)):
    if not user.get("family_id"):
        return []
    docs = await db.sos_alerts.find(
        {"family_id": user["family_id"], "resolved": False}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return [SOSAlert(**{**d, "created_at": iso(d["created_at"])}) for d in docs]


@api_router.post("/sos/{alert_id}/resolve")
async def resolve_sos(alert_id: str, user=Depends(get_current_user)):
    res = await db.sos_alerts.update_one(
        {"id": alert_id, "family_id": user.get("family_id")},
        {"$set": {"resolved": True, "resolved_at": now_utc(), "resolved_by": user["id"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    asyncio.create_task(manager.broadcast(user["family_id"], {
        "type": "sos_resolved",
        "data": {"id": alert_id, "resolved_by": user["id"]},
    }))
    return {"ok": True}


# ============ WEBSOCKET ============
@app.websocket("/api/ws")
async def ws_endpoint(websocket: WebSocket, token: Optional[str] = None):
    user_id = decode_token(token) if token else None
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user or not user.get("family_id"):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    family_id = user["family_id"]
    await manager.connect(family_id, user_id, websocket)
    try:
        # Send initial hello
        await websocket.send_json({"type": "hello", "data": {"user_id": user_id, "family_id": family_id}})
        while True:
            data = await websocket.receive_json()
            # Optional client heartbeat
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(family_id, websocket)
    except Exception as e:
        logger.warning("ws error: %s", e)
        manager.disconnect(family_id, websocket)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
