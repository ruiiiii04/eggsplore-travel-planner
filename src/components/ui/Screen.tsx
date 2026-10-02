import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ReactNode } from "react";
export function Screen({ children, ...props }: ScrollViewProps) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} className="flex-1 bg-canvas">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          {...props}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            padding: 20,
            paddingBottom: 32,
          }}
        >
          <View className="w-full max-w-2xl self-center gap-5">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" className="text-2xl font-bold text-ink">
      {children}
    </Text>
  );
}
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" className="text-lg font-bold text-ink">
      {children}
    </Text>
  );
}
export function Message({
  children,
  error = false,
}: {
  children?: ReactNode;
  error?: boolean;
}) {
  if (!children) return null;
  return (
    <Text
      accessibilityRole={error ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      className={`text-sm leading-6 ${error ? "text-danger" : "text-muted"}`}
    >
      {children}
    </Text>
  );
}
export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-canvas p-8">
      <ActivityIndicator
        size="large"
        color="#7C4DBE"
        accessibilityLabel="Loading"
      />
    </View>
  );
}
