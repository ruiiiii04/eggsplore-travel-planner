import {
  Modal,
  Pressable,
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Button } from "./Button";
export function BottomSheet({
  visible,
  title,
  onClose,
  busy,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const dismiss = () => {
    if (!busy) onClose();
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismiss}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          accessibilityLabel="Close dialog"
          accessibilityRole="button"
          disabled={busy}
          onPress={dismiss}
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(25, 12, 35, 0.4)",
          }}
        />
        <SafeAreaView
          edges={["bottom", "left", "right"]}
          accessibilityViewIsModal
          className="w-full max-w-2xl self-center rounded-t-2xl bg-canvas"
          style={{ maxHeight: "90%" }}
        >
          <View className="flex-row items-center px-5 pt-3 gap-3">
            <Text
              accessibilityRole="header"
              className="flex-1 text-xl font-bold text-ink"
            >
              {title}
            </Text>
            <Button
              variant="ghost"
              accessibilityLabel="Close dialog"
              disabled={busy}
              onPress={dismiss}
            >
              <X color="#7E49C2" size={22} />
            </Button>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 16 }}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
