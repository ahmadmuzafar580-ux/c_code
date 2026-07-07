import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useApp } from "@/src/lib/store";
import { colors, radius, spacing, type } from "@/src/lib/theme";

export default function OnboardingScreen() {
  const { createFamily, requestJoinFamily, cancelMyJoinRequest, myPendingRequest, fetchMyPendingRequest, refresh, logout, user } = useApp();
  const [mode, setMode] = useState<"choose" | "create" | "join">("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchMyPendingRequest(); }, [fetchMyPendingRequest]);

  const doCreate = async () => {
    setError(null);
    if (!name.trim()) { setError("Give your family a name"); return; }
    setLoading(true);
    try { await createFamily(name.trim()); router.replace("/(tabs)"); }
    catch (e: any) { setError(e?.message || "Failed to create"); }
    finally { setLoading(false); }
  };

  const doJoin = async () => {
    setError(null);
    if (!code.trim()) { setError("Enter an invite code"); return; }
    setLoading(true);
    try {
      const res = await requestJoinFamily(code.trim().toUpperCase());
      if (res.status === "pending") setMode("choose");
    } catch (e: any) { setError(e?.message || "Invalid invite code"); }
    finally { setLoading(false); }
  };

  // Poll for approval every few seconds while pending
  useEffect(() => {
    if (!myPendingRequest) return;
    const t = setInterval(async () => {
      await refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [myPendingRequest, refresh]);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root} testID="onboarding-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.hello}>Hi {user?.name?.split(" ")[0] || "there"} 👋</Text>
            <Pressable onPress={logout} testID="onboarding-logout-button">
              <Text style={styles.link}>Sign out</Text>
            </Pressable>
          </View>

          {/* Pending request card */}
          {myPendingRequest && (
            <View style={styles.pendingCard} testID="onboarding-pending-card">
              <View style={styles.pendingIcon}>
                <ActivityIndicator color={colors.brandPrimary} />
              </View>
              <Text style={styles.pendingTitle}>Waiting for approval</Text>
              <Text style={styles.pendingSub}>
                Your join request is pending. The family owner needs to approve it before you can
                see each other on the map.
              </Text>
              <Pressable
                style={styles.pendingCancel}
                onPress={async () => { await cancelMyJoinRequest(); }}
                testID="onboarding-cancel-request"
              >
                <Text style={styles.pendingCancelText}>Cancel request</Text>
              </Pressable>
            </View>
          )}

          {!myPendingRequest && (
            <>
              <Text style={styles.title}>Set up your circle</Text>
              <Text style={styles.subtitle}>Create a new family or request to join one.</Text>

              {mode === "choose" && (
                <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
                  <Pressable style={styles.optionCard} onPress={() => setMode("create")} testID="onboarding-create-option">
                    <View style={[styles.optionIcon, { backgroundColor: colors.brandPrimary }]}>
                      <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>Create a family</Text>
                      <Text style={styles.optionSub}>You{"'"}ll be the owner and can approve who joins.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
                  </Pressable>
                  <Pressable style={styles.optionCard} onPress={() => setMode("join")} testID="onboarding-join-option">
                    <View style={[styles.optionIcon, { backgroundColor: colors.brandTertiary }]}>
                      <Ionicons name="key-outline" size={22} color={colors.brandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionTitle}>Request to join</Text>
                      <Text style={styles.optionSub}>The owner must approve before you can share locations.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </View>
              )}

              {mode === "create" && (
                <View style={{ marginTop: spacing.xl }}>
                  <View style={styles.field}>
                    <Ionicons name="people-outline" size={18} color={colors.onSurfaceTertiary} />
                    <TextInput placeholder="Family name (e.g. The Johnsons)" placeholderTextColor={colors.onSurfaceTertiary}
                      value={name} onChangeText={setName} style={styles.input} testID="onboarding-family-name-input" />
                  </View>
                  {error && <Text style={styles.error}>{error}</Text>}
                  <Pressable style={styles.cta} onPress={doCreate} disabled={loading} testID="onboarding-create-submit">
                    {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Create family</Text>}
                  </Pressable>
                  <Pressable onPress={() => setMode("choose")} style={styles.secondaryBtn}>
                    <Text style={styles.secondaryText}>Back</Text>
                  </Pressable>
                </View>
              )}

              {mode === "join" && (
                <View style={{ marginTop: spacing.xl }}>
                  <View style={styles.field}>
                    <Ionicons name="key-outline" size={18} color={colors.onSurfaceTertiary} />
                    <TextInput placeholder="Invite code" placeholderTextColor={colors.onSurfaceTertiary}
                      value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters"
                      style={styles.input} testID="onboarding-invite-input" />
                  </View>
                  <Text style={styles.noteText}>
                    You{"'"}ll create your own account (already done ✓) and the family owner must
                    approve your request before location sharing starts.
                  </Text>
                  {error && <Text style={styles.error}>{error}</Text>}
                  <Pressable style={styles.cta} onPress={doJoin} disabled={loading} testID="onboarding-join-submit">
                    {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Send join request</Text>}
                  </Pressable>
                  <Pressable onPress={() => setMode("choose")} style={styles.secondaryBtn}>
                    <Text style={styles.secondaryText}>Back</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  body: { padding: spacing.xl, paddingBottom: spacing["2xl"] },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl },
  hello: { fontSize: type.lg, color: colors.onSurface, fontWeight: "600" },
  link: { color: colors.brandPrimary, fontWeight: "700" },
  title: { fontSize: type["2xl"], color: colors.onSurface, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceTertiary, marginTop: spacing.xs, fontSize: type.base },
  optionCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  optionIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  optionTitle: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
  optionSub: { color: colors.onSurfaceTertiary, marginTop: 2, fontSize: type.sm },
  field: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border,
    gap: spacing.sm, height: 52,
  },
  input: { flex: 1, color: colors.onSurface, fontSize: type.lg },
  noteText: { color: colors.onSurfaceTertiary, fontSize: type.sm, marginTop: spacing.sm, lineHeight: 18 },
  cta: { height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: type.lg },
  secondaryBtn: { alignItems: "center", padding: spacing.md, marginTop: spacing.sm },
  secondaryText: { color: colors.onSurfaceTertiary, fontWeight: "600" },
  error: { color: colors.error, marginTop: spacing.md },
  pendingCard: {
    backgroundColor: colors.brandTertiary, padding: spacing.xl, borderRadius: radius.lg,
    alignItems: "center", borderWidth: 1, borderColor: colors.brandSecondary,
  },
  pendingIcon: { width: 56, height: 56, borderRadius: 999, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  pendingTitle: { color: colors.onBrandTertiary, fontWeight: "800", fontSize: type.xl },
  pendingSub: { color: colors.onBrandTertiary, textAlign: "center", marginTop: spacing.sm, fontSize: type.base, lineHeight: 20 },
  pendingCancel: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999, backgroundColor: colors.surfaceSecondary },
  pendingCancelText: { color: colors.error, fontWeight: "700" },
});
