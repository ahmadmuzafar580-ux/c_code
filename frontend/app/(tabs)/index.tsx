import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View, Platform } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import FamMap, { MapCircle, MapMarker } from "@/src/components/FamMap";
import { useApp } from "@/src/lib/store";
import { avatarForUser, colors, radius, spacing, type } from "@/src/lib/theme";

// Simulated coords when device GPS not available
const DEFAULT_COORDS = { lat: 37.7749, lng: -122.4194 };

export default function MapHome() {
  const { user, family, members, locations, places, sos, updateLocation, checkIn, showToast } = useApp();
  const jitterRef = useRef(0);

  // Start foreground location tracking (best-effort). If permission denied, simulate.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let interval: any = null;
    let stopped = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!stopped) {
            await updateLocation({
              lat: current.coords.latitude,
              lng: current.coords.longitude,
              accuracy: current.coords.accuracy ?? undefined,
              speed: current.coords.speed ?? undefined,
              battery: 88,
              activity: "still",
            });
          }
          sub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 15000 },
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
          return;
        }
      } catch {}

      // Fallback: simulate motion around default coords
      const base = DEFAULT_COORDS;
      const tick = async () => {
        if (stopped) return;
        jitterRef.current += 1;
        const t = jitterRef.current;
        const lat = base.lat + Math.sin(t / 12) * 0.006;
        const lng = base.lng + Math.cos(t / 15) * 0.008;
        const speed = 2 + Math.abs(Math.sin(t / 7)) * 6;
        await updateLocation({
          lat, lng,
          accuracy: 20, speed,
          battery: Math.max(30, 90 - t % 60),
          activity: speed > 5 ? "walking" : "still",
        });
      };
      tick();
      interval = setInterval(tick, 8000);
    })();

    return () => {
      stopped = true;
      if (sub) sub.remove();
      if (interval) clearInterval(interval);
    };
  }, [updateLocation]);

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
    try {
      await checkIn(undefined, myLoc?.lat, myLoc?.lng);
      showToast("Checked in ✓");
    } catch {
      showToast("Check-in failed");
    }
  };

  return (
    <View style={styles.root} testID="map-home-screen">
      <FamMap center={center} zoom={13} markers={markers} circles={circles} />

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

      {/* SOS FAB */}
      <View style={styles.sosFabWrap} pointerEvents="box-none">
        <Pressable style={styles.sosFab} onPress={() => router.push("/sos")} testID="sos-fab">
          <Ionicons name="warning" size={22} color={colors.onError} />
          <Text style={styles.sosFabText}>SOS</Text>
        </Pressable>
      </View>
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
  sosFabWrap: { position: "absolute", right: spacing.lg, bottom: 110 },
  sosFab: {
    width: 64, height: 64, borderRadius: 999, backgroundColor: colors.error,
    alignItems: "center", justifyContent: "center",
    shadowColor: colors.error, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  sosFabText: { color: colors.onError, fontWeight: "900", fontSize: 11, marginTop: 2 },
});
