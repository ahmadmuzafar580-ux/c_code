import { useState } from "react";
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/src/lib/store";
import { colors, radius, spacing, type } from "@/src/lib/theme";

export default function RegisterScreen() {
  const { register } = useApp();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!name || !email || !password) { setError("Please fill all fields"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (!consent) { setError("Please accept the Privacy Policy and Terms to continue"); return; }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim(), consent);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="register-screen">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} testID="register-back-button">
              <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Join or start your family circle</Text>

          <View style={styles.field}>
            <Ionicons name="person-outline" size={18} color={colors.onSurfaceTertiary} />
            <TextInput placeholder="Your name" placeholderTextColor={colors.onSurfaceTertiary}
              value={name} onChangeText={setName} style={styles.input} testID="register-name-input" />
          </View>
          <View style={styles.field}>
            <Ionicons name="mail-outline" size={18} color={colors.onSurfaceTertiary} />
            <TextInput placeholder="Email" placeholderTextColor={colors.onSurfaceTertiary}
              value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
              style={styles.input} testID="register-email-input" />
          </View>
          <View style={styles.field}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.onSurfaceTertiary} />
            <TextInput placeholder="Password (min 6 chars)" placeholderTextColor={colors.onSurfaceTertiary}
              value={password} onChangeText={setPassword} secureTextEntry
              style={styles.input} testID="register-password-input" />
          </View>

          {error && <Text style={styles.error} testID="register-error">{error}</Text>}

          <Pressable
            style={styles.consentRow}
            onPress={() => setConsent((v) => !v)}
            testID="register-consent-toggle"
          >
            <View style={[styles.checkbox, consent && styles.checkboxOn]}>
              {consent && <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} />}
            </View>
            <Text style={styles.consentText}>
              I agree to the{" "}
              <Text style={styles.consentLink} onPress={() => router.push("/privacy")}>Privacy Policy</Text>
              {" "}and{" "}
              <Text style={styles.consentLink} onPress={() => router.push("/terms")}>Terms</Text>.
              My location is only shared with family members I approve.
            </Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]} onPress={submit} disabled={loading} testID="register-submit-button">
            {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Create account</Text>}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <Pressable testID="register-go-login"><Text style={styles.link}>Sign in</Text></Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  form: { padding: spacing.xl, paddingBottom: spacing["2xl"] },
  header: { flexDirection: "row", marginBottom: spacing.lg },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border,
  },
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
  consentRow: {
    flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm,
    padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  consentText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: type.sm, lineHeight: 18 },
  consentLink: { color: colors.brandPrimary, fontWeight: "700", textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "center", gap: spacing.xs, marginTop: spacing.xl },
  footerText: { color: colors.onSurfaceTertiary, fontSize: type.base },
  link: { color: colors.brandPrimary, fontWeight: "700", fontSize: type.base },
});
