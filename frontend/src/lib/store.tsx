import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, WS_URL } from "./api";
import { clearToken, getToken, saveToken } from "./token";

export type User = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  family_id?: string | null;
  role: string;
  sharing_enabled?: boolean;
  consented_at?: string | null;
  emergency_contacts?: { name: string; phone: string }[];
};

export type Family = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
};

export type FamilyLocation = {
  user_id: string;
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  battery?: number | null;
  activity?: string | null;
  updated_at: string;
};

export type Message = {
  id: string;
  family_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
};

export type Place = {
  id: string;
  family_id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  icon?: string | null;
  created_by: string;
  created_at: string;
};

export type SOSAlert = {
  id: string;
  family_id: string;
  user_id: string;
  user_name: string;
  lat?: number | null;
  lng?: number | null;
  resolved: boolean;
  created_at: string;
};

export type JoinRequest = {
  id: string;
  family_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: string;
  created_at: string;
  decided_at?: string | null;
};

type AppState = {
  ready: boolean;
  user: User | null;
  family: Family | null;
  members: User[];
  locations: Record<string, FamilyLocation>;
  messages: Message[];
  places: Place[];
  sos: SOSAlert[];
  joinRequests: JoinRequest[]; // owner's inbox
  myPendingRequest: JoinRequest | null; // this user's outbound pending request
  toast: string | null;
  focusMemberId: string | null; // request the map to fly to a specific member
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, consent: boolean) => Promise<void>;
  logout: () => Promise<void>;
  createFamily: (name: string) => Promise<void>;
  requestJoinFamily: (code: string) => Promise<{ status: string; family_name?: string }>;
  cancelMyJoinRequest: () => Promise<void>;
  approveJoinRequest: (id: string) => Promise<void>;
  rejectJoinRequest: (id: string) => Promise<void>;
  fetchJoinRequests: () => Promise<void>;
  fetchMyPendingRequest: () => Promise<void>;
  leaveFamily: () => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  updateLocation: (loc: Partial<FamilyLocation> & { lat: number; lng: number }) => Promise<void>;
  addPlace: (p: { name: string; lat: number; lng: number; radius?: number; icon?: string }) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  triggerSOS: (lat?: number, lng?: number) => Promise<SOSAlert>;
  resolveSOS: (id: string) => Promise<void>;
  checkIn: (note?: string, lat?: number, lng?: number) => Promise<void>;
  setSharing: (enabled: boolean) => Promise<void>;
  clearMyHistory: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  showToast: (msg: string) => void;
  focusMember: (id: string | null) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Record<string, FamilyLocation>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [sos, setSos] = useState<SOSAlert[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [myPendingRequest, setMyPendingRequest] = useState<JoinRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [focusMemberId, setFocusMemberId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);
  const focusMember = useCallback((id: string | null) => setFocusMemberId(id), []);

  const fetchJoinRequests = useCallback(async () => {
    try { setJoinRequests(await api<JoinRequest[]>("/family/join-requests")); }
    catch { setJoinRequests([]); }
  }, []);

  const fetchMyPendingRequest = useCallback(async () => {
    try {
      const r = await api<JoinRequest | null>("/family/my-request");
      setMyPendingRequest(r);
    } catch { setMyPendingRequest(null); }
  }, []);

  const refreshFamilyData = useCallback(async () => {
    try { setFamily(await api<Family>("/family")); } catch { setFamily(null); }
    try { setMembers(await api<User[]>("/family/members")); } catch { setMembers([]); }
    try {
      const locs = await api<FamilyLocation[]>("/location/family");
      const map: Record<string, FamilyLocation> = {};
      locs.forEach((l) => (map[l.user_id] = l));
      setLocations(map);
    } catch { setLocations({}); }
    try { setMessages(await api<Message[]>("/chat/messages")); } catch { setMessages([]); }
    try { setPlaces(await api<Place[]>("/places")); } catch { setPlaces([]); }
    try { setSos(await api<SOSAlert[]>("/sos/active")); } catch { setSos([]); }
    await fetchJoinRequests();
  }, [fetchJoinRequests]);

  const connectWS = useCallback(async () => {
    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    const token = await getToken();
    if (!token) return;
    try {
      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === "location") {
            setLocations((prev) => ({ ...prev, [ev.data.user_id]: ev.data }));
          } else if (ev.type === "message") {
            setMessages((prev) => [...prev, ev.data]);
          } else if (ev.type === "sos") {
            setSos((prev) => [ev.data, ...prev.filter((s) => s.id !== ev.data.id)]);
            showToast(`SOS from ${ev.data.user_name}`);
          } else if (ev.type === "sos_resolved") {
            setSos((prev) => prev.filter((s) => s.id !== ev.data.id));
          } else if (ev.type === "geofence") {
            showToast(`${ev.data.user_name} ${ev.data.event === "enter" ? "arrived at" : "left"} ${ev.data.place_name}`);
          } else if (ev.type === "checkin") {
            showToast(`${ev.data.user_name} checked in`);
          } else if (ev.type === "join_request") {
            showToast(`${ev.data.user_name} wants to join`);
            fetchJoinRequests();
          } else if (ev.type === "join_approved") {
            showToast(`${ev.data.user_name} joined the family`);
            refreshFamilyData();
          } else if (ev.type === "member_removed") {
            setLocations((prev) => { const c = { ...prev }; delete c[ev.data.user_id]; return c; });
            setMembers((prev) => prev.filter((m) => m.id !== ev.data.user_id));
          } else if (ev.type === "sharing_off") {
            setLocations((prev) => { const c = { ...prev }; delete c[ev.data.user_id]; return c; });
            setMembers((prev) => prev.map((m) => m.id === ev.data.user_id ? { ...m, sharing_enabled: false } : m));
            showToast(`${ev.data.user_name} paused sharing`);
          } else if (ev.type === "sharing_on") {
            setMembers((prev) => prev.map((m) => m.id === ev.data.user_id ? { ...m, sharing_enabled: true } : m));
          } else if (ev.type === "family_disbanded") {
            showToast("Family was disbanded");
            setFamily(null); setMembers([]); setLocations({}); setMessages([]); setPlaces([]); setSos([]);
          } else if (ev.type === "history_cleared") {
            // no-op locally except optional message
          }
        } catch {}
      };
      ws.onclose = () => { wsRef.current = null; };
      ws.onerror = () => {};
    } catch {}
  }, [showToast, fetchJoinRequests, refreshFamilyData]);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      if (me.family_id) {
        await refreshFamilyData();
        await connectWS();
        setMyPendingRequest(null);
      } else {
        setFamily(null); setMembers([]); setLocations({}); setMessages([]); setPlaces([]); setSos([]); setJoinRequests([]);
        await fetchMyPendingRequest();
      }
    } catch {
      setUser(null); await clearToken();
    }
  }, [refreshFamilyData, connectWS, fetchMyPendingRequest]);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) await refresh();
      setReady(true);
    })();
    return () => { try { wsRef.current?.close(); } catch {} };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST", body: { email, password }, auth: false,
    });
    await saveToken(r.access_token); setUser(r.user);
    if (r.user.family_id) { await refreshFamilyData(); await connectWS(); }
    else { await fetchMyPendingRequest(); }
  }, [refreshFamilyData, connectWS, fetchMyPendingRequest]);

  const register = useCallback(async (email: string, password: string, name: string, consent: boolean) => {
    const r = await api<{ access_token: string; user: User }>("/auth/register", {
      method: "POST", body: { email, password, name, consent }, auth: false,
    });
    await saveToken(r.access_token); setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null; await clearToken();
    setUser(null); setFamily(null); setMembers([]); setLocations({});
    setMessages([]); setPlaces([]); setSos([]); setJoinRequests([]); setMyPendingRequest(null);
  }, []);

  const createFamily = useCallback(async (name: string) => {
    const fam = await api<Family>("/family/create", { method: "POST", body: { name } });
    setFamily(fam);
    setUser(await api<User>("/auth/me"));
    await refreshFamilyData(); await connectWS();
  }, [refreshFamilyData, connectWS]);

  const requestJoinFamily = useCallback(async (code: string) => {
    const res = await api<{ status: string; family_name?: string; request_id?: string }>("/family/join", {
      method: "POST", body: { invite_code: code },
    });
    await fetchMyPendingRequest();
    return res;
  }, [fetchMyPendingRequest]);

  const cancelMyJoinRequest = useCallback(async () => {
    await api("/family/my-request/cancel", { method: "POST" });
    setMyPendingRequest(null);
  }, []);

  const approveJoinRequest = useCallback(async (id: string) => {
    await api(`/family/join-requests/${id}/approve`, { method: "POST" });
    setJoinRequests((p) => p.filter((r) => r.id !== id));
    await refreshFamilyData();
  }, [refreshFamilyData]);

  const rejectJoinRequest = useCallback(async (id: string) => {
    await api(`/family/join-requests/${id}/reject`, { method: "POST" });
    setJoinRequests((p) => p.filter((r) => r.id !== id));
  }, []);

  const leaveFamily = useCallback(async () => {
    await api("/family/leave", { method: "POST" });
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    setFamily(null); setMembers([]); setLocations({}); setMessages([]); setPlaces([]); setSos([]); setJoinRequests([]);
    setUser(await api<User>("/auth/me"));
  }, []);

  const removeMember = useCallback(async (id: string) => {
    await api(`/family/members/${id}`, { method: "DELETE" });
    setMembers((p) => p.filter((m) => m.id !== id));
    setLocations((prev) => { const c = { ...prev }; delete c[id]; return c; });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    await api<Message>("/chat/send", { method: "POST", body: { text } });
  }, []);

  const updateLocation = useCallback(async (loc: Partial<FamilyLocation> & { lat: number; lng: number }) => {
    try { await api<FamilyLocation>("/location/update", { method: "POST", body: loc }); } catch {}
  }, []);

  const addPlace = useCallback(async (p: { name: string; lat: number; lng: number; radius?: number; icon?: string }) => {
    const created = await api<Place>("/places", { method: "POST", body: p });
    setPlaces((prev) => [...prev, created]);
  }, []);

  const deletePlace = useCallback(async (id: string) => {
    await api(`/places/${id}`, { method: "DELETE" });
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const triggerSOS = useCallback(async (lat?: number, lng?: number) => {
    return await api<SOSAlert>("/sos", { method: "POST", body: { lat: lat ?? null, lng: lng ?? null } });
  }, []);

  const resolveSOS = useCallback(async (id: string) => {
    await api(`/sos/${id}/resolve`, { method: "POST" });
    setSos((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const checkIn = useCallback(async (note?: string, lat?: number, lng?: number) => {
    await api("/checkin", { method: "POST", body: { note, lat: lat ?? null, lng: lng ?? null } });
  }, []);

  const setSharing = useCallback(async (enabled: boolean) => {
    const u = await api<User>("/user/sharing", { method: "PUT", body: { enabled } });
    setUser(u);
    if (!enabled) {
      setLocations((prev) => { const c = { ...prev }; if (u.id) delete c[u.id]; return c; });
    }
  }, []);

  const clearMyHistory = useCallback(async () => {
    await api("/user/location-history", { method: "DELETE" });
    if (user?.id) setLocations((prev) => { const c = { ...prev }; delete c[user.id]; return c; });
  }, [user?.id]);

  const deleteAccount = useCallback(async () => {
    await api("/user/account", { method: "DELETE" });
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null; await clearToken();
    setUser(null); setFamily(null); setMembers([]); setLocations({});
    setMessages([]); setPlaces([]); setSos([]); setJoinRequests([]); setMyPendingRequest(null);
  }, []);

  const value = useMemo<AppState>(() => ({
    ready, user, family, members, locations, messages, places, sos, joinRequests, myPendingRequest, toast, focusMemberId,
    refresh, login, register, logout,
    createFamily, requestJoinFamily, cancelMyJoinRequest, approveJoinRequest, rejectJoinRequest,
    fetchJoinRequests, fetchMyPendingRequest,
    leaveFamily, removeMember,
    sendMessage, updateLocation, addPlace, deletePlace,
    triggerSOS, resolveSOS, checkIn,
    setSharing, clearMyHistory, deleteAccount,
    showToast, focusMember,
  }), [ready, user, family, members, locations, messages, places, sos, joinRequests, myPendingRequest, toast, focusMemberId,
      refresh, login, register, logout, createFamily, requestJoinFamily, cancelMyJoinRequest, approveJoinRequest, rejectJoinRequest,
      fetchJoinRequests, fetchMyPendingRequest, leaveFamily, removeMember,
      sendMessage, updateLocation, addPlace, deletePlace,
      triggerSOS, resolveSOS, checkIn, setSharing, clearMyHistory, deleteAccount, showToast, focusMember]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
