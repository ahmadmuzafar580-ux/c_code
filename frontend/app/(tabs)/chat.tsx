import { useEffect, useRef, useState } from "react";
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "@/src/lib/store";
import { avatarForUser, colors, radius, spacing, type } from "@/src/lib/theme";

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatScreen() {
  const { messages, user, sendMessage } = useApp();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    const t = text.trim();
    setText("");
    setSending(true);
    try { await sendMessage(t); } catch { setText(t); }
    setSending(false);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="chat-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Family Chat</Text>
        <Text style={styles.subtitle}>Talk with everyone in your circle</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.user_id === user?.id;
            return (
              <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowOther]}>
                {!mine && (
                  <Image source={{ uri: avatarForUser(item.user_id) }} style={styles.msgAvatar} contentFit="cover" />
                )}
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                  {!mine && <Text style={styles.bubbleName}>{item.user_name}</Text>}
                  <Text style={[styles.bubbleText, mine && { color: colors.onBrandPrimary }]}>{item.text}</Text>
                  <Text style={[styles.bubbleTime, mine && { color: "rgba(255,255,255,0.7)" }]}>{fmtTime(item.created_at)}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty} testID="chat-empty">
              <Ionicons name="chatbubbles-outline" size={48} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>Start the conversation</Text>
            </View>
          }
        />
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message your family"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
              multiline
              maxLength={2000}
              testID="chat-input"
            />
          </View>
          <Pressable style={styles.sendBtn} onPress={send} disabled={!text.trim() || sending} testID="chat-send-button">
            <Ionicons name="send" size={18} color={colors.onBrandPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { fontSize: type["2xl"], color: colors.onSurface, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceTertiary, marginTop: 2, fontSize: type.sm },
  list: { padding: spacing.lg, paddingBottom: 200, gap: spacing.sm },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, marginTop: spacing.sm },
  msgRowMine: { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },
  msgAvatar: { width: 28, height: 28, borderRadius: 999 },
  bubble: { maxWidth: "78%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surfaceSecondary, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleName: { fontSize: 11, color: colors.brandPrimary, fontWeight: "700", marginBottom: 2 },
  bubbleText: { color: colors.onSurface, fontSize: type.lg },
  bubbleTime: { fontSize: 10, color: colors.onSurfaceTertiary, marginTop: 4, alignSelf: "flex-end" },
  empty: { alignItems: "center", padding: spacing["2xl"], gap: spacing.sm },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: type.lg },
  inputBar: {
    position: "absolute", left: spacing.lg, right: spacing.lg, bottom: 96,
    flexDirection: "row", alignItems: "flex-end", gap: spacing.sm,
  },
  inputWrap: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 6,
    minHeight: 44, justifyContent: "center",
  },
  input: { color: colors.onSurface, fontSize: type.lg, maxHeight: 100 },
  sendBtn: {
    width: 44, height: 44, borderRadius: 999, backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
});
