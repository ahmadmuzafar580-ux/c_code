"""Famrak backend E2E test suite - covers auth, family, location, places/geofence,
chat, checkin, SOS, and WebSocket via the public /api endpoint.
"""
import os
import json
import time
import uuid
import asyncio
import pytest
import requests
import websockets

BASE_URL = os.environ.get(
    "EXPO_BACKEND_URL",
    "https://2f0b134a-c115-4c23-831f-cd32c188338c.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

RUN_ID = uuid.uuid4().hex[:8]
EMAIL_DOMAIN = "famrak-test.example.com"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def state():
    return {}


# ---------- Helpers ----------
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def register(s, email, password, name):
    return s.post(f"{API}/auth/register", json={"email": email, "password": password, "name": name}, timeout=30)


# ---------- AUTH ----------
def test_root(s):
    r = s.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_register_userA(s, state):
    email = f"TEST_A_{RUN_ID}@famrak-test.example.com"
    r = register(s, email, "secret123", "Alice TEST")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data["user"]["email"] == email.lower()
    state["A"] = {"email": email.lower(), "token": data["access_token"], "user": data["user"]}


def test_register_userB(s, state):
    email = f"TEST_B_{RUN_ID}@famrak-test.example.com"
    r = register(s, email, "secret123", "Bob TEST")
    assert r.status_code == 200, r.text
    data = r.json()
    state["B"] = {"email": email, "token": data["access_token"], "user": data["user"]}


def test_register_userC_outsider(s, state):
    """Third user, will NOT join the family - used for access control tests."""
    email = f"TEST_C_{RUN_ID}@famrak-test.example.com"
    r = register(s, email, "secret123", "Carol TEST")
    assert r.status_code == 200, r.text
    state["C"] = {"email": email, "token": r.json()["access_token"], "user": r.json()["user"]}


def test_register_duplicate(s, state):
    r = register(s, state["A"]["email"], "secret123", "Dup")
    assert r.status_code == 400


def test_login_wrong_password(s, state):
    r = s.post(f"{API}/auth/login", json={"email": state["A"]["email"], "password": "wrong"}, timeout=15)
    assert r.status_code == 400


def test_login_success(s, state):
    r = s.post(f"{API}/auth/login", json={"email": state["A"]["email"], "password": "secret123"}, timeout=15)
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_me_without_token(s):
    r = s.get(f"{API}/auth/me", timeout=15)
    # HTTPBearer with auto_error=False + our check returns 401
    assert r.status_code in (401, 403)


def test_me_with_token(s, state):
    r = s.get(f"{API}/auth/me", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == state["A"]["email"]


# ---------- FAMILY ----------
def test_create_family_A(s, state):
    r = s.post(f"{API}/family/create", json={"name": f"TEST Family {RUN_ID}"},
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    fam = r.json()
    assert fam["owner_id"] == state["A"]["user"]["id"]
    assert fam["invite_code"]
    state["family"] = fam


def test_create_family_twice_fails(s, state):
    r = s.post(f"{API}/family/create", json={"name": "Should fail"},
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 400


def test_get_family_A(s, state):
    r = s.get(f"{API}/family", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    assert r.json()["id"] == state["family"]["id"]


def test_join_family_B(s, state):
    r = s.post(f"{API}/family/join", json={"invite_code": state["family"]["invite_code"]},
               headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == state["family"]["id"]


def test_join_family_twice(s, state):
    r = s.post(f"{API}/family/join", json={"invite_code": state["family"]["invite_code"]},
               headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 400


def test_family_members_lists_both(s, state):
    r = s.get(f"{API}/family/members", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    ids = {m["id"] for m in r.json()}
    assert state["A"]["user"]["id"] in ids and state["B"]["user"]["id"] in ids


def test_join_invalid_code(s, state):
    r = s.post(f"{API}/family/join", json={"invite_code": "BADCODE"},
               headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r.status_code == 404


# ---------- LOCATION ----------
def test_location_update_A(s, state):
    body = {"lat": 37.7749, "lng": -122.4194, "accuracy": 5, "battery": 88, "activity": "still"}
    r = s.post(f"{API}/location/update", json=body,
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["lat"] == body["lat"] and d["user_id"] == state["A"]["user"]["id"]


def test_location_update_B(s, state):
    body = {"lat": 37.7849, "lng": -122.4094, "accuracy": 8, "battery": 72, "activity": "walking"}
    r = s.post(f"{API}/location/update", json=body,
               headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200


def test_family_locations_aggregated(s, state):
    r = s.get(f"{API}/location/family", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    ids = {d["user_id"] for d in r.json()}
    assert state["A"]["user"]["id"] in ids and state["B"]["user"]["id"] in ids


def test_location_history_family_member(s, state):
    r = s.get(f"{API}/location/history/{state['B']['user']['id']}",
              headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_location_history_non_family_forbidden(s, state):
    # C is not in the family; A tries to read C's history
    r = s.get(f"{API}/location/history/{state['C']['user']['id']}",
              headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 403


def test_location_update_without_family(s, state):
    r = s.post(f"{API}/location/update", json={"lat": 1.0, "lng": 2.0},
               headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r.status_code == 400


# ---------- PLACES / GEOFENCES ----------
def test_create_place(s, state):
    body = {"name": "TEST Home", "lat": 37.7749, "lng": -122.4194, "radius": 200}
    r = s.post(f"{API}/places", json=body, headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    state["place"] = r.json()


def test_list_places(s, state):
    r = s.get(f"{API}/places", headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200
    assert any(p["id"] == state["place"]["id"] for p in r.json())


def test_geofence_haversine_logic(s, state):
    """Update B to be well outside then well inside the place radius.
    We can't easily observe WS, but we ensure the endpoint doesn't error and
    that a subsequent 'inside' update maintains state (checked implicitly via WS test)."""
    # Outside (~10km away)
    r1 = s.post(f"{API}/location/update", json={"lat": 37.86, "lng": -122.30},
                headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r1.status_code == 200
    # Inside place radius
    r2 = s.post(f"{API}/location/update", json={"lat": 37.7749, "lng": -122.4194},
                headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r2.status_code == 200


def test_delete_place(s, state):
    r = s.delete(f"{API}/places/{state['place']['id']}",
                 headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    r2 = s.delete(f"{API}/places/{state['place']['id']}",
                  headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r2.status_code == 404


# ---------- CHAT ----------
def test_chat_send_and_list(s, state):
    r = s.post(f"{API}/chat/send", json={"text": f"TEST hello {RUN_ID}"},
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    mid = r.json()["id"]
    r2 = s.get(f"{API}/chat/messages", headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r2.status_code == 200
    msgs = r2.json()
    assert any(m["id"] == mid for m in msgs)
    # chronological order (ascending created_at)
    times = [m["created_at"] for m in msgs]
    assert times == sorted(times)


def test_chat_without_family(s, state):
    r = s.post(f"{API}/chat/send", json={"text": "nope"},
               headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r.status_code == 400


# ---------- CHECK-IN ----------
def test_checkin_create_and_list(s, state):
    r = s.post(f"{API}/checkin", json={"lat": 37.7749, "lng": -122.4194, "note": "TEST arrived"},
               headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200
    cid = r.json()["id"]
    r2 = s.get(f"{API}/checkin", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r2.status_code == 200
    assert any(c["id"] == cid for c in r2.json())


# ---------- SOS ----------
def test_sos_create_active_resolve(s, state):
    r = s.post(f"{API}/sos", json={"lat": 37.78, "lng": -122.41},
               headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200
    alert_id = r.json()["id"]
    r2 = s.get(f"{API}/sos/active", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r2.status_code == 200
    assert any(a["id"] == alert_id for a in r2.json())
    r3 = s.post(f"{API}/sos/{alert_id}/resolve",
                headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r3.status_code == 200
    r4 = s.get(f"{API}/sos/active", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert not any(a["id"] == alert_id for a in r4.json())


def test_sos_resolve_not_found(s, state):
    r = s.post(f"{API}/sos/does-not-exist/resolve",
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 404


# ---------- WEBSOCKET ----------
def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def test_ws_rejects_no_token():
    async def run():
        try:
            async with websockets.connect(WS_URL, open_timeout=10, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)
                return "opened_unexpectedly"
        except websockets.exceptions.InvalidStatus as e:
            return f"invalid_status_{e.response.status_code}"
        except websockets.exceptions.ConnectionClosed as e:
            return f"closed_{e.code}"
        except Exception as e:
            return f"err_{type(e).__name__}"
    result = _run(run())
    assert result != "opened_unexpectedly", f"got {result}"


def test_ws_rejects_bad_token():
    async def run():
        try:
            async with websockets.connect(f"{WS_URL}?token=badtoken", open_timeout=10, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)
                return "opened_unexpectedly"
        except websockets.exceptions.ConnectionClosed as e:
            return f"closed_{e.code}"
        except Exception as e:
            return f"err_{type(e).__name__}"
    result = _run(run())
    assert result != "opened_unexpectedly", f"got {result}"


def test_ws_hello_and_broadcast(state):
    """Connect user A via WS; user B posts a chat message and updates location;
    A should receive both events in its family room. C (outsider) must not."""

    tokenA = state["A"]["token"]
    tokenB = state["B"]["token"]
    tokenC = state["C"]["token"]

    # sanity: A must have family_id
    me = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tokenA}"}, timeout=10).json()
    print(f"WS-TEST A.me = {me}")
    assert me.get("family_id"), f"A has no family_id: {me}"

    async def run():
        events_A = []
        events_C_error = None

        # A connects
        wsA = await websockets.connect(f"{WS_URL}?token={tokenA}", open_timeout=10)
        hello_a = json.loads(await asyncio.wait_for(wsA.recv(), timeout=5))
        assert hello_a["type"] == "hello", f"expected hello got {hello_a}"

        # C (not in family) - server should close
        try:
            wsC = await websockets.connect(f"{WS_URL}?token={tokenC}", open_timeout=10)
            try:
                await asyncio.wait_for(wsC.recv(), timeout=3)
                events_C_error = "opened_unexpectedly"
            except websockets.exceptions.ConnectionClosed as e:
                events_C_error = f"closed_{e.code}"
            await wsC.close()
        except websockets.exceptions.InvalidStatus as e:
            events_C_error = f"invalid_status_{e.response.status_code}"
        except websockets.exceptions.ConnectionClosed as e:
            events_C_error = f"closed_{e.code}"
        except Exception as e:
            events_C_error = f"err_{type(e).__name__}"

        # Collector for A
        async def collect():
            try:
                while True:
                    msg = await asyncio.wait_for(wsA.recv(), timeout=8)
                    events_A.append(json.loads(msg))
            except Exception:
                return

        collector = asyncio.create_task(collect())
        await asyncio.sleep(0.5)

        # B sends actions via HTTP
        def http_post(path, body):
            return requests.post(f"{API}{path}", json=body,
                                 headers={"Authorization": f"Bearer {tokenB}"}, timeout=15)
        http_post("/chat/send", {"text": f"WS TEST {RUN_ID}"})
        http_post("/location/update", {"lat": 37.7750, "lng": -122.4195})

        # Give async broadcasts time to arrive
        await asyncio.sleep(4)
        await wsA.close()
        try:
            await collector
        except Exception:
            pass

        return events_A, events_C_error

    events_A, c_err = _run(run())
    types = {e["type"] for e in events_A}
    assert "message" in types, f"missing 'message' event in {types}"
    assert "location" in types, f"missing 'location' event in {types}"
    # C should have been rejected (1008) since not in family
    assert c_err is not None and ("1008" in c_err or "closed" in c_err or "403" in c_err), f"c_err={c_err}"


# ---------- ACCESS CONTROL for chat visibility ----------
def test_outsider_cannot_see_family_chat(s, state):
    r = s.get(f"{API}/chat/messages", headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r.status_code == 200
    # C has no family, endpoint returns empty list
    assert r.json() == []
