import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, radius, spacing, type } from "@/src/lib/theme";

export default function PrivacyScreen() {
  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="privacy-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="privacy-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h2}>Famrak is a family safety app, not a surveillance tool.</Text>
        <Text style={styles.p}>
          We only collect what is strictly necessary to help family members stay connected. You are
          always in control.
        </Text>

        <Text style={styles.h3}>What we collect</Text>
        <Text style={styles.p}>• Your account (name, email, hashed password).</Text>
        <Text style={styles.p}>• Your device location, only while you have location sharing turned ON.</Text>
        <Text style={styles.p}>• Messages, check-ins, and SOS alerts you create.</Text>

        <Text style={styles.h3}>Who can see it</Text>
        <Text style={styles.p}>
          Only the family members you have approved. Nobody else — not other Famrak users,
          not advertisers, not the public. Famrak never sells your data.
        </Text>

        <Text style={styles.h3}>You are in control</Text>
        <Text style={styles.p}>• Toggle location sharing ON/OFF at any time in Settings.</Text>
        <Text style={styles.p}>• Clear your entire location history with one tap.</Text>
        <Text style={styles.p}>• Leave the family — your location stops broadcasting immediately.</Text>
        <Text style={styles.p}>• Delete your account and every trace of your data.</Text>

        <Text style={styles.h3}>No hidden tracking</Text>
        <Text style={styles.p}>
          Nobody can be tracked without their own account and explicit approval from the family
          owner. Famrak will never track a person by phone number, contacts, or without them
          installing and agreeing to share.
        </Text>

        <Text style={styles.h3}>SOS is family-only</Text>
        <Text style={styles.p}>
          SOS alerts your approved family members with your live location. Famrak does NOT
          contact police, emergency services, or any authority automatically. If you need
          professional help, please call your local emergency number.
        </Text>

        <Text style={styles.h3}>Security</Text>
        <Text style={styles.p}>
          Passwords are hashed with bcrypt. Sessions use signed JWT tokens stored in your device{"'"}s
          secure keystore. Location data is transmitted over HTTPS.
        </Text>

        <Text style={styles.h3}>Questions?</Text>
        <Text style={styles.p}>Reach out to your family owner or contact us in-app. You can request account deletion at any time.</Text>
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
