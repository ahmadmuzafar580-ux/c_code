import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useApp } from "@/src/lib/store";
import { avatarForUser, colors, radius, spacing, type } from "@/src/lib/theme";

function timeAgo(iso?: string) {
  if (!iso) return "—";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
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

/** A member is "online" if their last location update was within 2 minutes. */
function isOnline(updatedAt?: string) {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < 120_000;
}

export default function FamilyScreen() {
  const { members, locations, user, family, joinRequests, refresh, removeMember, focusMember, showToast } = useApp();
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const isOwner = family && user && family.owner_id === user.id;
  const pendingCount = joinRequests.length;

  const rows = useMemo(() =>
    members.map((m) => ({ ...m, loc: locations[m.id], online: isOnline(locations[m.id]?.updated_at) })),
    [members, locations]);

  const doLocate = (id: string) => {
    focusMember(id);
    router.push("/(tabs)"); // navigate to Map tab
    showToast("Centering on member");
  };

  const doRemove = async (id: string, name: string) => {
    setOpenMenu(null);
    try {
      await removeMember(id);
      showToast(`${name} removed`);
    } catch (e: any) {
      showToast(e?.message || "Could not remove");
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="family-screen">
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{family?.name || "Family"}</Text>
          <Text style={styles.subtitle}>{members.length} member{members.length === 1 ? "" : "s"}</Text>
        </View>
        {isOwner && pendingCount > 0 && (
          <Pressable
            onPress={() => router.push("/family-requests")}
            style={styles.reqPill}
            testID="family-requests-pill"
          >
            <Ionicons name="mail-unread" size={14} color={colors.onError} />
            <Text style={styles.reqPillText}>{pendingCount}</Text>
          </Pressable>
        )}
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
        renderItem={({ item }) => {
          const isSelf = item.id === user?.id;
          const sharingOff = item.sharing_enabled === false;
          return (
            <View style={styles.row} testID={`family-row-${item.id}`}>
              <View style={styles.avatarWrap}>
                <Image source={{ uri: item.avatar_url || avatarForUser(item.id) }} style={styles.avatar} contentFit="cover" />
                <View style={[styles.presenceDot, { backgroundColor: item.online && !sharingOff ? colors.success : colors.onSurfaceTertiary }]} />
              </View>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: "/history", params: { userId: item.id, name: item.name } })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                  <Text style={styles.name}>{item.name}{isSelf ? " (you)" : ""}</Text>
                  {item.role === "owner" && (
                    <View style={styles.ownerPill}><Text style={styles.ownerText}>Owner</Text></View>
                  )}
                  {sharingOff && (
                    <View style={styles.pausedPill} testID={`family-paused-${item.id}`}>
                      <Ionicons name="eye-off-outline" size={10} color={colors.onWarning} />
                      <Text style={styles.pausedText}>Paused</Text>
                    </View>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={12} color={colors.onSurfaceTertiary} />
                  <Text style={styles.meta}>{item.online ? "online" : timeAgo(item.loc?.updated_at)}</Text>
                  {item.loc?.activity && !sharingOff && (
                    <>
                      <Text style={styles.metaDot}>·</Text>
                      <Ionicons name={item.loc.activity === "driving" ? "car" : "walk"} size={12} color={colors.onSurfaceTertiary} />
                      <Text style={styles.meta}>{item.loc.activity}</Text>
                    </>
                  )}
                </View>
              </Pressable>
              <View style={styles.rightStack}>
                {item.loc?.battery != null && !sharingOff && (
                  <View style={styles.battery}>
                    <Ionicons name={batteryIcon(item.loc?.battery)} size={14} color={colors.brandPrimary} />
                    <Text style={styles.batteryText}>{item.loc.battery}%</Text>
                  </View>
                )}
                <View style={styles.rowActions}>
                  <Pressable
                    style={styles.smallBtn}
                    onPress={() => doLocate(item.id)}
                    disabled={sharingOff || !item.loc}
                    testID={`family-locate-${item.id}`}
                  >
                    <Ionicons name="locate" size={16} color={sharingOff || !item.loc ? colors.onSurfaceTertiary : colors.brandPrimary} />
                  </Pressable>
                  {isOwner && !isSelf && (
                    <Pressable
                      style={styles.smallBtn}
                      onPress={() => setOpenMenu(openMenu === item.id ? null : item.id)}
                      testID={`family-more-${item.id}`}
                    >
                      <Ionicons name="ellipsis-horizontal" size={16} color={colors.onSurface} />
                    </Pressable>
                  )}
                </View>
              </View>

              {openMenu === item.id && isOwner && !isSelf && (
                <View style={styles.menu} testID={`family-menu-${item.id}`}>
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => doRemove(item.id, item.name)}
                    testID={`family-remove-${item.id}`}
                  >
                    <Ionicons name="person-remove-outline" size={16} color={colors.error} />
                    <Text style={[styles.menuText, { color: colors.error }]}>Remove from family</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
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
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  title: { fontSize: type["2xl"], color: colors.onSurface, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceTertiary, marginTop: 2, fontSize: type.sm },
  reqPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacing.sm, height: 30, borderRadius: 999, backgroundColor: colors.error },
  reqPillText: { color: colors.onError, fontWeight: "800", fontSize: type.sm },
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
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 999 },
  presenceDot: { position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: 999, borderWidth: 2, borderColor: colors.surfaceSecondary },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  meta: { color: colors.onSurfaceTertiary, fontSize: type.sm },
  metaDot: { color: colors.onSurfaceTertiary, marginHorizontal: 4 },
  rightStack: { alignItems: "flex-end", gap: 6 },
  battery: { flexDirection: "row", alignItems: "center", gap: 4 },
  batteryText: { color: colors.onSurface, fontWeight: "600", fontSize: type.sm },
  rowActions: { flexDirection: "row", gap: spacing.xs },
  smallBtn: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  ownerPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.brandTertiary },
  ownerText: { color: colors.onBrandTertiary, fontSize: 10, fontWeight: "700" },
  pausedPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.warning },
  pausedText: { color: colors.onWarning, fontSize: 10, fontWeight: "800" },
  menu: {
    position: "absolute", right: spacing.md, top: 68, zIndex: 10,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.xs,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  menuText: { color: colors.onSurface, fontWeight: "600" },
  empty: { alignItems: "center", padding: spacing["2xl"], gap: spacing.sm },
  emptyTitle: { fontSize: type.lg, fontWeight: "700", color: colors.onSurface },
  emptySub: { color: colors.onSurfaceTertiary, textAlign: "center" },
});
