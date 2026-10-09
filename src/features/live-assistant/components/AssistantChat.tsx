// NEW: selected-place chat. History stays in memory while this dialog is open.
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Send, Sparkles, X, RotateCcw } from "lucide-react-native";
import { askAssistant, recentHistory } from "../services/api";
import type { AssistantReply, ChatMessage, SamplePlace } from "../types";

type DisplayMessage = ChatMessage & {
  sources?: AssistantReply["sources"];
  truncated?: boolean;
};
export default function AssistantChat({
  place,
  onClose,
}: {
  place: SamplePlace;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollView>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current?.abort();
    };
  }, []);
  const openSource = (url: string) => {
    setLinkError(false);
    void Linking.openURL(url).catch(() => setLinkError(true));
  };
  async function send(value = draft) {
    const question = value.trim();
    if (!question || question.length > 1500 || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    setPending(question);
    setDraft(question);
    const timer = setTimeout(() => controller.abort(), 110_000);
    try {
      const reply = await askAssistant(
        place.id,
        question,
        recentHistory(messages),
        controller.signal,
      );
      if (!alive.current || controller.signal.aborted) return;
      setMessages((previous) => [
        ...previous,
        { role: "user", text: question },
        {
          role: "assistant",
          text: reply.answer,
          sources: reply.sources,
          truncated: reply.truncated,
        },
      ]);
      setDraft("");
    } catch (cause) {
      if (alive.current)
        setError(
          controller.signal.aborted
            ? "The request timed out. You can retry your question."
            : cause instanceof Error
              ? cause.message
              : "Could not send your question.",
        );
    } finally {
      clearTimeout(timer);
      request.current = null;
      if (alive.current) {
        setBusy(false);
        setPending(null);
      }
    }
  }
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaProvider style={s.fill}>
        <SafeAreaView style={s.screen}>
          <KeyboardAvoidingView
            style={s.fill}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={s.header}>
              <Sparkles size={23} color="#7E49C2" />
              <View style={s.fill}>
                <Text style={s.title}>Ask AI</Text>
                <Text style={s.subtitle}>{place.name}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Close AI chat"
                onPress={onClose}
                style={s.iconButton}
              >
                <X color="#7E49C2" size={24} />
              </TouchableOpacity>
            </View>
            <Text style={s.disclosure}>
              AI suggestions may be inaccurate. No live opening hours, weather or
              flight data. Messages are sent to Google; avoid sensitive personal
              information.
            </Text>
            <ScrollView
              ref={scroll}
              style={s.fill}
              contentContainerStyle={s.messages}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                scroll.current?.scrollToEnd({ animated: true })
              }
            >
              {messages.length === 0 && !busy && (
                <View style={s.intro}>
                  <Text style={s.introText}>
                    What would you like to know about {place.name}?
                  </Text>
                  {[
                    "What is this place known for?",
                    "What should I consider before visiting?",
                    "How could I include this in a relaxed day?",
                  ].map((text) => (
                    <TouchableOpacity
                      key={text}
                      accessibilityRole="button"
                      style={s.suggestion}
                      onPress={() => void send(text)}
                    >
                      <Text style={s.suggestionText}>{text}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {messages.map((message, index) => (
                <View
                  key={index}
                  style={[
                    s.bubble,
                    message.role === "user" ? s.user : s.assistant,
                  ]}
                >
                  <Text style={s.role}>
                    {message.role === "user" ? "You" : "Gemini"}
                  </Text>
                  <Text selectable style={s.message}>
                    {message.text}
                  </Text>
                  {message.truncated && (
                    <Text style={s.note}>
                      Response shortened. Ask a follow-up for more detail.
                    </Text>
                  )}
                  {!!message.sources?.length && (
                    <Text style={s.note}>
                      Reference supplied to the assistant:
                    </Text>
                  )}
                  {message.sources?.map((source) => (
                    <TouchableOpacity
                      key={source.url}
                      accessibilityRole="link"
                      onPress={() => openSource(source.url)}
                    >
                      <Text style={s.link}>{source.title} · Wikipedia</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              {busy && (
                <View style={s.bubble}>
                  <Text style={s.message}>{pending}</Text>
                  <View style={s.busy}>
                    <ActivityIndicator color="#7E49C2" />
                    <Text style={s.note}>Thinking…</Text>
                  </View>
                </View>
              )}
            </ScrollView>
            {linkError && (
              <Text style={s.error}>Could not open the source link.</Text>
            )}
            {error && (
              <View style={s.errorBox}>
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={s.retry}
                  onPress={() => void send()}
                >
                  <RotateCcw size={16} color="#7E49C2" />
                  <Text style={s.link}>Retry question</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={s.composer}>
              <TextInput
                style={s.input}
                multiline
                maxLength={1500}
                value={draft}
                onChangeText={setDraft}
                editable={!busy}
                placeholder="Ask about this place…"
                placeholderTextColor="#8A789D"
                accessibilityLabel="Your question"
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Send question"
                accessibilityState={{ disabled: busy || !draft.trim() }}
                disabled={busy || !draft.trim()}
                onPress={() => void send()}
                style={[s.send, (busy || !draft.trim()) && s.disabled]}
              >
                <Send size={21} color="white" />
              </TouchableOpacity>
            </View>
            <Text style={s.footer}>
              Closing this chat clears its conversation.
            </Text>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAF7FF" },
  fill: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 10 },
  title: { fontSize: 21, fontWeight: "700", color: "#4E2867" },
  subtitle: { color: "#817493", fontSize: 13 },
  iconButton: { padding: 10 },
  disclosure: {
    marginHorizontal: 16,
    marginBottom: 8,
    color: "#817493",
    fontSize: 11,
    lineHeight: 16,
  },
  messages: { padding: 16, gap: 12 },
  intro: { gap: 12 },
  introText: { color: "#4E2867", fontSize: 17, lineHeight: 24 },
  suggestion: {
    borderWidth: 1,
    borderColor: "#D7BDED",
    padding: 14,
    borderRadius: 16,
    backgroundColor: "white",
  },
  suggestionText: { color: "#7E49C2", fontSize: 14 },
  bubble: {
    padding: 14,
    borderRadius: 18,
    gap: 7,
    maxWidth: "95%",
    backgroundColor: "#F0E6FB",
  },
  user: { alignSelf: "flex-end", backgroundColor: "#E9DCF5" },
  assistant: { alignSelf: "flex-start", backgroundColor: "white" },
  role: { color: "#7E49C2", fontSize: 11, fontWeight: "700" },
  message: { fontSize: 15, lineHeight: 23, color: "#4E2867" },
  note: { color: "#817493", fontSize: 11, lineHeight: 16 },
  link: {
    color: "#7E49C2",
    fontSize: 12,
    textDecorationLine: "underline",
    paddingVertical: 5,
  },
  busy: { flexDirection: "row", gap: 8, alignItems: "center" },
  errorBox: { paddingHorizontal: 16, gap: 4 },
  error: { color: "#9F254B", fontSize: 13, lineHeight: 19 },
  retry: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 },
  composer: {
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#D7BDED",
    borderRadius: 18,
    padding: 12,
    color: "#4E2867",
    backgroundColor: "white",
    fontSize: 15,
  },
  send: {
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: "#7E49C2",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  footer: {
    textAlign: "center",
    fontSize: 10,
    color: "#817493",
    paddingBottom: 6,
  },
});
