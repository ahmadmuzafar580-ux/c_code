import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator,
  ScrollView, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/src/lib/store";
import { colors, images, radius, spacing, type } from "@/src/lib/theme";

const { height: H } = Dimensions.get("window");

export default function LoginScreen() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email || !password) { setError("Please fill all fields"); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root} testID="login-screen">
      <View style={styles.hero}>
        <Image source={{ uri: images.onboardingFamily }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={200} />
        <LinearGradient colors={["rgba(28,28,30,0.15)", "rgba(247,247,246,1)"]} style={StyleSheet.absoluteFillObject} />
        <SafeAreaView edges={["top"]} style={styles.heroContent}>
          <View style={styles.logoRow}>
            <View style={styles.logoBadge}><Ionicons name="location" size={18} color={colors.onBrandPrimary} /></View>
            <Text style={styles.brand}>Famrak</Text>
          </View>
          <Text style={styles.tagline}>Stay close. Stay safe.</Text>
        </SafeAreaView>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.formWrap}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your family circle</Text>

          <View style={styles.field}>
            <Ionicons name="mail-outline" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              placeholder="Email"
              placeholderTextColor={colors.onSurfaceTertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              testID="login-email-input"
            />
          </View>
          <View style={styles.field}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              placeholder="Password"
              placeholderTextColor={colors.onSurfaceTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              testID="login-password-input"
            />
          </View>

          {error && <Text style={styles.error} testID="login-error">{error}</Text>}

          <Pressable style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]} onPress={submit} disabled={loading} testID="login-submit-button">
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Sign in</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>New here?</Text>
            <Link href="/(auth)/register" asChild>
              <Pressable testID="login-go-register"><Text style={styles.link}>Create an account</Text></Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: H * 0.38, backgroundColor: colors.brandTertiary, overflow: "hidden" },
  heroContent: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "flex-end", paddingBottom: spacing["2xl"] },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoBadge: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  brand: { color: colors.onSurfaceInverse, fontSize: 22, fontWeight: "800" },
  tagline: { color: colors.onSurfaceInverse, fontSize: type.lg, marginTop: spacing.sm, fontWeight: "500", opacity: 0.95 },
  formWrap: { flex: 1 },
  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing["2xl"] },
  title: { fontSize: type["2xl"], color: colors.onSurface, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceTertiary, marginTop: spacing.xs, marginBottom: spacing.xl, fontSize: type.base },
  field: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: spacing.sm, height: 52,
  },
  input: { flex: 1, color: colors.onSurface, fontSize: type.lg },
  cta: {
    height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginTop: spacing.md,
  },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: type.lg },
  error: { color: colors.error, marginTop: spacing.sm, fontSize: type.base },
  footer: { flexDirection: "row", justifyContent: "center", gap: spacing.xs, marginTop: spacing.xl },
  footerText: { color: colors.onSurfaceTertiary, fontSize: type.base },
  link: { color: colors.brandPrimary, fontWeight: "700", fontSize: type.base },
});
