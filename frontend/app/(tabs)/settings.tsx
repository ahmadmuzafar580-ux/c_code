import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { useApp } from "@/src/lib/store";
import { avatarForUser, colors, radius, spacing, type } from "@/src/lib/theme";
import { getSosSoundMode, setSosSoundMode, SosSoundMode } from "@/src/lib/sos-prefs";

function Row({ icon, label, onPress, danger, testID, right, sub }: {
  icon: any; label: string; onPress?: () => void; danger?: boolean; testID?: string; right?: React.ReactNode; sub?: string;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID} disabled={!onPress}>
      <View style={[styles.rowIcon, danger && { backgroundColor: "#FBE7E4" }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: colors.error }]}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} /> : null)}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, family, logout, leaveFamily, setSharing, clearMyHistory, deleteAccount, showToast } = useApp();
  const [sosMode, setSosMode] = useState<SosSoundMode>("loud");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { (async () => setSosMode(await getSosSoundMode()))(); }, []);

  const sharing = user?.sharing_enabled !== false;

  const cycleSosMode = async () => {
    const order: SosSoundMode[] = ["loud", "vibrate", "silent"];
    const next = order[(order.indexOf(sosMode) + 1) % order.length];
    setSosMode(next); await setSosSoundMode(next);
  };
  const modeLabel = sosMode === "loud" ? "Loud alarm" : sosMode === "vibrate" ? "Vibrate only" : "Silent";
  const modeIcon: any = sosMode === "loud" ? "volume-high" : sosMode === "vibrate" ? "phone-portrait" : "volume-mute";

  const onSharingToggle = async (v: boolean) => {
    try { await setSharing(v); showToast(v ? "Location sharing on" : "Location sharing paused"); }
    catch (e: any) { showToast(e?.message || "Failed to update"); }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="settings-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
        <View style={styles.profile}>
          <Image source={{ uri: user?.avatar_url || avatarForUser(user?.id || "0") }} style={styles.pfp} contentFit="cover" />
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.emailText}>{user?.email}</Text>
          {family && (
            <View style={styles.famBadge}>
              <Ionicons name="people" size={14} color={colors.brandPrimary} />
              <Text style={styles.famBadgeText}>{family.name}</Text>
            </View>
          )}
        </View>

        {/* Sharing status banner */}
        <View style={[styles.statusCard, sharing ? styles.statusOn : styles.statusOff]} testID="sharing-status-card">
          <Ionicons name={sharing ? "eye" : "eye-off"} size={18} color={sharing ? colors.onBrandPrimary : colors.onWarning} />
          <Text style={[styles.statusText, { color: sharing ? colors.onBrandPrimary : colors.onWarning }]}>
            {sharing ? "Location sharing is ON" : "Location sharing is OFF"}
          </Text>
        </View>

        <Text style={styles.section}>Privacy & data</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}><Ionicons name="location-outline" size={18} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Share my location</Text>
              <Text style={styles.rowSub}>Family sees you on the map only when this is on</Text>
            </View>
            <Switch
              value={sharing}
              onValueChange={onSharingToggle}
              trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }}
              thumbColor="#FFFFFF"
              testID="settings-sharing-toggle"
            />
          </View>
          <View style={styles.divider} />
          <Row icon="trash-outline" label="Clear my location history" sub="Deletes every past point stored for you" onPress={() => setConfirmClear(true)} testID="settings-clear-history" />
          <View style={styles.divider} />
          <Row icon="document-text-outline" label="Privacy Policy" onPress={() => router.push("/privacy")} testID="settings-privacy" />
          <View style={styles.divider} />
          <Row icon="reader-outline" label="Terms of Service" onPress={() => router.push("/terms")} testID="settings-terms" />
        </View>

        {family && (
          <>
            <Text style={styles.section}>Family</Text>
            <View style={styles.card}>
              <Row icon="person-add-outline" label="Invite members" onPress={() => router.push("/invite")} testID="settings-invite" />
              <View style={styles.divider} />
              <Row icon="mail-open-outline" label="Join requests" onPress={() => router.push("/family-requests")} testID="settings-requests" />
              <View style={styles.divider} />
              <Row icon="business-outline" label="Places & Geofences" onPress={() => router.push("/places-list")} testID="settings-places" />
              <View style={styles.divider} />
              <Row icon="time-outline" label="My location history" onPress={() => router.push({ pathname: "/history", params: { userId: user?.id, name: user?.name } })} testID="settings-history" />
            </View>
          </>
        )}

        <Text style={styles.section}>Safety</Text>
        <View style={styles.card}>
          <Row icon="warning-outline" label="Trigger SOS" onPress={() => router.push("/sos")} testID="settings-sos" danger />
          <View style={styles.divider} />
          <Row icon={modeIcon} label="SOS alarm sound" sub={modeLabel} onPress={cycleSosMode} testID="settings-sos-sound" />
        </View>

        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          {family && (
            <>
              <Row icon="exit-outline" label="Leave family" onPress={() => setConfirmLeave(true)} testID="settings-leave" danger />
              <View style={styles.divider} />
            </>
          )}
          <Row icon="log-out-outline" label="Sign out" onPress={async () => { await logout(); router.replace("/(auth)/login"); }} testID="settings-logout" danger />
          <View style={styles.divider} />
          <Row icon="close-circle-outline" label="Delete account" sub="Permanently deletes all your data" onPress={() => setConfirmDelete(true)} testID="settings-delete" danger />
        </View>

        <Text style={styles.appVersion}>Famrak · v1.0 · Family safety, not surveillance.</Text>
      </ScrollView>

      {/* Confirmation modals (in-app, no native Alert) */}
      {confirmClear && (
        <Confirm
          testID="confirm-clear"
          title="Clear location history?"
          body="All your past location points will be permanently deleted. This can’t be undone."
          confirmLabel="Delete history"
          onCancel={() => setConfirmClear(false)}
          onConfirm={async () => {
            setConfirmClear(false);
            try { await clearMyHistory(); showToast("History cleared"); }
            catch (e: any) { showToast(e?.message || "Failed"); }
          }}
        />
      )}
      {confirmLeave && (
        <Confirm
          testID="confirm-leave"
          title="Leave family?"
          body="You won’t see your family on the map anymore, and they won’t see you. You can rejoin later with a new invite."
          confirmLabel="Leave"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={async () => {
            setConfirmLeave(false);
            try { await leaveFamily(); router.replace("/onboarding"); }
            catch (e: any) { showToast(e?.message || "Failed"); }
          }}
        />
      )}
      {confirmDelete && (
        <Confirm
          testID="confirm-delete"
          title="Delete your account?"
          body="This permanently deletes your account, location history, chats and check-ins. If you own a family, it will be disbanded. This cannot be undone."
          confirmLabel="Delete forever"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setConfirmDelete(false);
            try { await deleteAccount(); router.replace("/(auth)/login"); }
            catch (e: any) { showToast(e?.message || "Failed"); }
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Confirm({ title, body, confirmLabel, onConfirm, onCancel, testID }: {
  title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; testID?: string;
}) {
  return (
    <View style={confirmStyles.overlay} testID={testID}>
      <View style={confirmStyles.card}>
        <View style={confirmStyles.icon}><Ionicons name="alert-circle" size={28} color={colors.error} /></View>
        <Text style={confirmStyles.title}>{title}</Text>
        <Text style={confirmStyles.body}>{body}</Text>
        <View style={confirmStyles.actions}>
          <Pressable style={[confirmStyles.btn, confirmStyles.cancel]} onPress={onCancel} testID={`${testID}-cancel`}>
            <Text style={confirmStyles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={[confirmStyles.btn, confirmStyles.confirm]} onPress={onConfirm} testID={`${testID}-confirm`}>
            <Text style={confirmStyles.confirmText}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  profile: { alignItems: "center", paddingTop: spacing.md, paddingBottom: spacing.lg },
  pfp: { width: 88, height: 88, borderRadius: 999, borderWidth: 3, borderColor: colors.surfaceSecondary },
  name: { fontSize: type["2xl"], color: colors.onSurface, fontWeight: "800", marginTop: spacing.md },
  emailText: { color: colors.onSurfaceTertiary, marginTop: 2 },
  famBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999, backgroundColor: colors.brandTertiary,
  },
  famBadgeText: { color: colors.onBrandTertiary, fontWeight: "700" },
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md,
  },
  statusOn: { backgroundColor: colors.brandPrimary },
  statusOff: { backgroundColor: colors.warning },
  statusText: { fontWeight: "800", fontSize: type.base },
  section: { color: colors.onSurfaceTertiary, textTransform: "uppercase", fontSize: 11, marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: spacing.xs, fontWeight: "700", letterSpacing: 0.5 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, color: colors.onSurface, fontWeight: "600", fontSize: type.lg },
  rowSub: { color: colors.onSurfaceTertiary, fontSize: type.sm, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 60 },
  appVersion: { textAlign: "center", color: colors.onSurfaceTertiary, marginTop: spacing["2xl"] },
});

const confirmStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.xl, zIndex: 100 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, maxWidth: 360, width: "100%", alignItems: "center" },
  icon: { width: 56, height: 56, borderRadius: 999, backgroundColor: "#FBE7E4", alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  title: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  body: { color: colors.onSurfaceTertiary, textAlign: "center", fontSize: type.base, lineHeight: 20, marginBottom: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm, width: "100%" },
  btn: { flex: 1, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  cancel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
  confirm: { backgroundColor: colors.error },
  confirmText: { color: colors.onError, fontWeight: "800", fontSize: type.lg },
});
