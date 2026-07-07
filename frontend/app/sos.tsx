import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useApp } from "@/src/lib/store";
import { colors, radius, spacing, type } from "@/src/lib/theme";

const { width: W } = Dimensions.get("window");
const TRACK_W = Math.min(W - 48, 340);
const KNOB = 68;
const MAX = TRACK_W - KNOB - 8;

export default function SOSScreen() {
  const { triggerSOS, resolveSOS, sos, locations, user, showToast } = useApp();
  const [sent, setSent] = useState<null | { id: string; user_name: string }>(null);
  const drag = useRef(new Animated.Value(0)).current;
  const startedRef = useRef(false);

  useEffect(() => {
    // Auto-detect existing active SOS by self
    const mine = sos.find((s) => s.user_id === user?.id && !s.resolved);
    if (mine) setSent({ id: mine.id, user_name: mine.user_name });
  }, [sos, user?.id]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const x = Math.max(0, Math.min(MAX, g.dx));
        if (!startedRef.current && x > 4) { startedRef.current = true; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
        drag.setValue(x);
      },
      onPanResponderRelease: async (_, g) => {
        const x = Math.max(0, Math.min(MAX, g.dx));
        startedRef.current = false;
        if (x >= MAX * 0.92) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Animated.timing(drag, { toValue: MAX, useNativeDriver: false, duration: 120 }).start(async () => {
            try {
              const my = user ? locations[user.id] : undefined;
              const alert = await triggerSOS(my?.lat, my?.lng);
              setSent({ id: alert.id, user_name: alert.user_name });
              showToast("SOS sent to family");
            } catch (e: any) {
              showToast(e?.message || "Failed to send SOS");
              Animated.spring(drag, { toValue: 0, useNativeDriver: false }).start();
            }
          });
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const trackColor = drag.interpolate({ inputRange: [0, MAX], outputRange: ["rgba(255,255,255,0.15)", colors.error] });

  if (sent) {
    return (
      <View style={[styles.root, { backgroundColor: colors.error }]} testID="sos-sent-screen">
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={styles.headerLight}>
            <Pressable onPress={() => router.back()} style={styles.closeBtnLight} testID="sos-close">
              <Ionicons name="close" size={22} color={colors.onError} />
            </Pressable>
          </View>
          <View style={styles.center}>
            <View style={styles.pulse}>
              <Ionicons name="warning" size={64} color={colors.onError} />
            </View>
            <Text style={styles.sentTitle}>SOS Active</Text>
            <Text style={styles.sentSub}>Your family has been alerted with your live location.</Text>
            <Pressable
              style={styles.resolveBtn}
              onPress={async () => { await resolveSOS(sent.id); setSent(null); router.back(); }}
              testID="sos-resolve-button"
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.error} />
              <Text style={styles.resolveText}>I{"'"}m safe · Resolve</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="sos-screen">
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.headerLight}>
          <Pressable onPress={() => router.back()} style={styles.closeBtnLight} testID="sos-close">
            <Ionicons name="close" size={22} color={colors.onSurfaceInverse} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <View style={styles.warnBadge}>
            <Ionicons name="warning" size={48} color={colors.onError} />
          </View>
          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.sub}>Swipe the button to alert your entire family with your live location.</Text>

          <View style={styles.trackWrap}>
            <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
              <Text style={styles.trackHint}>Swipe to send SOS</Text>
              <Animated.View
                {...responder.panHandlers}
                style={[styles.knob, { transform: [{ translateX: drag }] }]}
                testID="sos-swipe-knob"
              >
                <Ionicons name="arrow-forward" size={28} color={colors.onError} />
              </Animated.View>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  headerLight: { flexDirection: "row", padding: spacing.lg },
  closeBtnLight: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  warnBadge: { width: 96, height: 96, borderRadius: 999, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  title: { color: colors.onSurfaceInverse, fontSize: 34, fontWeight: "900", letterSpacing: 0.5 },
  sub: { color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: spacing.md, fontSize: type.lg, maxWidth: 320 },
  trackWrap: { marginTop: spacing["3xl"], alignItems: "center" },
  track: {
    width: TRACK_W, height: KNOB + 8, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", justifyContent: "center", paddingHorizontal: 4,
  },
  trackHint: { position: "absolute", alignSelf: "center", color: "rgba(255,255,255,0.7)", fontWeight: "700", letterSpacing: 0.5 },
  knob: {
    width: KNOB, height: KNOB, borderRadius: 999, backgroundColor: colors.error,
    alignItems: "center", justifyContent: "center",
  },
  pulse: { width: 128, height: 128, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  sentTitle: { color: colors.onError, fontSize: 32, fontWeight: "900" },
  sentSub: { color: "rgba(255,255,255,0.9)", textAlign: "center", marginTop: spacing.md, fontSize: type.lg, maxWidth: 300 },
  resolveBtn: {
    marginTop: spacing["3xl"], flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: 999,
  },
  resolveText: { color: colors.error, fontWeight: "800", fontSize: type.lg },
});
