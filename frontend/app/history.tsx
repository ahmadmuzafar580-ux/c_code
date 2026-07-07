import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/src/lib/api";
import { colors, images, radius, spacing, type } from "@/src/lib/theme";
import { Image } from "expo-image";
import FamMap, { MapMarker } from "@/src/components/FamMap";

type Point = {
  user_id: string; lat: number; lng: number; accuracy?: number | null;
  speed?: number | null; battery?: number | null; activity?: string | null; updated_at: string;
};

function fmt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}

export default function HistoryScreen() {
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await api<Point[]>(`/location/history/${userId}?limit=80`);
        if (!cancel) setPoints(res);
      } catch {
        if (!cancel) setPoints([]);
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [userId]);

  const markers: MapMarker[] = useMemo(
    () => points.slice(0, 30).map((p, i) => ({ id: `h_${i}`, lat: p.lat, lng: p.lng, label: fmt(p.updated_at) })),
    [points]
  );
  const center = points[0] ? { lat: points[0].lat, lng: points[0].lng } : undefined;

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="history-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="history-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{name || "History"}</Text>
          <Text style={styles.subtitle}>{points.length} location points</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : points.length === 0 ? (
        <View style={styles.empty}>
          <Image source={{ uri: images.emptyHistory }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.emptyTitle}>No location data yet</Text>
          <Text style={styles.emptySub}>Location history will appear here as we track movements.</Text>
        </View>
      ) : (
        <>
          <View style={styles.mapWrap}>
            <FamMap center={center} zoom={13} markers={markers} />
          </View>
          <FlatList
            data={points}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}
            renderItem={({ item }) => (
              <View style={styles.timelineRow}>
                <View style={styles.timelineDotWrap}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineCard}>
                  <Text style={styles.timelineTime}>{fmt(item.updated_at)}</Text>
                  <View style={styles.timelineMeta}>
                    <Ionicons name={item.activity === "driving" ? "car" : item.activity === "walking" ? "walk" : "location"} size={14} color={colors.brandPrimary} />
                    <Text style={styles.timelineActivity}>{item.activity || "location"}</Text>
                    {item.speed != null && item.speed > 0 && (
                      <Text style={styles.timelineDot2}>· {(item.speed * 3.6).toFixed(0)} km/h</Text>
                    )}
                    {item.battery != null && (
                      <Text style={styles.timelineDot2}>· {item.battery}%</Text>
                    )}
                  </View>
                  <Text style={styles.timelineCoord}>{item.lat.toFixed(4)}, {item.lng.toFixed(4)}</Text>
                </View>
              </View>
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface },
  subtitle: { color: colors.onSurfaceTertiary, fontSize: type.sm },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapWrap: { height: 200, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  emptyImg: { width: 140, height: 140, borderRadius: radius.lg, opacity: 0.6, marginBottom: spacing.md },
  emptyTitle: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
  emptySub: { color: colors.onSurfaceTertiary, textAlign: "center" },
  timelineRow: { flexDirection: "row", gap: spacing.md },
  timelineDotWrap: { width: 24, alignItems: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 999, backgroundColor: colors.brandPrimary, marginTop: 8 },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 2 },
  timelineCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  timelineTime: { color: colors.onSurface, fontWeight: "700", fontSize: type.base },
  timelineMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  timelineActivity: { color: colors.onSurface, fontWeight: "600", fontSize: type.sm, textTransform: "capitalize" },
  timelineDot2: { color: colors.onSurfaceTertiary, fontSize: type.sm },
  timelineCoord: { color: colors.onSurfaceTertiary, fontSize: type.sm, marginTop: 2 },
});
