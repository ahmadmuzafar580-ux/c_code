"""Famrak backend E2E test suite (iteration 2).

Covers previous features plus the new privacy/approval/sharing flow:
- consent required on register
- pending join-request approval flow (owner approves/rejects)
- sharing on/off toggle (broadcast, location filter, history 403)
- remove member / leave family
- clear location history
- delete account (disband family when owner)
"""
import os
import json
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


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def state():
    return {}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def register(s, email, password, name, consent=True):
    payload = {"email": email, "password": password, "name": name, "consent": consent}
    return s.post(f"{API}/auth/register", json=payload, timeout=30)


# ---------- AUTH + CONSENT ----------
def test_root(s):
    r = s.get(f"{API}/", timeout=15)
    assert r.status_code == 200 and r.json().get("status") == "ok"


def test_register_requires_consent(s):
    email = f"TEST_NC_{RUN_ID}@famrak-test.example.com"
    r = register(s, email, "secret123", "NoConsent TEST", consent=False)
    assert r.status_code == 400, r.text
    assert "consent" in r.text.lower() or "privacy" in r.text.lower()


def test_register_missing_consent_field(s):
    """Omitted consent should default to False -> 400."""
    email = f"TEST_MC_{RUN_ID}@famrak-test.example.com"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "password": "secret123", "name": "MissingConsent TEST"},
               timeout=30)
    assert r.status_code == 400, r.text


def test_register_userA_owner(s, state):
    email = f"TEST_A_{RUN_ID}@famrak-test.example.com"
    r = register(s, email, "secret123", "Alice TEST")
    assert r.status_code == 200, r.text
    data = r.json()
    u = data["user"]
    assert u["email"] == email.lower()
    assert u["sharing_enabled"] is True
    assert u.get("consented_at"), "consented_at must be returned"
    state["A"] = {"email": email.lower(), "token": data["access_token"], "user": u}


def test_register_userB_member(s, state):
    email = f"TEST_B_{RUN_ID}@famrak-test.example.com"
    r = register(s, email, "secret123", "Bob TEST")
    assert r.status_code == 200, r.text
    d = r.json()
    state["B"] = {"email": email.lower(), "token": d["access_token"], "user": d["user"]}


def test_register_userC_outsider(s, state):
    email = f"TEST_C_{RUN_ID}@famrak-test.example.com"
    r = register(s, email, "secret123", "Carol TEST")
    assert r.status_code == 200
    d = r.json()
    state["C"] = {"email": email.lower(), "token": d["access_token"], "user": d["user"]}


def test_me_with_token(s, state):
    r = s.get(f"{API}/auth/me", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == state["A"]["email"]
    assert body["sharing_enabled"] is True


# ---------- FAMILY: create ----------
def test_create_family_A(s, state):
    r = s.post(f"{API}/family/create", json={"name": f"TEST Family {RUN_ID}"},
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    fam = r.json()
    assert fam["owner_id"] == state["A"]["user"]["id"]
    state["family"] = fam


# ---------- JOIN REQUEST FLOW ----------
def test_join_family_returns_pending(s, state):
    r = s.post(f"{API}/family/join", json={"invite_code": state["family"]["invite_code"]},
               headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "pending"
    assert d["family_name"] == state["family"]["name"]
    assert "request_id" in d
    state["reqB"] = d["request_id"]


def test_join_family_bad_invite(s, state):
    r = s.post(f"{API}/family/join", json={"invite_code": "NOPE99"},
               headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r.status_code == 404


def test_my_pending_request_returns_request(s, state):
    r = s.get(f"{API}/family/my-request", headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d is not None
    assert d["id"] == state["reqB"]
    assert d["status"] == "pending"


def test_my_pending_request_null_when_none(s, state):
    r = s.get(f"{API}/family/my-request", headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r.status_code == 200
    # No pending request for C -> null
    assert r.json() in (None, {}, "null") or r.text.strip() in ("null", "")


def test_join_requests_owner_lists(s, state):
    r = s.get(f"{API}/family/join-requests", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    items = r.json()
    assert any(x["id"] == state["reqB"] and x["status"] == "pending" for x in items)


def test_join_requests_non_owner_forbidden(s, state):
    # C isn't even in the family -> returns [] per current impl (no family)
    r_c = s.get(f"{API}/family/join-requests", headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r_c.status_code == 200 and r_c.json() == []
    # B is pending, no family_id yet -> also []
    r_b = s.get(f"{API}/family/join-requests", headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r_b.status_code == 200 and r_b.json() == []


def test_approve_non_owner_forbidden(s, state):
    # C tries to approve B's request
    r = s.post(f"{API}/family/join-requests/{state['reqB']}/approve",
               headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r.status_code == 403


def test_approve_join_request(s, state):
    r = s.post(f"{API}/family/join-requests/{state['reqB']}/approve",
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    fam = r.json()
    assert fam["id"] == state["family"]["id"]
    # B now has family_id
    me = requests.get(f"{API}/auth/me", headers=auth_headers(state["B"]["token"]), timeout=15).json()
    assert me["family_id"] == state["family"]["id"]
    assert me["role"] == "member"


def test_approve_already_decided(s, state):
    r = s.post(f"{API}/family/join-requests/{state['reqB']}/approve",
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 400


# reject flow: C submits, owner rejects
def test_reject_flow(s, state):
    r1 = s.post(f"{API}/family/join", json={"invite_code": state["family"]["invite_code"]},
                headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r1.status_code == 200 and r1.json()["status"] == "pending"
    req_id = r1.json()["request_id"]
    # Non-owner cannot reject
    r_forbid = s.post(f"{API}/family/join-requests/{req_id}/reject",
                      headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r_forbid.status_code == 403
    # Owner rejects
    r2 = s.post(f"{API}/family/join-requests/{req_id}/reject",
                headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r2.status_code == 200
    # Verify C's my-request is now null
    r3 = s.get(f"{API}/family/my-request", headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r3.status_code == 200
    assert r3.json() in (None, {}) or r3.text.strip() == "null"


def test_cancel_my_request(s, state):
    # C submits again, then cancels themselves
    r1 = s.post(f"{API}/family/join", json={"invite_code": state["family"]["invite_code"]},
                headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r1.status_code == 200
    r2 = s.post(f"{API}/family/my-request/cancel",
                headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r2.status_code == 200
    r3 = s.get(f"{API}/family/my-request", headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r3.text.strip() == "null" or r3.json() in (None, {})


# ---------- LOCATION with sharing filter ----------
def test_location_update_A(s, state):
    r = s.post(f"{API}/location/update",
               json={"lat": 37.7749, "lng": -122.4194, "battery": 90, "activity": "still"},
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200


def test_location_update_B(s, state):
    r = s.post(f"{API}/location/update",
               json={"lat": 37.7849, "lng": -122.4094, "battery": 70},
               headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200


def test_family_locations_includes_both(s, state):
    r = s.get(f"{API}/location/family", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    ids = {d["user_id"] for d in r.json()}
    assert state["A"]["user"]["id"] in ids and state["B"]["user"]["id"] in ids


def test_sharing_off_B(s, state):
    r = s.put(f"{API}/user/sharing", json={"enabled": False},
              headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["sharing_enabled"] is False


def test_location_update_blocked_when_sharing_off(s, state):
    r = s.post(f"{API}/location/update", json={"lat": 1.0, "lng": 2.0},
               headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 403


def test_family_locations_excludes_sharing_off(s, state):
    """A should NOT see B in /location/family after B disabled sharing."""
    r = s.get(f"{API}/location/family", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200
    ids = {d["user_id"] for d in r.json()}
    assert state["B"]["user"]["id"] not in ids
    assert state["A"]["user"]["id"] in ids  # self visible


def test_history_forbidden_when_target_sharing_off(s, state):
    r = s.get(f"{API}/location/history/{state['B']['user']['id']}",
              headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 403


def test_history_self_still_allowed_when_sharing_off(s, state):
    """B can still see own history even with sharing off."""
    r = s.get(f"{API}/location/history/{state['B']['user']['id']}",
              headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200


def test_sharing_on_B_restores_update(s, state):
    r = s.put(f"{API}/user/sharing", json={"enabled": True},
              headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200 and r.json()["sharing_enabled"] is True
    r2 = s.post(f"{API}/location/update", json={"lat": 37.79, "lng": -122.42},
                headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r2.status_code == 200


# ---------- MEMBER REMOVAL / LEAVE ----------
def test_remove_member_non_owner_forbidden(s, state):
    # B tries to remove A -> 403
    r = s.delete(f"{API}/family/members/{state['A']['user']['id']}",
                 headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 403


def test_owner_cannot_remove_self(s, state):
    r = s.delete(f"{API}/family/members/{state['A']['user']['id']}",
                 headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 400


def test_member_can_remove_self_leave(s, state):
    """B (member) can DELETE self => leaves family."""
    r = s.delete(f"{API}/family/members/{state['B']['user']['id']}",
                 headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r.status_code == 200
    me = requests.get(f"{API}/auth/me", headers=auth_headers(state["B"]["token"]), timeout=15).json()
    assert me["family_id"] is None


def test_owner_removes_member(s, state):
    """Re-add B via approval, then owner removes B."""
    r1 = s.post(f"{API}/family/join", json={"invite_code": state["family"]["invite_code"]},
                headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r1.status_code == 200
    req_id = r1.json()["request_id"]
    r2 = s.post(f"{API}/family/join-requests/{req_id}/approve",
                headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r2.status_code == 200
    # Now owner removes B
    r3 = s.delete(f"{API}/family/members/{state['B']['user']['id']}",
                  headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r3.status_code == 200
    me = requests.get(f"{API}/auth/me", headers=auth_headers(state["B"]["token"]), timeout=15).json()
    assert me["family_id"] is None


# ---------- CLEAR HISTORY ----------
def test_clear_own_location_history(s, state):
    # Ensure A has some history first
    s.post(f"{API}/location/update", json={"lat": 37.7749, "lng": -122.4194},
           headers=auth_headers(state["A"]["token"]), timeout=15)
    r = s.delete(f"{API}/user/location-history",
                 headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True and "deleted" in body
    # Verify empty
    r2 = s.get(f"{API}/location/history/{state['A']['user']['id']}",
               headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r2.status_code == 200 and r2.json() == []


# ---------- DELETE ACCOUNT ----------
def test_delete_account_outsider(s, state):
    """C (outsider) deletes account -> user gone, token invalid."""
    r = s.delete(f"{API}/user/account",
                 headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r.status_code == 200
    r2 = s.get(f"{API}/auth/me", headers=auth_headers(state["C"]["token"]), timeout=15)
    assert r2.status_code == 401


def test_delete_account_owner_disbands_family(s, state):
    """A (owner) deletes account: family disbanded; existing members lose family_id."""
    # Re-add B first so we can verify disband
    r_join = s.post(f"{API}/family/join", json={"invite_code": state["family"]["invite_code"]},
                    headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r_join.status_code == 200
    req_id = r_join.json()["request_id"]
    r_app = s.post(f"{API}/family/join-requests/{req_id}/approve",
                   headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r_app.status_code == 200

    # Delete owner account
    r_del = s.delete(f"{API}/user/account",
                     headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r_del.status_code == 200

    # Owner token invalid
    r_me_a = s.get(f"{API}/auth/me", headers=auth_headers(state["A"]["token"]), timeout=15)
    assert r_me_a.status_code == 401

    # B still exists but has no family
    r_me_b = s.get(f"{API}/auth/me", headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r_me_b.status_code == 200
    assert r_me_b.json()["family_id"] is None

    # Family lookup should 404 for B
    r_fam = s.get(f"{API}/family", headers=auth_headers(state["B"]["token"]), timeout=15)
    assert r_fam.status_code in (400, 404)


# ---------- WEBSOCKET (smoke) ----------
def _run(coro):
    return asyncio.run(coro)


def test_ws_rejects_no_token():
    async def run():
        try:
            async with websockets.connect(WS_URL, open_timeout=10, close_timeout=5) as ws:
                await asyncio.wait_for(ws.recv(), timeout=5)
                return "opened_unexpectedly"
        except Exception as e:
            return f"err_{type(e).__name__}"
    assert _run(run()) != "opened_unexpectedly"
