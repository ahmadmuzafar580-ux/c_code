import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StyleSheet, View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AppProvider, useApp } from "@/src/lib/store";
import { colors } from "@/src/lib/theme";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function ToastBar() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={styles.toastWrap} testID="global-toast">
      <View style={styles.toast}>
        <Text style={styles.toastText}>{toast}</Text>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="invite" options={{ presentation: "modal" }} />
            <Stack.Screen name="family-requests" options={{ presentation: "modal" }} />
            <Stack.Screen name="privacy" options={{ presentation: "modal" }} />
            <Stack.Screen name="terms" options={{ presentation: "modal" }} />
            <Stack.Screen name="sos" options={{ presentation: "fullScreenModal", animation: "fade" }} />
            <Stack.Screen name="add-place" options={{ presentation: "modal" }} />
            <Stack.Screen name="places-list" />
            <Stack.Screen name="history" options={{ presentation: "modal" }} />
          </Stack>
          <ToastBar />
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: "absolute", top: 60, left: 0, right: 0, alignItems: "center", zIndex: 10000,
  },
  toast: {
    backgroundColor: colors.surfaceInverse, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  toastText: { color: colors.onSurfaceInverse, fontSize: 14, fontWeight: "600" },
});
