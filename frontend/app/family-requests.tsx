import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useApp } from "@/src/lib/store";
import { colors, radius, spacing, type } from "@/src/lib/theme";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function FamilyRequestsScreen() {
  const { joinRequests, fetchJoinRequests, approveJoinRequest, rejectJoinRequest, family, user, showToast } = useApp();

  useEffect(() => { fetchJoinRequests(); }, [fetchJoinRequests]);

  const isOwner = family && user && family.owner_id === user.id;

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="family-requests-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="requests-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Join requests</Text>
          <Text style={styles.subtitle}>Only you can approve who joins</Text>
        </View>
      </View>

      {!isOwner ? (
        <View style={styles.empty}>
          <Ionicons name="lock-closed" size={40} color={colors.onSurfaceTertiary} />
          <Text style={styles.emptyTitle}>Owner only</Text>
          <Text style={styles.emptySub}>Only the family owner can review join requests.</Text>
        </View>
      ) : (
        <FlatList
          data={joinRequests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.empty} testID="requests-empty">
              <Ionicons name="mail-open-outline" size={40} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySub}>When someone requests to join, they{"'"}ll appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`request-card-${item.id}`}>
              <View style={styles.cardHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.user_name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.user_name}</Text>
                  <Text style={styles.emailText}>{item.user_email}</Text>
                  <Text style={styles.meta}>Requested {timeAgo(item.created_at)}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionBtn, styles.reject]}
                  onPress={async () => { await rejectJoinRequest(item.id); showToast("Request declined"); }}
                  testID={`request-reject-${item.id}`}
                >
                  <Ionicons name="close" size={16} color={colors.error} />
                  <Text style={[styles.actionText, { color: colors.error }]}>Decline</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.approve]}
                  onPress={async () => { await approveJoinRequest(item.id); showToast(`${item.user_name} added`); }}
                  testID={`request-approve-${item.id}`}
                >
                  <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                  <Text style={[styles.actionText, { color: colors.onBrandPrimary }]}>Approve</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
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
  empty: { alignItems: "center", padding: spacing["3xl"], gap: spacing.sm },
  emptyTitle: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
  emptySub: { color: colors.onSurfaceTertiary, textAlign: "center", maxWidth: 280 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 999, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.brandPrimary, fontWeight: "800", fontSize: type.xl },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
  emailText: { color: colors.onSurfaceTertiary, marginTop: 2, fontSize: type.sm },
  meta: { color: colors.onSurfaceTertiary, marginTop: 2, fontSize: type.sm },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: { flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 44, borderRadius: radius.md, borderWidth: 1 },
  approve: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  reject: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
  actionText: { fontWeight: "700", fontSize: type.base },
});
