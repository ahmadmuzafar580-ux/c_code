import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius, spacing, type } from "@/src/lib/theme";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "map",
  family: "people",
  chat: "chatbubbles",
  settings: "settings-outline",
};

const LABELS: Record<string, string> = {
  index: "Map",
  family: "Family",
  chat: "Chat",
  settings: "Settings",
};

function FloatingTabBar({ state, descriptors, navigation }: any) {
  return (
    <View pointerEvents="box-none" style={styles.wrap} testID="floating-tab-bar">
      <View style={styles.shell}>
        <BlurView intensity={Platform.OS === "ios" ? 60 : 80} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.overlay} />
        <View style={styles.tabsRow}>
          {state.routes.map((route: any, index: number) => {
            const focused = state.index === index;
            const iconName = ICONS[route.name] || "ellipse";
            const label = LABELS[route.name] || route.name;
            const onPress = () => {
              Haptics.selectionAsync();
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={styles.tabBtn}
                testID={`tab-${route.name}`}
                accessibilityRole="button"
              >
                <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                  <Ionicons name={iconName} size={20} color={focused ? colors.onBrandPrimary : colors.onSurface} />
                </View>
                <Text style={[styles.tabLabel, focused && { color: colors.brandPrimary, fontWeight: "700" }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Map" }} />
      <Tabs.Screen name="family" options={{ title: "Family" }} />
      <Tabs.Screen name="chat" options={{ title: "Chat" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", bottom: Platform.OS === "ios" ? 24 : 16, left: 20, right: 20,
  },
  shell: {
    height: 68, borderRadius: radius.pill, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.6)",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.35)" },
  tabsRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: spacing.sm },
  tabBtn: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: spacing.xs },
  iconWrap: { width: 40, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  iconWrapActive: { backgroundColor: colors.brandPrimary },
  tabLabel: { fontSize: type.sm, color: colors.onSurfaceTertiary },
});
