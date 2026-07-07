import { useEffect, useRef, useState } from "react";
import {
  Animated, Easing, Pressable, StyleSheet, Text, View, Vibration, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { useApp } from "@/src/lib/store";
import { colors, radius, spacing, type } from "@/src/lib/theme";
import { getSosSoundMode, setSosSoundMode, SosSoundMode } from "@/src/lib/sos-prefs";

const HOLD_MS = 3000; // 3-second press requirement

export default function SOSScreen() {
  const { triggerSOS, resolveSOS, sos, locations, user, showToast } = useApp();
  const [sent, setSent] = useState<null | { id: string; user_name: string }>(null);
  const [holding, setHolding] = useState(false);
  const [soundMode, setSoundMode] = useState<SosSoundMode>("loud");
  const [muted, setMuted] = useState(false);

  const player = useAudioPlayer(require("../assets/sounds/siren.wav"));
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const holdAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const triggeredRef = useRef(false);
  const vibrationRef = useRef<any>(null);

  // Load user's sound preference
  useEffect(() => {
    (async () => { setSoundMode(await getSosSoundMode()); })();
  }, []);

  // Detect already-active SOS by self so re-opening screen resumes emergency mode
  useEffect(() => {
    const mine = sos.find((s) => s.user_id === user?.id && !s.resolved);
    if (mine) setSent({ id: mine.id, user_name: mine.user_name });
  }, [sos, user?.id]);

  // Configure looping player
  useEffect(() => {
    try { player.loop = true; player.volume = 1.0; } catch {}
  }, [player]);

  // Pulse animation while active
  useEffect(() => {
    if (sent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(0);
    }
  }, [sent, pulse]);

  const startAlarm = () => {
    if (muted) return;
    if (soundMode === "loud") {
      try { player.seekTo(0); } catch {}
      try { player.play(); } catch {}
      // Vibrate in parallel too (Android supports patterns; iOS uses each buzz)
      const pattern = Platform.OS === "android" ? [0, 500, 300, 500, 300] : [0, 500, 500];
      Vibration.vibrate(pattern, true);
    } else if (soundMode === "vibrate") {
      const pattern = Platform.OS === "android" ? [0, 700, 400] : [0, 700, 400];
      Vibration.vibrate(pattern, true);
    }
    // "silent" → no sound, no vibration
  };

  const stopAlarm = () => {
    try { player.pause(); } catch {}
    Vibration.cancel();
    if (vibrationRef.current) { clearInterval(vibrationRef.current); vibrationRef.current = null; }
  };

  useEffect(() => () => stopAlarm(), []); // cleanup on unmount // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-trigger alarm when sent state exists
  useEffect(() => {
    if (sent) startAlarm();
    else stopAlarm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sent, muted, soundMode]);

  const commitTrigger = async () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      const my = user ? locations[user.id] : undefined;
      const alert = await triggerSOS(my?.lat, my?.lng);
      setSent({ id: alert.id, user_name: alert.user_name });
      showToast("SOS sent to family");
    } catch (e: any) {
      triggeredRef.current = false;
      showToast(e?.message || "Failed to send SOS");
      Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  };

  const onHoldStart = () => {
    if (triggeredRef.current || sent) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Escalating haptic ticks during hold
    let ticks = 0;
    const tickInt = setInterval(() => {
      ticks += 1;
      if (ticks < 3) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 800);
    (vibrationRef as any).current = tickInt;
    holdAnimRef.current = Animated.timing(progress, {
      toValue: 1, duration: HOLD_MS, useNativeDriver: false, easing: Easing.linear,
    });
    holdAnimRef.current.start(({ finished }) => {
      if (finished && !triggeredRef.current) commitTrigger();
    });
  };

  const onHoldEnd = () => {
    if ((vibrationRef as any).current) { clearInterval((vibrationRef as any).current); (vibrationRef as any).current = null; }
    if (triggeredRef.current) return;
    setHolding(false);
    holdAnimRef.current?.stop();
    Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: false }).start();
  };

  const stopSOS = async () => {
    if (!sent) return;
    stopAlarm();
    triggeredRef.current = false;
    try { await resolveSOS(sent.id); } catch {}
    setSent(null);
    setHolding(false);
    progress.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const cycleSound = async () => {
    const order: SosSoundMode[] = ["loud", "vibrate", "silent"];
    const next = order[(order.indexOf(soundMode) + 1) % order.length];
    setSoundMode(next); await setSosSoundMode(next);
    if (sent) {
      // Restart alarm with new mode
      stopAlarm();
      setTimeout(startAlarm, 60);
    }
    Haptics.selectionAsync();
  };

  // ========== ACTIVE EMERGENCY MODE ==========
  if (sent) {
    const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
    const pulseOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
    return (
      <View style={[styles.root, { backgroundColor: colors.error }]} testID="sos-active-screen">
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
          <View style={styles.topBar}>
            <View style={styles.emergencyBadge} testID="sos-emergency-badge">
              <Ionicons name="warning" size={14} color={colors.onError} />
              <Text style={styles.emergencyBadgeText}>EMERGENCY MODE</Text>
            </View>
            <Pressable style={styles.iconBtnLight} onPress={cycleSound} testID="sos-sound-toggle">
              <Ionicons
                name={soundMode === "loud" ? "volume-high" : soundMode === "vibrate" ? "phone-portrait" : "volume-mute"}
                size={20} color={colors.onError}
              />
            </Pressable>
          </View>

          <View style={styles.center}>
            <View style={styles.pulseWrap}>
              <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOp }]} />
              <Animated.View style={[styles.pulseRing2, { transform: [{ scale: pulseScale }], opacity: pulseOp }]} />
              <View style={styles.warnBadge}>
                <Ionicons name="warning" size={64} color={colors.onError} />
              </View>
            </View>

            <Text style={styles.activeTitle}>SOS ACTIVE</Text>
            <Text style={styles.activeSub}>
              Your family is being notified with your live location.
              {"\n"}Alarm mode: <Text style={styles.modeText}>{modeLabel(soundMode)}</Text>
            </Text>

            <Pressable
              style={styles.stopBtn}
              onPress={stopSOS}
              testID="sos-stop-button"
            >
              <Ionicons name="stop-circle" size={22} color={colors.error} />
              <Text style={styles.stopText}>Stop SOS</Text>
            </Pressable>

            <Pressable style={styles.muteBtn} onPress={() => setMuted((m) => !m)} testID="sos-mute-button">
              <Ionicons name={muted ? "volume-mute" : "volume-high"} size={16} color={colors.onError} />
              <Text style={styles.muteText}>{muted ? "Sound muted" : "Mute sound"}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ========== IDLE (hold-to-activate) ==========
  const pctWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <View style={styles.root} testID="sos-screen">
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconBtnLight} testID="sos-close">
            <Ionicons name="close" size={22} color={colors.onSurfaceInverse} />
          </Pressable>
          <Pressable style={styles.iconBtnLight} onPress={cycleSound} testID="sos-sound-toggle-idle">
            <Ionicons
              name={soundMode === "loud" ? "volume-high" : soundMode === "vibrate" ? "phone-portrait" : "volume-mute"}
              size={20} color={colors.onSurfaceInverse}
            />
          </Pressable>
        </View>
        <View style={styles.center}>
          <View style={styles.warnBadge}>
            <Ionicons name="warning" size={48} color={colors.onError} />
          </View>
          <Text style={styles.title}>Emergency SOS</Text>
          <Text style={styles.sub}>
            Press and hold for 3 seconds to alert your family and start the alarm.
          </Text>

          <View style={styles.modeChips}>
            {(["loud", "vibrate", "silent"] as SosSoundMode[]).map((m) => (
              <Pressable
                key={m}
                style={[styles.modeChip, soundMode === m && styles.modeChipActive]}
                onPress={async () => { setSoundMode(m); await setSosSoundMode(m); Haptics.selectionAsync(); }}
                testID={`sos-mode-${m}`}
              >
                <Ionicons
                  name={m === "loud" ? "volume-high" : m === "vibrate" ? "phone-portrait" : "volume-mute"}
                  size={14} color={soundMode === m ? colors.onSurface : colors.onSurfaceInverse}
                />
                <Text style={[styles.modeChipText, soundMode === m && { color: colors.onSurface }]}>{modeLabel(m)}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={styles.holdBtn}
            onPressIn={onHoldStart}
            onPressOut={onHoldEnd}
            testID="sos-hold-button"
          >
            <Animated.View style={[styles.holdProgress, { width: pctWidth }]} />
            <View style={styles.holdContent}>
              <Ionicons name="warning" size={28} color={colors.onError} />
              <Text style={styles.holdText}>{holding ? "Keep holding…" : "HOLD FOR 3 SEC"}</Text>
            </View>
          </Pressable>

          <View style={styles.disclaimerRow}>
            <Ionicons name="shield-checkmark" size={14} color="rgba(255,255,255,0.65)" />
            <Text style={styles.disclaimer}>
              SOS alerts only approved family members. Famrak does not contact police or authorities.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function modeLabel(m: SosSoundMode) {
  return m === "loud" ? "Loud alarm" : m === "vibrate" ? "Vibrate only" : "Silent";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  iconBtnLight: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center",
  },
  emergencyBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: 999, backgroundColor: "rgba(0,0,0,0.35)",
  },
  emergencyBadgeText: { color: colors.onError, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  warnBadge: {
    width: 112, height: 112, borderRadius: 999, backgroundColor: colors.error,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.xl,
  },
  title: { color: colors.onSurfaceInverse, fontSize: 34, fontWeight: "900", letterSpacing: 0.5 },
  sub: { color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: spacing.md, fontSize: type.lg, maxWidth: 320 },
  modeChips: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl, flexWrap: "wrap", justifyContent: "center" },
  modeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  modeChipActive: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  modeChipText: { color: colors.onSurfaceInverse, fontWeight: "700", fontSize: type.sm },
  holdBtn: {
    marginTop: spacing["2xl"], width: "100%", maxWidth: 340, height: 84,
    borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.error,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.35)",
    shadowColor: colors.error, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  holdProgress: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.28)" },
  holdContent: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  holdText: { color: colors.onError, fontWeight: "900", fontSize: type.lg, letterSpacing: 1 },
  disclaimerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing["2xl"], maxWidth: 320 },
  disclaimer: { color: "rgba(255,255,255,0.65)", fontSize: type.sm, textAlign: "center", flex: 1 },
  // Active state
  pulseWrap: { width: 200, height: 200, alignItems: "center", justifyContent: "center", marginBottom: spacing.xl },
  pulseRing: {
    position: "absolute", width: 160, height: 160, borderRadius: 999,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.7)", backgroundColor: "rgba(255,255,255,0.15)",
  },
  pulseRing2: {
    position: "absolute", width: 200, height: 200, borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.5)",
  },
  activeTitle: { color: colors.onError, fontSize: 34, fontWeight: "900", letterSpacing: 1 },
  activeSub: { color: "rgba(255,255,255,0.92)", textAlign: "center", marginTop: spacing.md, fontSize: type.lg, maxWidth: 320 },
  modeText: { fontWeight: "800" },
  stopBtn: {
    marginTop: spacing["2xl"], flexDirection: "row", gap: spacing.sm, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderRadius: 999,
    minWidth: 220,
  },
  stopText: { color: colors.error, fontWeight: "900", fontSize: type.lg, letterSpacing: 0.5 },
  muteBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, padding: spacing.sm },
  muteText: { color: colors.onError, fontWeight: "600" },
});
