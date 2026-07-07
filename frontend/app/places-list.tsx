import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/src/lib/store";
import { colors, images, radius, spacing, type } from "@/src/lib/theme";

function pickImage(icon?: string | null, idx: number = 0) {
  const list = [images.placeHome, images.placeSchool];
  if (icon === "school") return images.placeSchool;
  if (icon === "home") return images.placeHome;
  return list[idx % list.length];
}

export default function PlacesListScreen() {
  const { places, deletePlace } = useApp();

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="places-list-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="places-back">
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Places</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={places}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160, gap: spacing.md }}
        renderItem={({ item, index }) => (
          <View style={styles.card} testID={`place-card-${item.id}`}>
            <Image source={{ uri: pickImage(item.icon, index) }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            <LinearGradient colors={["rgba(0,0,0,0.05)", "rgba(28,28,30,0.85)"]} style={StyleSheet.absoluteFillObject} />
            <View style={styles.cardBody}>
              <View style={styles.iconBadge}>
                <Ionicons name={item.icon === "school" ? "school" : "home"} size={16} color={colors.onBrandPrimary} />
              </View>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>Radius {Math.round(item.radius)}m</Text>
            </View>
            <Pressable
              style={styles.deleteBtn}
              onPress={() => deletePlace(item.id)}
              testID={`place-delete-${item.id}`}
            >
              <Ionicons name="trash-outline" size={16} color={colors.onError} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Image source={{ uri: images.emptyHistory }} style={styles.emptyImg} contentFit="cover" />
            <Text style={styles.emptyTitle}>No safe zones yet</Text>
            <Text style={styles.emptySub}>Add places like Home or School to get arrival & departure alerts.</Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Pressable style={styles.cta} onPress={() => router.push("/add-place")} testID="places-add-button">
          <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
          <Text style={styles.ctaText}>Add place</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface },
  card: {
    height: 180, borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end",
    backgroundColor: colors.surfaceTertiary,
  },
  cardBody: { padding: spacing.lg, gap: 4 },
  iconBadge: { width: 32, height: 32, borderRadius: 999, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  cardName: { color: "#FFFFFF", fontSize: type.xl, fontWeight: "800", marginTop: spacing.sm },
  cardMeta: { color: "rgba(255,255,255,0.85)", fontSize: type.sm },
  deleteBtn: {
    position: "absolute", top: spacing.md, right: spacing.md,
    width: 36, height: 36, borderRadius: 999, backgroundColor: colors.error,
    alignItems: "center", justifyContent: "center",
  },
  empty: { alignItems: "center", padding: spacing["2xl"], gap: spacing.sm },
  emptyImg: { width: 120, height: 120, borderRadius: radius.lg, marginBottom: spacing.md, opacity: 0.6 },
  emptyTitle: { color: colors.onSurface, fontWeight: "700", fontSize: type.lg },
  emptySub: { color: colors.onSurfaceTertiary, textAlign: "center", maxWidth: 280 },
  footer: { position: "absolute", bottom: 96, left: spacing.lg, right: spacing.lg },
  cta: {
    height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm,
  },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: type.lg },
});
