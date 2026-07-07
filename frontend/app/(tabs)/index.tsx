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

const DEFAULT_COORDS = { lat: 37.7749, lng: -122.4194 };

type PermState = "unknown" | "granted" | "denied" | "denied_perm";

export default function MapHome() {
  const { user, family, members, locations, places, sos, updateLocation, checkIn, showToast } = useApp();
  const mapRef = useRef<FamMapHandle>(null);
  const jitterRef = useRef(0);
  const [layer, setLayer] = useState<MapLayer>("hybrid");
  const [showLayers, setShowLayers] = useState(false);
  const [perm, setPerm] = useState<PermState>("unknown");
  const [showPermPrompt, setShowPermPrompt] = useState(false);

  // Kick off location flow: check → contextual prompt → request.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let interval: any = null;
    let stopped = false;

    const startFallback = () => {
      const base = DEFAULT_COORDS;
      const tick = async () => {
        if (stopped) return;
        jitterRef.current += 1;
        const t = jitterRef.current;
        const lat = base.lat + Math.sin(t / 12) * 0.006;
        const lng = base.lng + Math.cos(t / 15) * 0.008;
        const speed = 2 + Math.abs(Math.sin(t / 7)) * 6;
        await updateLocation({
          lat, lng, accuracy: 20, speed,
          battery: Math.max(30, 90 - (t % 60)),
          activity: speed > 5 ? "walking" : "still",
        });
      };
      tick();
      interval = setInterval(tick, 8000);
    };

    const startForeground = async () => {
      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (stopped) return;
        await updateLocation({
          lat: current.coords.latitude,
          lng: current.coords.longitude,
          accuracy: current.coords.accuracy ?? undefined,
          speed: current.coords.speed ?? undefined,
          battery: 88,
          activity: "still",
        });
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 12000 },
          (loc) => {
            updateLocation({
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? undefined,
              speed: loc.coords.speed ?? undefined,
              battery: 88,
              activity: (loc.coords.speed ?? 0) > 8 ? "driving" : "still",
            });
          }
        );
      } catch {
        startFallback();
      }
    };

    (async () => {
      try {
        const status = await Location.getForegroundPermissionsAsync();
        if (status.granted) {
          setPerm("granted");
          startForeground();
          return;
        }
        if (!status.canAskAgain) {
          setPerm("denied_perm");
          startFallback();
          return;
        }
        // First run — show a contextual explainer, then request.
        setShowPermPrompt(true);
      } catch {
        startFallback();
      }
    })();

    return () => {
      stopped = true;
      if (sub) sub.remove();
      if (interval) clearInterval(interval);
    };
  }, [updateLocation]);

  const requestPerm = async () => {
    setShowPermPrompt(false);
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.granted) {
        setPerm("granted");
        // Start tracking
        try {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await updateLocation({
            lat: current.coords.latitude,
            lng: current.coords.longitude,
            accuracy: current.coords.accuracy ?? undefined,
            speed: current.coords.speed ?? undefined,
            battery: 88,
            activity: "still",
          });
          mapRef.current?.flyTo(current.coords.latitude, current.coords.longitude, 15);
        } catch {}
      } else if (!res.canAskAgain) {
        setPerm("denied_perm");
      } else {
        setPerm("denied");
      }
    } catch {
      setPerm("denied");
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
        id: `m_${l.user_id}`,
        lat: l.lat, lng: l.lng,
        label: nm,
        avatarUrl: m?.avatar_url || avatarForUser(l.user_id),
        isSelf: l.user_id === user?.id,
      };
    });
    const placeMarkers: MapMarker[] = places.map((p) => ({
      id: `p_${p.id}`, lat: p.lat, lng: p.lng, label: p.name,
    }));
    return [...placeMarkers, ...memberMarkers];
  }, [locations, memberById, places, user?.id]);

  const circles: MapCircle[] = useMemo(
    () => places.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, radius: p.radius, color: colors.brandPrimary })),
    [places]
  );

  const myLoc = user ? locations[user.id] : undefined;
  const center = myLoc ? { lat: myLoc.lat, lng: myLoc.lng } : DEFAULT_COORDS;

  const onCheckIn = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try { await checkIn(undefined, myLoc?.lat, myLoc?.lng); showToast("Checked in ✓"); }
    catch { showToast("Check-in failed"); }
  };

  const centerOnMe = async () => {
    Haptics.selectionAsync();
    if (perm === "denied_perm") {
      // Guide to settings
      showToast("Enable location in Settings");
      try { await Linking.openSettings(); } catch {}
      return;
    }
    if (perm !== "granted") {
      setShowPermPrompt(true);
      return;
    }
    try {
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      mapRef.current?.flyTo(cur.coords.latitude, cur.coords.longitude, 16);
      updateLocation({
        lat: cur.coords.latitude, lng: cur.coords.longitude,
        accuracy: cur.coords.accuracy ?? undefined,
        speed: cur.coords.speed ?? undefined,
        battery: 88, activity: "still",
      });
    } catch {
      if (myLoc) mapRef.current?.flyTo(myLoc.lat, myLoc.lng, 16);
    }
  };

  const fitAll = () => {
    Haptics.selectionAsync();
    mapRef.current?.fitToMarkers();
  };

  const switchLayer = (l: MapLayer) => {
    setLayer(l); setShowLayers(false); Haptics.selectionAsync();
  };

  return (
    <View style={styles.root} testID="map-home-screen">
      <FamMap
        ref={mapRef}
        center={center}
        zoom={13}
        markers={markers}
        circles={circles}
        layer={layer}
      />

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
          {myLoc?.battery != null && (
            <View style={styles.chip} testID="battery-chip">
              <BlurView intensity={Platform.OS === "ios" ? 60 : 80} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.overlayGlass} />
              <Ionicons name="battery-half" size={16} color={colors.brandPrimary} />
              <Text style={styles.chipText}>{myLoc.battery}%</Text>
            </View>
          )}
        </View>

        {sos.length > 0 && (
          <View style={styles.sosBanner} testID="sos-banner">
            <Ionicons name="warning" size={18} color={colors.onError} />
            <Text style={styles.sosBannerText}>{sos[0].user_name} triggered SOS</Text>
          </View>
        )}
      </SafeAreaView>

      {/* Right-side floating controls: layer switch, fit-all, center-on-me */}
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
      </View>

      {/* SOS FAB */}
      <View style={styles.sosFabWrap} pointerEvents="box-none">
        <Pressable style={styles.sosFab} onPress={() => router.push("/sos")} testID="sos-fab">
          <Ionicons name="warning" size={22} color={colors.onError} />
          <Text style={styles.sosFabText}>SOS</Text>
        </Pressable>
      </View>

      {/* Permission prompt (contextual) */}
      {showPermPrompt && (
        <View style={styles.permOverlay} testID="perm-overlay">
          <View style={styles.permCard}>
            <View style={styles.permIcon}>
              <Ionicons name="location" size={28} color={colors.onBrandPrimary} />
            </View>
            <Text style={styles.permTitle}>Share location with family</Text>
            <Text style={styles.permSub}>
              Famrak uses your device location to show you on the map for family members
              only. You can turn this off anytime in Settings.
            </Text>
            <Pressable style={styles.permPrimary} onPress={requestPerm} testID="perm-allow-button">
              <Text style={styles.permPrimaryText}>Enable location</Text>
            </Pressable>
            <Pressable
              style={styles.permSecondary}
              onPress={() => { setShowPermPrompt(false); setPerm("denied"); }}
              testID="perm-later-button"
            >
              <Text style={styles.permSecondaryText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Permanently denied banner + Settings button */}
      {perm === "denied_perm" && (
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
  sosBanner: {
    marginTop: spacing.md, backgroundColor: colors.error, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  sosBannerText: { color: colors.onError, fontWeight: "700" },
  rightControls: {
    position: "absolute", right: spacing.lg, top: 160, gap: spacing.sm, alignItems: "flex-end",
  },
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28,28,30,0.55)",
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
    position: "absolute", left: spacing.lg, right: spacing.lg, top: 160,
    backgroundColor: colors.warning, borderRadius: radius.md,
    padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  permBannerText: { color: colors.onWarning, fontWeight: "600", flex: 1 },
  permBannerLink: { color: colors.onWarning, fontWeight: "800", textDecorationLine: "underline" },
});
