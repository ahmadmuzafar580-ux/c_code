import { useMemo } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useApp } from "@/src/lib/store";
import { avatarForUser, colors, radius, spacing, type } from "@/src/lib/theme";

function timeAgo(iso?: string) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function batteryIcon(pct?: number | null) {
  if (pct == null) return "battery-dead-outline" as const;
  if (pct > 75) return "battery-full" as const;
  if (pct > 40) return "battery-half" as const;
  return "battery-dead" as const;
}

export default function FamilyScreen() {
  const { members, locations, user, family, refresh } = useApp();

  const rows = useMemo(() => members.map((m) => ({
    ...m,
    loc: locations[m.id],
  })), [members, locations]);

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="family-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{family?.name || "Family"}</Text>
          <Text style={styles.subtitle}>{members.length} member{members.length === 1 ? "" : "s"}</Text>
        </View>
        <Pressable style={styles.inviteBtn} onPress={() => router.push("/invite")} testID="family-invite-button">
          <Ionicons name="person-add-outline" size={16} color={colors.onBrandPrimary} />
          <Text style={styles.inviteBtnText}>Invite</Text>
        </Pressable>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.brandPrimary} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            testID={`family-row-${item.id}`}
            onPress={() => router.push({ pathname: "/history", params: { userId: item.id, name: item.name } })}
          >
            <Image source={{ uri: item.avatar_url || avatarForUser(item.id) }} style={styles.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Text style={styles.name}>{item.name}{item.id === user?.id ? " (you)" : ""}</Text>
                {item.role === "owner" && (
                  <View style={styles.ownerPill}><Text style={styles.ownerText}>Owner</Text></View>
                )}
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={12} color={colors.onSurfaceTertiary} />
                <Text style={styles.meta}>{timeAgo(item.loc?.updated_at)}</Text>
                {item.loc?.activity && (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Ionicons name={item.loc.activity === "driving" ? "car" : "walk"} size={12} color={colors.onSurfaceTertiary} />
                    <Text style={styles.meta}>{item.loc.activity}</Text>
                  </>
                )}
              </View>
            </View>
            <View style={styles.battery}>
              <Ionicons name={batteryIcon(item.loc?.battery)} size={16} color={colors.brandPrimary} />
              <Text style={styles.batteryText}>{item.loc?.battery != null ? `${item.loc.battery}%` : "—"}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.onSurfaceTertiary} />
            <Text style={styles.emptyTitle}>No members yet</Text>
            <Text style={styles.emptySub}>Invite family to see them here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  title: { fontSize: type["2xl"], color: colors.onSurface, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceTertiary, marginTop: 2, fontSize: type.sm },
  inviteBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.brandPrimary,
  },
  inviteBtnText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: type.sm },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: { width: 52, height: 52, borderRadius: 999 },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  meta: { color: colors.onSurfaceTertiary, fontSize: type.sm },
  metaDot: { color: colors.onSurfaceTertiary, marginHorizontal: 4 },
  battery: { alignItems: "center", flexDirection: "row", gap: 4 },
  batteryText: { color: colors.onSurface, fontWeight: "600", fontSize: type.sm },
  ownerPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.brandTertiary },
  ownerText: { color: colors.onBrandTertiary, fontSize: 10, fontWeight: "700" },
  empty: { alignItems: "center", padding: spacing["2xl"], gap: spacing.sm },
  emptyTitle: { fontSize: type.lg, fontWeight: "700", color: colors.onSurface },
  emptySub: { color: colors.onSurfaceTertiary, textAlign: "center" },
});
