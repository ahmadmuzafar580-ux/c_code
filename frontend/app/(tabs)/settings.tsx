import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useApp } from "@/src/lib/store";
import { avatarForUser, colors, radius, spacing, type } from "@/src/lib/theme";
import { getSosSoundMode, setSosSoundMode, SosSoundMode } from "@/src/lib/sos-prefs";

function Row({ icon, label, onPress, danger, testID }: { icon: any; label: string; onPress: () => void; danger?: boolean; testID?: string }) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID}>
      <View style={[styles.rowIcon, danger && { backgroundColor: "#FBE7E4" }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.brandPrimary} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, family, logout, leaveFamily } = useApp();
  const [sosMode, setSosMode] = useState<SosSoundMode>("loud");
  useEffect(() => { (async () => setSosMode(await getSosSoundMode()))(); }, []);

  const cycleSosMode = async () => {
    const order: SosSoundMode[] = ["loud", "vibrate", "silent"];
    const next = order[(order.indexOf(sosMode) + 1) % order.length];
    setSosMode(next); await setSosSoundMode(next);
  };
  const modeLabel = sosMode === "loud" ? "Loud alarm" : sosMode === "vibrate" ? "Vibrate only" : "Silent";
  const modeIcon: any = sosMode === "loud" ? "volume-high" : sosMode === "vibrate" ? "phone-portrait" : "volume-mute";

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="settings-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
        <View style={styles.profile}>
          <Image source={{ uri: user?.avatar_url || avatarForUser(user?.id || "0") }} style={styles.pfp} contentFit="cover" />
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.famBadge}>
            <Ionicons name="people" size={14} color={colors.brandPrimary} />
            <Text style={styles.famBadgeText}>{family?.name}</Text>
          </View>
        </View>

        <Text style={styles.section}>Family</Text>
        <View style={styles.card}>
          <Row icon="person-add-outline" label="Invite members" onPress={() => router.push("/invite")} testID="settings-invite" />
          <View style={styles.divider} />
          <Row icon="business-outline" label="Places & Geofences" onPress={() => router.push("/places-list")} testID="settings-places" />
          <View style={styles.divider} />
          <Row icon="time-outline" label="My location history" onPress={() => router.push({ pathname: "/history", params: { userId: user?.id, name: user?.name } })} testID="settings-history" />
        </View>

        <Text style={styles.section}>Safety</Text>
        <View style={styles.card}>
          <Row icon="warning-outline" label="Trigger SOS" onPress={() => router.push("/sos")} testID="settings-sos" danger />
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={cycleSosMode} testID="settings-sos-sound">
            <View style={styles.rowIcon}><Ionicons name={modeIcon} size={18} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>SOS alarm sound</Text>
              <Text style={styles.rowSub}>{modeLabel}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
          </Pressable>
        </View>

        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <Row icon="exit-outline" label="Leave family" onPress={async () => { await leaveFamily(); router.replace("/onboarding"); }} testID="settings-leave" danger />
          <View style={styles.divider} />
          <Row icon="log-out-outline" label="Sign out" onPress={async () => { await logout(); router.replace("/(auth)/login"); }} testID="settings-logout" danger />
        </View>

        <Text style={styles.appVersion}>Famrak · v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  profile: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.lg },
  pfp: { width: 88, height: 88, borderRadius: 999, borderWidth: 3, borderColor: colors.surfaceSecondary },
  name: { fontSize: type["2xl"], color: colors.onSurface, fontWeight: "800", marginTop: spacing.md },
  email: { color: colors.onSurfaceTertiary, marginTop: 2 },
  famBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999, backgroundColor: colors.brandTertiary,
  },
  famBadgeText: { color: colors.onBrandTertiary, fontWeight: "700" },
  section: { color: colors.onSurfaceTertiary, textTransform: "uppercase", fontSize: 11, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.xs, fontWeight: "700", letterSpacing: 0.5 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, color: colors.onSurface, fontWeight: "600", fontSize: type.lg },
  rowSub: { color: colors.onSurfaceTertiary, fontSize: type.sm, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 60 },
  appVersion: { textAlign: "center", color: colors.onSurfaceTertiary, marginTop: spacing["2xl"] },
});
