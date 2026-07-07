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

type WsEvent =
  | { type: "hello"; data: any }
  | { type: "location"; data: FamilyLocation }
  | { type: "message"; data: Message }
  | { type: "checkin"; data: any }
  | { type: "geofence"; data: any }
  | { type: "driving"; data: any }
  | { type: "sos"; data: SOSAlert }
  | { type: "sos_resolved"; data: any }
  | { type: "pong" };

type AppState = {
  ready: boolean;
  user: User | null;
  family: Family | null;
  members: User[];
  locations: Record<string, FamilyLocation>;
  messages: Message[];
  places: Place[];
  sos: SOSAlert[];
  toast: string | null;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (code: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  updateLocation: (loc: Partial<FamilyLocation> & { lat: number; lng: number }) => Promise<void>;
  addPlace: (p: { name: string; lat: number; lng: number; radius?: number; icon?: string }) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  triggerSOS: (lat?: number, lng?: number) => Promise<SOSAlert>;
  resolveSOS: (id: string) => Promise<void>;
  checkIn: (note?: string, lat?: number, lng?: number) => Promise<void>;
  showToast: (msg: string) => void;
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
  const [toast, setToast] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  const refreshFamilyData = useCallback(async () => {
    try {
      const fam = await api<Family>("/family");
      setFamily(fam);
    } catch {
      setFamily(null);
    }
    try {
      const mems = await api<User[]>("/family/members");
      setMembers(mems);
    } catch {
      setMembers([]);
    }
    try {
      const locs = await api<FamilyLocation[]>("/location/family");
      const map: Record<string, FamilyLocation> = {};
      locs.forEach((l) => (map[l.user_id] = l));
      setLocations(map);
    } catch {
      setLocations({});
    }
    try {
      const msgs = await api<Message[]>("/chat/messages");
      setMessages(msgs);
    } catch {
      setMessages([]);
    }
    try {
      const pl = await api<Place[]>("/places");
      setPlaces(pl);
    } catch {
      setPlaces([]);
    }
    try {
      const s = await api<SOSAlert[]>("/sos/active");
      setSos(s);
    } catch {
      setSos([]);
    }
  }, []);

  const connectWS = useCallback(async () => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    const token = await getToken();
    if (!token) return;
    try {
      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const ev: WsEvent = JSON.parse(e.data);
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
            const d = ev.data;
            showToast(`${d.user_name} ${d.event === "enter" ? "arrived at" : "left"} ${d.place_name}`);
          } else if (ev.type === "checkin") {
            showToast(`${ev.data.user_name} checked in`);
          } else if (ev.type === "driving") {
            // low-noise, no toast
          }
        } catch {}
      };
      ws.onclose = () => { wsRef.current = null; };
      ws.onerror = () => {};
    } catch {}
  }, [showToast]);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      if (me.family_id) {
        await refreshFamilyData();
        await connectWS();
      } else {
        setFamily(null); setMembers([]); setLocations({}); setMessages([]); setPlaces([]); setSos([]);
      }
    } catch {
      setUser(null);
      await clearToken();
    }
  }, [refreshFamilyData, connectWS]);

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
    await saveToken(r.access_token);
    setUser(r.user);
    if (r.user.family_id) { await refreshFamilyData(); await connectWS(); }
  }, [refreshFamilyData, connectWS]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const r = await api<{ access_token: string; user: User }>("/auth/register", {
      method: "POST", body: { email, password, name }, auth: false,
    });
    await saveToken(r.access_token);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    await clearToken();
    setUser(null); setFamily(null); setMembers([]); setLocations({}); setMessages([]); setPlaces([]); setSos([]);
  }, []);

  const createFamily = useCallback(async (name: string) => {
    const fam = await api<Family>("/family/create", { method: "POST", body: { name } });
    setFamily(fam);
    const me = await api<User>("/auth/me");
    setUser(me);
    await refreshFamilyData();
    await connectWS();
  }, [refreshFamilyData, connectWS]);

  const joinFamily = useCallback(async (code: string) => {
    const fam = await api<Family>("/family/join", { method: "POST", body: { invite_code: code } });
    setFamily(fam);
    const me = await api<User>("/auth/me");
    setUser(me);
    await refreshFamilyData();
    await connectWS();
  }, [refreshFamilyData, connectWS]);

  const leaveFamily = useCallback(async () => {
    await api("/family/leave", { method: "POST" });
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
    setFamily(null); setMembers([]); setLocations({}); setMessages([]); setPlaces([]); setSos([]);
    const me = await api<User>("/auth/me");
    setUser(me);
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

  const value = useMemo<AppState>(() => ({
    ready, user, family, members, locations, messages, places, sos, toast,
    refresh, login, register, logout,
    createFamily, joinFamily, leaveFamily,
    sendMessage, updateLocation, addPlace, deletePlace,
    triggerSOS, resolveSOS, checkIn, showToast,
  }), [ready, user, family, members, locations, messages, places, sos, toast, refresh, login, register, logout, createFamily, joinFamily, leaveFamily, sendMessage, updateLocation, addPlace, deletePlace, triggerSOS, resolveSOS, checkIn, showToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
