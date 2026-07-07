import { Pressable, StyleSheet, Text, View, Share, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useApp } from "@/src/lib/store";
import { colors, radius, spacing, type } from "@/src/lib/theme";

const APP_LINK = "https://famrak.app";

export default function InviteScreen() {
  const { family, joinRequests, showToast } = useApp();
  const code = family?.invite_code || "------";
  // Deep-link the code so scanning the QR opens/deep-links the app
  const qrPayload = `${APP_LINK}/join?code=${code}`;
  const pendingCount = joinRequests.length;

  const message = `Join our Famrak family circle "${family?.name || ""}" with invite code: ${code}\n\nOr scan the QR / open: ${qrPayload}`;

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Copied invite code");
  };

  const share = async () => {
    try { await Share.share({ message, title: "Join our Famrak family" }); } catch {}
  };

  const shareEmail = async () => {
    const subject = encodeURIComponent(`Join our Famrak family — ${family?.name || ""}`);
    const body = encodeURIComponent(message);
    const url = `mailto:?subject=${subject}&body=${body}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else showToast("No email app configured");
    } catch { showToast("Could not open email"); }
  };

  const shareSMS = async () => {
    const sep = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${sep}body=${encodeURIComponent(message)}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else showToast("No SMS app available");
    } catch { showToast("Could not open messages"); }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root} testID="invite-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="invite-close">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Invite to family</Text>
        <Pressable
          onPress={() => router.push("/family-requests")}
          style={styles.reqBtn}
          testID="invite-requests-button"
        >
          <Ionicons name="mail-unread-outline" size={18} color={colors.onBrandPrimary} />
          {pendingCount > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>
          )}
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Family invite code</Text>
          <View style={styles.qrWrap} testID="invite-qr">
            <QRCode value={qrPayload} size={180} color={colors.onSurface} backgroundColor={colors.surfaceSecondary} />
          </View>
          <View style={styles.codeBox}>
            {code.split("").map((c, i) => (
              <View key={i} style={styles.codeChar}><Text style={styles.codeText}>{c}</Text></View>
            ))}
          </View>
          <Text style={styles.helper}>
            Share this code or QR. New members create their own account, enter the code, and wait
            for your approval before any location is shared.
          </Text>
        </View>

        <View style={styles.actionsGrid}>
          <Pressable style={styles.action} onPress={copy} testID="invite-copy-button">
            <View style={styles.actionIcon}><Ionicons name="copy-outline" size={20} color={colors.brandPrimary} /></View>
            <Text style={styles.actionText}>Copy code</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={share} testID="invite-share-button">
            <View style={styles.actionIcon}><Ionicons name="share-social-outline" size={20} color={colors.brandPrimary} /></View>
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={shareEmail} testID="invite-email-button">
            <View style={styles.actionIcon}><Ionicons name="mail-outline" size={20} color={colors.brandPrimary} /></View>
            <Text style={styles.actionText}>Email</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={shareSMS} testID="invite-sms-button">
            <View style={styles.actionIcon}><Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.brandPrimary} /></View>
            <Text style={styles.actionText}>SMS</Text>
          </Pressable>
        </View>

        {pendingCount > 0 && (
          <Pressable
            style={styles.pendingBanner}
            onPress={() => router.push("/family-requests")}
            testID="invite-pending-banner"
          >
            <Ionicons name="hourglass-outline" size={18} color={colors.onBrandTertiary} />
            <Text style={styles.pendingText}>
              {pendingCount} join request{pendingCount === 1 ? "" : "s"} waiting
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onBrandTertiary} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  reqBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  badgeText: { color: colors.onError, fontSize: 10, fontWeight: "800" },
  title: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface },
  body: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.onSurfaceTertiary, fontSize: type.sm, marginBottom: spacing.lg, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: "700" },
  qrWrap: { padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, marginBottom: spacing.lg },
  codeBox: { flexDirection: "row", gap: spacing.xs },
  codeChar: {
    width: 40, height: 52, borderRadius: radius.md, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.brandSecondary,
  },
  codeText: { fontSize: 24, fontWeight: "800", color: colors.brandPrimary },
  helper: { textAlign: "center", color: colors.onSurfaceTertiary, marginTop: spacing.lg, fontSize: type.sm, lineHeight: 18 },
  actionsGrid: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  action: {
    flex: 1, minWidth: "22%", alignItems: "center", gap: 6,
    paddingVertical: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 999, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  actionText: { color: colors.onSurface, fontWeight: "700", fontSize: type.sm },
  pendingBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary,
  },
  pendingText: { flex: 1, color: colors.onBrandTertiary, fontWeight: "700" },
});
