import { useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import FamMap, { MapCircle, MapMarker } from "@/src/components/FamMap";
import { useApp } from "@/src/lib/store";
import { colors, radius, spacing, type } from "@/src/lib/theme";

const DEFAULT_COORDS = { lat: 37.7749, lng: -122.4194 };
const RADIUS_OPTIONS = [100, 150, 250, 500];
const ICON_OPTIONS: { key: string; label: string; icon: any }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "school", label: "School", icon: "school" },
  { key: "work", label: "Work", icon: "briefcase" },
  { key: "park", label: "Park", icon: "leaf" },
];

export default function AddPlaceScreen() {
  const { user, locations, addPlace, showToast } = useApp();
  const my = user ? locations[user.id] : undefined;
  const initial = my ? { lat: my.lat, lng: my.lng } : DEFAULT_COORDS;

  const [coord, setCoord] = useState<{ lat: number; lng: number }>(initial);
  const [name, setName] = useState("");
  const [radiusM, setRadiusM] = useState(150);
  const [icon, setIcon] = useState("home");
  const [saving, setSaving] = useState(false);

  const markers: MapMarker[] = useMemo(() => [{
    id: "pick", lat: coord.lat, lng: coord.lng, label: name || "New place",
  }], [coord, name]);
  const circles: MapCircle[] = useMemo(() => [{
    id: "r", lat: coord.lat, lng: coord.lng, radius: radiusM, color: colors.brandPrimary,
  }], [coord, radiusM]);

  const save = async () => {
    if (!name.trim()) { showToast("Please name this place"); return; }
    setSaving(true);
    try {
      await addPlace({ name: name.trim(), lat: coord.lat, lng: coord.lng, radius: radiusM, icon });
      showToast("Place added");
      router.back();
    } catch (e: any) {
      showToast(e?.message || "Could not save");
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="add-place-screen">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="add-place-close">
          <Ionicons name="close" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>New place</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.mapWrap}>
        <FamMap center={coord} zoom={14} markers={markers} circles={circles} onMapTap={(c) => setCoord(c)} />
        <View style={styles.mapHint} pointerEvents="none">
          <Ionicons name="hand-left" size={14} color={colors.onSurface} />
          <Text style={styles.mapHintText}>Tap the map to move the place</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Name</Text>
          <View style={styles.field}>
            <Ionicons name="pricetag-outline" size={18} color={colors.onSurfaceTertiary} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Home"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
              testID="add-place-name-input"
            />
          </View>

          <Text style={styles.label}>Type</Text>
          <View style={styles.chipsRow}>
            {ICON_OPTIONS.map((o) => (
              <Pressable
                key={o.key}
                style={[styles.chip, icon === o.key && styles.chipActive]}
                onPress={() => setIcon(o.key)}
                testID={`add-place-icon-${o.key}`}
              >
                <Ionicons name={o.icon} size={16} color={icon === o.key ? colors.onBrandPrimary : colors.onSurface} />
                <Text style={[styles.chipText, icon === o.key && { color: colors.onBrandPrimary }]}>{o.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Radius</Text>
          <View style={styles.chipsRow}>
            {RADIUS_OPTIONS.map((r) => (
              <Pressable
                key={r}
                style={[styles.chip, radiusM === r && styles.chipActive]}
                onPress={() => setRadiusM(r)}
                testID={`add-place-radius-${r}`}
              >
                <Text style={[styles.chipText, radiusM === r && { color: colors.onBrandPrimary }]}>{r} m</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.cta} onPress={save} disabled={saving} testID="add-place-save-button">
            {saving ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Save place</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { fontSize: type.xl, fontWeight: "800", color: colors.onSurface },
  mapWrap: { height: 260, marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  mapHint: { position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  mapHintText: { color: colors.onSurface, fontSize: type.sm, fontWeight: "600" },
  form: { padding: spacing.lg, paddingBottom: spacing["2xl"], gap: spacing.sm },
  label: { color: colors.onSurfaceTertiary, marginTop: spacing.md, fontWeight: "700", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.5 },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, height: 52 },
  input: { flex: 1, color: colors.onSurface, fontSize: type.lg },
  chipsRow: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 999, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurface, fontWeight: "600" },
  cta: { height: 54, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginTop: spacing.lg },
  ctaText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: type.lg },
});
