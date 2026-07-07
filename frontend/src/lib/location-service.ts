/**
 * High-accuracy GPS service for Famrak.
 * - Uses `Location.Accuracy.BestForNavigation` (real device GPS)
 * - Frequent updates while moving (1s / 3m)
 * - Optional background updates via TaskManager (requires native build)
 * - Never falls back to fake/simulated coordinates
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { AppState, Platform } from "react-native";
import { api } from "./api";

export const BG_LOCATION_TASK = "famrak-bg-location";

export type LocSample = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  timestamp: number;
};

export type PermState = {
  granted: boolean;
  canAskAgain: boolean;
  precise: boolean; // iOS 14+: user allowed "Precise Location"
  background: boolean;
};

/** Read current foreground + background + precise state without prompting. */
export async function readPermState(): Promise<PermState> {
  try {
    const fg = await Location.getForegroundPermissionsAsync();
    let bg = { granted: false } as any;
    try { bg = await Location.getBackgroundPermissionsAsync(); } catch {}
    // iOS 14+: `ios.scope` is "whenInUse" | "always"; precise is exposed via `accuracy` field on newer expo.
    // Fallback: assume precise if granted (mobile devices default to precise unless user chose "Approximate").
    // @ts-ignore
    const precise = fg.ios?.accuracy ? fg.ios.accuracy === "precise" : true;
    return {
      granted: !!fg.granted,
      canAskAgain: !!fg.canAskAgain,
      precise: !!precise,
      background: !!bg.granted,
    };
  } catch {
    return { granted: false, canAskAgain: true, precise: false, background: false };
  }
}

/** Prompt for foreground permission. Returns updated state. */
export async function requestForeground(): Promise<PermState> {
  await Location.requestForegroundPermissionsAsync();
  return readPermState();
}

/** Prompt for background permission (only after foreground granted). */
export async function requestBackground(): Promise<PermState> {
  try { await Location.requestBackgroundPermissionsAsync(); } catch {}
  return readPermState();
}

/** Fetch a fresh high-accuracy fix now. */
export async function getCurrentHighAccuracy(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
      mayShowUserSettingsDialog: true,
    });
  } catch {
    return null;
  }
}

/** Start foreground high-accuracy watching. Calls `onSample` on each update. */
export async function startForegroundWatch(
  onSample: (s: LocSample) => void
): Promise<Location.LocationSubscription | null> {
  try {
    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 3, // meters
        timeInterval: 1000, // ms
        mayShowUserSettingsDialog: true,
      },
      (loc) => {
        onSample({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? null,
          speed: loc.coords.speed ?? null,
          heading: loc.coords.heading ?? null,
          altitude: loc.coords.altitude ?? null,
          timestamp: loc.timestamp,
        });
      }
    );
  } catch {
    return null;
  }
}

// ----- Background updates (native only; no-op on web / Expo Go without dev-build) -----
export async function startBackgroundUpdates(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const state = await readPermState();
    if (!state.granted) return false;
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
    if (isRunning) return true;
    await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 25,
      timeInterval: 30000,
      deferredUpdatesInterval: 30000,
      showsBackgroundLocationIndicator: true, // iOS blue bar
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: "Famrak — location sharing on",
        notificationBody: "You are sharing your location with your family.",
        notificationColor: "#3A6047",
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundUpdates() {
  if (Platform.OS === "web") return;
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
    if (isRunning) await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
  } catch {}
}

// Register background task once (module-level).
if (Platform.OS !== "web") {
  try {
    if (!TaskManager.isTaskDefined(BG_LOCATION_TASK)) {
      TaskManager.defineTask(BG_LOCATION_TASK, async ({ data, error }) => {
        if (error) return;
        const locs = (data as any)?.locations as Location.LocationObject[] | undefined;
        if (!locs || !locs.length) return;
        const last = locs[locs.length - 1];
        try {
          await api("/location/update", {
            method: "POST",
            body: {
              lat: last.coords.latitude,
              lng: last.coords.longitude,
              accuracy: last.coords.accuracy ?? undefined,
              speed: last.coords.speed ?? undefined,
              battery: null,
              activity: (last.coords.speed ?? 0) > 8 ? "driving" : "still",
            },
          });
        } catch {}
      });
    }
  } catch {}
}

/** Convenience: subscribe to app foreground/background transitions. */
export function onAppState(cb: (state: string) => void) {
  const sub = AppState.addEventListener("change", cb);
  return () => sub.remove();
}
