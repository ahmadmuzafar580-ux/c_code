import { Pressable, StyleSheet, Text, View, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useApp } from "@/src/lib/store";
import { colors, radius, spacing, type } from "@/src/lib/theme";

export default function InviteScreen() {
  const { family, showToast } = useApp();
  const code = family?.invite_code || "------";

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Copied invite code");
  };

  const share = async () => {
    try {
      await Share.share({ message: `Join our family on Famrak! Use invite code: ${code}` });
    } catch {}
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root} testID="invite-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} testID="invite-close">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Invite family</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>Your invite code</Text>
          <View style={styles.codeBox}>
            {code.split("").map((c, i) => (
              <View key={i} style={styles.codeChar}>
                <Text style={styles.codeText}>{c}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.helper}>Share this code with family members to let them join.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionBtn} onPress={copy} testID="invite-copy-button">
            <Ionicons name="copy-outline" size={18} color={colors.onSurface} />
            <Text style={styles.actionText}>Copy</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={share} testID="invite-share-button">
            <Ionicons name="share-outline" size={18} color={colors.onBrandPrimary} />
            <Text style={[styles.actionText, { color: colors.onBrandPrimary }]}>Share code</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  closeBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface },
  body: { flex: 1, padding: spacing.xl, justifyContent: "space-between" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  label: { color: colors.onSurfaceTertiary, fontSize: type.base, marginBottom: spacing.lg },
  codeBox: { flexDirection: "row", gap: spacing.sm },
  codeChar: {
    width: 44, height: 56, borderRadius: radius.md, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.brandSecondary,
  },
  codeText: { fontSize: 28, fontWeight: "800", color: colors.brandPrimary },
  helper: { textAlign: "center", color: colors.onSurfaceTertiary, marginTop: spacing.lg, fontSize: type.base },
  actions: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  actionBtn: {
    flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center",
    height: 54, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  actionPrimary: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  actionText: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
});
