import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, radius, spacing, type } from "@/src/lib/theme";

export default function TermsScreen() {
  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="terms-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="terms-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Terms of Service</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h2}>By using Famrak you agree to the following.</Text>

        <Text style={styles.h3}>1. Account & consent</Text>
        <Text style={styles.p}>
          You must create your own account with a valid email. Location sharing only starts after
          you accept these Terms and the Privacy Policy at sign-up, and after a family owner
          approves your join request.
        </Text>

        <Text style={styles.h3}>2. Family safety only</Text>
        <Text style={styles.p}>
          Famrak is designed for consenting family members to see one another for safety. You must
          NOT use Famrak to track any person without their knowledge and approval, or to stalk,
          harass, or violate the privacy of others.
        </Text>

        <Text style={styles.h3}>3. Not an emergency service</Text>
        <Text style={styles.p}>
          The SOS feature notifies your approved family members with your live location. Famrak is
          NOT connected to police, fire, medical, or any government or emergency service. If you
          need professional emergency help, call your local emergency number.
        </Text>

        <Text style={styles.h3}>4. Location accuracy</Text>
        <Text style={styles.p}>
          Location data depends on your device{"'"}s GPS, network signal, and OS permissions. We use
          the highest accuracy available but cannot guarantee precision at all times.
        </Text>

        <Text style={styles.h3}>5. Your data, your control</Text>
        <Text style={styles.p}>
          You may pause sharing, clear history, leave a family, or delete your account at any
          time from Settings. Deleting your account permanently erases your data from our
          systems.
        </Text>

        <Text style={styles.h3}>6. Family owner responsibilities</Text>
        <Text style={styles.p}>
          If you create a family, you are responsible for who you approve. Only approve people you
          actually know and trust to share location with.
        </Text>

        <Text style={styles.h3}>7. Acceptable use</Text>
        <Text style={styles.p}>
          You may not attempt to reverse-engineer, abuse, or circumvent security controls, or use
          Famrak for anything illegal or harmful.
        </Text>

        <Text style={styles.h3}>8. Changes</Text>
        <Text style={styles.p}>We may update these Terms; we will notify you inside the app before material changes take effect.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface },
  body: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  h2: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  h3: { fontSize: type.lg, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.sm },
  p: { color: colors.onSurfaceSecondary, fontSize: type.base, lineHeight: 22, marginBottom: spacing.xs },
});
