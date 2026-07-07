# Famrak — Product Requirements Document

## Overview
Famrak is a modern family tracking mobile app (Expo, iOS + Android) with a
sage-green calm design. It focuses on trust, safety, and effortless family
coordination.

## Core Features (MVP shipped)
- **JWT Auth**: Email/password register + login. Token stored in SecureStore
  (mobile) / localStorage (web).
- **Family circles**: Owner creates a family, gets a short invite code (letters
  + digits, ambiguous chars removed). Members join by code. Leave/rejoin
  supported.
- **Live Map**: Full-bleed Leaflet+CartoDB map (works out of the box in Expo
  Go, no API key required). Family avatars pinned with white border; safe-zone
  circles drawn for every geofence.
- **Location tracking (permission-based)**:
  - Foreground GPS via `expo-location` when permission granted.
  - Simulated coordinates around a base location if the device denies
    permission or the app is on the web preview.
  - Ready for background tracking in a native build (uses `expo-location`,
    permission-request flow already wired).
- **Location history**: Every update stored in `location_history`; per-member
  timeline view with map preview + activity + speed + battery.
- **Places / Geofences**: Create named places with type (Home / School / Work /
  Park) and radius (100–500 m). Server-side haversine detects entry/exit and
  broadcasts events.
- **SOS**: Full-screen modal with swipe-to-trigger (anti-accidental). Alert
  broadcasts to all family members with last known location; owner or self can
  resolve.
- **Family chat**: Real-time via WebSockets (`/api/ws?token=…`) with polling
  fallback via REST history endpoint.
- **Check-ins**: One-tap "Check in" chip on the map; broadcasts to family via
  toast.
- **Driving alerts**: When speed > 8 m/s (~29 km/h), server broadcasts a
  driving event on the WS channel.
- **Battery status**: Shown next to every member (foreground reading + mock in
  simulation).
- **Privacy controls**: Sign out, leave family. Access control enforced on
  every endpoint — no cross-family reads or writes.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB). Bearer JWT auth. All routes under
  `/api`. WebSocket at `/api/ws` uses `?token=` handshake, closes with 1008 on
  invalid token, and maintains per-family broadcast rooms.
- **Frontend**: Expo Router 6 with Stack + Tabs. Global state via a lightweight
  React context (`AppProvider` in `/app/frontend/src/lib/store.tsx`). Map via
  `react-native-webview` + Leaflet (universal, no native config).
- **Design**: Sage green (`#3A6047`) brand, warm surface, glass tab bar + glass
  chips, iOS-native clean personality. Tokens in
  `/app/frontend/src/lib/theme.ts`.

## Data Models
- `users`: id, email, password (bcrypt), name, family_id, role
- `families`: id, name, invite_code, owner_id
- `locations` (latest): user_id, lat, lng, accuracy, speed, battery, activity
- `location_history`: append-only history
- `places`: id, family_id, name, lat, lng, radius, icon
- `geofence_state`: user_id → currently-inside place ids
- `messages`: id, family_id, user_id, user_name, text
- `checkins`: id, family_id, user_id, note
- `sos_alerts`: id, family_id, user_id, resolved, lat, lng

## Testing
- 35 backend E2E tests pass (auth, family, location, geofences, chat, checkin,
  SOS, WS). See `/app/backend/tests/backend_test.py`.

## Ready for two-phone testing
1. User A signs up → creates family "Family" → shares invite code from the
   Invite screen.
2. User B signs up on phone #2 → joins with the code.
3. Both users grant Location permission → they appear on each other's map,
   chat live, receive geofence + SOS events in real time.

## Roadmap (next)
- Background location tracking (requires native build; permission strings
  already declared in `app.json` when the user publishes).
- Push notifications for SOS/geofence (emergent-managed push, on request).
- Google Maps native SDK (requires Maps API key — currently using
  Leaflet+CartoDB which needs zero setup).
