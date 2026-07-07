import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import FamMap, { FamMapHandle, MapCircle, MapLayer, MapMarker } from "@/src/components/FamMap";
import { useApp } from "@/src/lib/store";
import { avatarForUser, colors, radius, spacing, type } from "@/src/lib/theme";
import {
  getCurrentHighAccuracy, PermState, readPermState, requestBackground, requestForeground,
  startBackgroundUpdates, startForegroundWatch, stopBackgroundUpdates,
} from "@/src/lib/location-service";

const DEFAULT_COORDS = { lat: 37.7749, lng: -122.4194 };

export default function MapHome() {
  const { user, family, members, locations, places, sos, updateLocation, checkIn, showToast } = useApp();
  const mapRef = useRef<FamMapHandle>(null);
  const [layer, setLayer] = useState<MapLayer>("hybrid");
  const [showLayers, setShowLayers] = useState(false);
  const [perm, setPerm] = useState<PermState | null>(null);
  const [showPermPrompt, setShowPermPrompt] = useState(false);
  const [askBg, setAskBg] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // Kick off GPS on mount. NO simulation: if the user denies, we simply do not update.
  useEffect(() => {
    let stopped = false;
    (async () => {
      const p = await readPermState();
      if (stopped) return;
      setPerm(p);
      if (p.granted) {
        await startWatch();
        // If they haven't granted background yet, we ask them once (contextual) later.
        if (!p.background && Platform.OS !== "web") setAskBg(true);
      } else if (p.canAskAgain) {
        setShowPermPrompt(true);
      }
    })();
    return () => { stopped = true; if (watchRef.current) watchRef.current.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startWatch = async () => {
    // Fetch an immediate high-accuracy fix
    setGpsBusy(true);
    const cur = await getCurrentHighAccuracy();
    setGpsBusy(false);
    if (cur) {
      await updateLocation({
        lat: cur.coords.latitude, lng: cur.coords.longitude,
        accuracy: cur.coords.accuracy ?? undefined,
        speed: cur.coords.speed ?? undefined,
        battery: null,
        activity: "still",
      });
      mapRef.current?.flyTo(cur.coords.latitude, cur.coords.longitude, 16);
    }
    if (watchRef.current) { watchRef.current.remove(); watchRef.current = null; }
    watchRef.current = await startForegroundWatch(async (s) => {
      await updateLocation({
        lat: s.lat, lng: s.lng,
        accuracy: s.accuracy ?? undefined,
        speed: s.speed ?? undefined,
        battery: null,
        activity: (s.speed ?? 0) > 8 ? "driving" : "still",
      });
    });
  };

  const grantForeground = async () => {
    setShowPermPrompt(false);
    const p = await requestForeground();
    setPerm(p);
    if (p.granted) {
      await startWatch();
      if (!p.background && Platform.OS !== "web") setAskBg(true);
    }
  };

  const grantBackground = async () => {
    setAskBg(false);
    const p = await requestBackground();
    setPerm(p);
    if (p.background) {
      const ok = await startBackgroundUpdates();
      if (ok) showToast("Background updates on");
    }
  };

  const memberById = useMemo(() => {
    const m: Record<string, typeof members[number]> = {};
    members.forEach((mm) => (m[mm.id] = mm));
    return m;
  }, [members]);

  const markers: MapMarker[] = useMemo(() => {
    const locs = Object.values(locations);
    const memberMarkers: MapMarker[] = locs.map((l) => {
      const m = memberById[l.user_id];
      const nm = m?.name || "Member";
      return {
        id: `m_${l.user_id}`, lat: l.lat, lng: l.lng, label: nm,
        avatarUrl: m?.avatar_url || avatarForUser(l.user_id),
        isSelf: l.user_id === user?.id,
      };
    });
    const placeMarkers: MapMarker[] = places.map((p) => ({
      id: `p_${p.id}`, lat: p.lat, lng: p.lng, label: p.name,
    }));
    return [...placeMarkers, ...memberMarkers];
  }, [locations, memberById, places, user?.id]);

  const circles: MapCircle[] = useMemo(() => {
    const placeCircles: MapCircle[] = places.map((p) => ({
      id: `pc_${p.id}`, lat: p.lat, lng: p.lng, radius: p.radius, color: colors.brandPrimary,
    }));
    // Accuracy circle around user's marker (if accuracy known)
    const my = user ? locations[user.id] : undefined;
    if (my && my.accuracy && my.accuracy > 5) {
      placeCircles.push({
        id: `acc_${user!.id}`, lat: my.lat, lng: my.lng,
        radius: Math.min(my.accuracy, 200), color: "#4285F4",
      });
    }
    return placeCircles;
  }, [places, locations, user]);

  const myLoc = user ? locations[user.id] : undefined;
  const center = myLoc ? { lat: myLoc.lat, lng: myLoc.lng } : DEFAULT_COORDS;
  const accuracyText = myLoc?.accuracy != null ? `±${Math.round(myLoc.accuracy)}m` : null;
  const accuracyQuality: "good" | "ok" | "poor" | "unknown" =
    myLoc?.accuracy == null ? "unknown" : myLoc.accuracy <= 20 ? "good" : myLoc.accuracy <= 60 ? "ok" : "poor";
  const accuracyColor =
    accuracyQuality === "good" ? colors.success :
    accuracyQuality === "ok" ? colors.warning :
    accuracyQuality === "poor" ? colors.error : colors.onSurfaceTertiary;

  const onCheckIn = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try { await checkIn(undefined, myLoc?.lat, myLoc?.lng); showToast("Checked in ✓"); }
    catch { showToast("Check-in failed"); }
  };

  const centerOnMe = async () => {
    Haptics.selectionAsync();
    if (perm && !perm.granted) {
      if (!perm.canAskAgain) {
        showToast("Enable location in Settings"); try { await Linking.openSettings(); } catch {}; return;
      }
      setShowPermPrompt(true); return;
    }
    setGpsBusy(true);
    const cur = await getCurrentHighAccuracy();
    setGpsBusy(false);
    if (cur) {
      mapRef.current?.flyTo(cur.coords.latitude, cur.coords.longitude, 17);
      updateLocation({
        lat: cur.coords.latitude, lng: cur.coords.longitude,
        accuracy: cur.coords.accuracy ?? undefined,
        speed: cur.coords.speed ?? undefined,
        battery: null, activity: "still",
      });
    } else if (myLoc) {
      mapRef.current?.flyTo(myLoc.lat, myLoc.lng, 17);
    }
  };

  const fitAll = () => { Haptics.selectionAsync(); mapRef.current?.fitToMarkers(); };
  const switchLayer = (l: MapLayer) => { setLayer(l); setShowLayers(false); Haptics.selectionAsync(); };

  const stopBackground = async () => {
    await stopBackgroundUpdates(); showToast("Background updates paused");
    setPerm(await readPermState());
  };

  return (
    <View style={styles.root} testID="map-home-screen">
      <FamMap ref={mapRef} center={center} zoom={13} markers={markers} circles={circles} layer={layer} />

      {/* Sticky Header */}
      <SafeAreaView edges={["top"]} style={styles.headerWrap} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.glassPill}>
              <BlurView intensity={Platform.OS === "ios" ? 60 : 80} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.overlayGlass} />
              <Image source={{ uri: avatarForUser(user?.id || "0") }} style={styles.headerAvatar} contentFit="cover" />
              <View>
                <Text style={styles.headerHi}>Hi, {user?.name?.split(" ")[0]}</Text>
                <Text style={styles.headerFam} numberOfLines={1}>{family?.name}</Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.iconPill} onPress={() => router.push("/invite")} testID="header-invite-button">
            <BlurView intensity={Platform.OS === "ios" ? 60 : 80} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.overlayGlass} />
            <Ionicons name="person-add" size={18} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.chipsRow}>
          <Pressable style={styles.chip} onPress={onCheckIn} testID="check-in-chip">
            <BlurView intensity={Platform.OS === "ios" ? 60 : 80} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.overlayGlass} />
            <Ionicons name="checkmark-circle" size={16} color={colors.brandPrimary} />
            <Text style={styles.chipText}>Check in</Text>
          </Pressable>
          <Pressable style={styles.chip} onPress={() => router.push("/places-list")} testID="places-chip">
            <BlurView intensity={Platform.OS === "ios" ? 60 : 80} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.overlayGlass} />
            <Ionicons name="business-outline" size={16} color={colors.brandPrimary} />
            <Text style={styles.chipText}>Places</Text>
          </Pressable>
          {/* GPS accuracy chip */}
          <View style={styles.chip} testID="gps-accuracy-chip">
            <BlurView intensity={Platform.OS === "ios" ? 60 : 80} tint="light" style={StyleSheet.absoluteFill} />
            <View style={styles.overlayGlass} />
            <View style={[styles.gpsDot, { backgroundColor: accuracyColor }]} />
            <Text style={styles.chipText}>
              GPS {accuracyText || (gpsBusy ? "…" : "off")}
            </Text>
          </View>
          {/* Background badge */}
          {perm?.background && (
            <View style={styles.chip} testID="bg-chip">
              <BlurView intensity={Platform.OS === "ios" ? 60 : 80} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.overlayGlass} />
              <Ionicons name="moon-outline" size={14} color={colors.brandPrimary} />
              <Text style={styles.chipText}>Background</Text>
            </View>
          )}
        </View>

        {sos.length > 0 && (
          <View style={styles.sosBanner} testID="sos-banner">
            <Ionicons name="warning" size={18} color={colors.onError} />
            <Text style={styles.sosBannerText}>{sos[0].user_name} triggered SOS</Text>
          </View>
        )}

        {/* Approximate-location advisory (iOS Precise Location off) */}
        {perm?.granted && perm?.precise === false && (
          <Pressable style={styles.advisory} onPress={() => Linking.openSettings()} testID="precise-off-banner">
            <Ionicons name="alert-circle" size={16} color={colors.onWarning} />
            <Text style={styles.advisoryText}>Precise Location is off — accuracy is limited.</Text>
            <Text style={styles.advisoryLink}>Fix</Text>
          </Pressable>
        )}
      </SafeAreaView>

      {/* Right-side controls */}
      <View style={styles.rightControls} pointerEvents="box-none">
        <Pressable style={styles.ctrlBtn} onPress={() => setShowLayers((v) => !v)} testID="map-layer-button">
          <Ionicons name="layers" size={20} color={colors.onSurface} />
        </Pressable>
        {showLayers && (
          <View style={styles.layerMenu} testID="map-layer-menu">
            {(["hybrid", "satellite", "streets"] as MapLayer[]).map((l) => (
              <Pressable key={l} style={[styles.layerItem, layer === l && styles.layerItemActive]} onPress={() => switchLayer(l)} testID={`map-layer-${l}`}>
                <Ionicons
                  name={l === "hybrid" ? "map" : l === "satellite" ? "planet" : "navigate"}
                  size={16}
                  color={layer === l ? colors.onBrandPrimary : colors.onSurface}
                />
                <Text style={[styles.layerText, layer === l && { color: colors.onBrandPrimary }]}>
                  {l === "hybrid" ? "Hybrid" : l === "satellite" ? "Satellite" : "Streets"}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <Pressable style={styles.ctrlBtn} onPress={fitAll} testID="map-fit-all-button">
          <Ionicons name="scan" size={20} color={colors.onSurface} />
        </Pressable>
        <Pressable style={[styles.ctrlBtn, styles.ctrlBtnPrimary]} onPress={centerOnMe} testID="map-center-me-button">
          <Ionicons name="locate" size={20} color={colors.onBrandPrimary} />
        </Pressable>
        {perm?.background && (
          <Pressable style={styles.ctrlBtn} onPress={stopBackground} testID="bg-stop-button">
            <Ionicons name="pause" size={18} color={colors.onSurface} />
          </Pressable>
        )}
      </View>

      {/* SOS FAB */}
      <View style={styles.sosFabWrap} pointerEvents="box-none">
        <Pressable style={styles.sosFab} onPress={() => router.push("/sos")} testID="sos-fab">
          <Ionicons name="warning" size={22} color={colors.onError} />
          <Text style={styles.sosFabText}>SOS</Text>
        </Pressable>
      </View>

      {/* Foreground permission prompt */}
      {showPermPrompt && (
        <View style={styles.permOverlay} testID="perm-overlay">
          <View style={styles.permCard}>
            <View style={styles.permIcon}><Ionicons name="location" size={28} color={colors.onBrandPrimary} /></View>
            <Text style={styles.permTitle}>Turn on precise GPS</Text>
            <Text style={styles.permSub}>
              Famrak uses your device{"'"}s real GPS at highest accuracy so family members see your true
              location, not a rough neighborhood. Please choose{" "}
              <Text style={{ fontWeight: "800" }}>Allow While Using App</Text>
              {Platform.OS === "ios" ? <> and make sure <Text style={{ fontWeight: "800" }}>Precise Location</Text> is on.</> : <>.</>}
            </Text>
            <Pressable style={styles.permPrimary} onPress={grantForeground} testID="perm-allow-button">
              <Text style={styles.permPrimaryText}>Enable precise GPS</Text>
            </Pressable>
            <Pressable style={styles.permSecondary} onPress={() => setShowPermPrompt(false)} testID="perm-later-button">
              <Text style={styles.permSecondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Background permission prompt */}
      {askBg && perm?.granted && (
        <View style={styles.permOverlay} testID="bg-perm-overlay">
          <View style={styles.permCard}>
            <View style={[styles.permIcon, { backgroundColor: colors.brandSecondary }]}>
              <Ionicons name="moon" size={26} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.permTitle}>Share location in background?</Text>
            <Text style={styles.permSub}>
              Get updates even when Famrak isn{"'"}t open. You{"'"}ll see a small badge while
              it{"'"}s active, and you can pause anytime.
            </Text>
            <Pressable style={styles.permPrimary} onPress={grantBackground} testID="bg-allow-button">
              <Text style={styles.permPrimaryText}>Allow background</Text>
            </Pressable>
            <Pressable style={styles.permSecondary} onPress={() => setAskBg(false)} testID="bg-later-button">
              <Text style={styles.permSecondaryText}>Foreground only</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Permanently denied banner */}
      {perm && !perm.granted && !perm.canAskAgain && (
        <View style={styles.permBanner} testID="perm-denied-banner">
          <Ionicons name="alert-circle" size={16} color={colors.onWarning} />
          <Text style={styles.permBannerText}>Location off. Family can{"'"}t see you.</Text>
          <Pressable onPress={() => Linking.openSettings()} testID="perm-open-settings">
            <Text style={styles.permBannerLink}>Open Settings</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm, gap: spacing.md },
  headerLeft: { flex: 1 },
  glassPill: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingLeft: spacing.xs, paddingRight: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.pill, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  overlayGlass: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.25)" },
  headerAvatar: { width: 36, height: 36, borderRadius: 999, borderWidth: 2, borderColor: colors.surfaceSecondary },
  headerHi: { color: colors.onSurface, fontWeight: "700", fontSize: type.base },
  headerFam: { color: colors.onSurfaceTertiary, fontSize: type.sm, maxWidth: 160 },
  iconPill: {
    width: 44, height: 44, borderRadius: 999, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  chipsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
  },
  chipText: { color: colors.onSurface, fontWeight: "600", fontSize: type.sm },
  gpsDot: { width: 8, height: 8, borderRadius: 999 },
  sosBanner: {
    marginTop: spacing.md, backgroundColor: colors.error, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  sosBannerText: { color: colors.onError, fontWeight: "700" },
  advisory: {
    marginTop: spacing.sm, backgroundColor: colors.warning, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  advisoryText: { color: colors.onWarning, fontWeight: "600", flex: 1, fontSize: type.sm },
  advisoryLink: { color: colors.onWarning, fontWeight: "800", textDecorationLine: "underline" },
  rightControls: { position: "absolute", right: spacing.lg, top: 200, gap: spacing.sm, alignItems: "flex-end" },
  ctrlBtn: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  ctrlBtnPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  layerMenu: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.xs,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  layerItem: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm,
  },
  layerItemActive: { backgroundColor: colors.brandPrimary },
  layerText: { color: colors.onSurface, fontWeight: "600", fontSize: type.sm },
  sosFabWrap: { position: "absolute", right: spacing.lg, bottom: 110 },
  sosFab: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: colors.error,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.error, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  sosFabText: { color: colors.onError, fontWeight: "900", fontSize: 11, marginTop: 2 },
  permOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(28,28,30,0.55)",
    alignItems: "center", justifyContent: "center", padding: spacing.xl,
  },
  permCard: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl,
    alignItems: "center", gap: spacing.sm, maxWidth: 360, width: "100%",
  },
  permIcon: {
    width: 56, height: 56, borderRadius: 999, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  permTitle: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  permSub: { color: colors.onSurfaceTertiary, textAlign: "center", fontSize: type.base, marginBottom: spacing.md },
  permPrimary: { width: "100%", height: 52, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  permPrimaryText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: type.lg },
  permSecondary: { padding: spacing.sm },
  permSecondaryText: { color: colors.onSurfaceTertiary, fontWeight: "600" },
  permBanner: {
    position: "absolute", left: spacing.lg, right: spacing.lg, top: 180,
    backgroundColor: colors.warning, borderRadius: radius.md,
    padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  permBannerText: { color: colors.onWarning, fontWeight: "600", flex: 1 },
  permBannerLink: { color: colors.onWarning, fontWeight: "800", textDecorationLine: "underline" },
});
