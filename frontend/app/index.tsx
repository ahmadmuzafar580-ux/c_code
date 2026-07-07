import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useApp } from "@/src/lib/store";
import { colors } from "@/src/lib/theme";

export default function Index() {
  const { ready, user } = useApp();
  if (!ready) {
    return (
      <View style={styles.center} testID="boot-loading">
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!user.family_id) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
});
