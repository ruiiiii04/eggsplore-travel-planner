import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";

export const tripColors = {
  purple: "#7C4DBE",
  dark: "#3B1454",
  muted: "#817493",
  canvas: "#FBF9FC",
  lavender: "#F4EEFC",
  line: "#E8DDF3",
  white: "#FFFFFF",
  green: "#3A9B73",
};

const steps = ["Trip Type", "Details", "Preferences", "Invite"];

export function WizardFrame({
  step,
  children,
  footer,
  onBack,
}: {
  step: number;
  children: ReactNode;
  footer: ReactNode;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack ?? (() => router.back())} style={styles.back}>
          <ArrowLeft size={22} color={tripColors.dark} />
        </Pressable>
        <Text style={styles.headerTitle}>Create Trip</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.stepper}>
        {steps.map((label, index) => {
          const number = index + 1;
          const active = number === step;
          const complete = number < step;
          return (
            <View key={label} style={styles.stepItem}>
              <View style={[styles.stepDot, (active || complete) && styles.stepDotActive]}>
                {complete ? <Check size={12} color="white" strokeWidth={3} /> : <Text style={[styles.stepNumber, (active || complete) && styles.whiteText]}>{number}</Text>}
              </View>
              <Text numberOfLines={1} style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
              {index < steps.length - 1 && <View style={[styles.stepLine, number < step && styles.stepLineActive]} />}
            </View>
          );
        })}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {children}
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  );
}

export function TitleBlock({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

export function ChoiceCard({
  selected,
  onPress,
  icon,
  title,
  description,
  style,
}: {
  selected: boolean;
  onPress: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  style?: object;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.choice, selected && styles.choiceSelected, style]}>
      <View style={[styles.choiceIcon, selected && styles.choiceIconSelected]}>{icon}</View>
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={styles.choiceDescription}>{description}</Text>
      {selected && <View style={styles.selectedCheck}><Check size={13} color="white" strokeWidth={3} /></View>}
    </Pressable>
  );
}

export const uiStyles = StyleSheet.create({
  card: { backgroundColor: tripColors.white, borderRadius: 20, borderWidth: 1, borderColor: tripColors.line, padding: 16 },
  label: { color: tripColors.dark, fontFamily: "Inter", fontSize: 13, fontWeight: "700", marginBottom: 8 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: tripColors.line, backgroundColor: "#FFFEFF", paddingHorizontal: 15, color: tripColors.dark, fontFamily: "Inter", fontSize: 15 },
  small: { color: tripColors.muted, fontFamily: "Inter", fontSize: 12, lineHeight: 18 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: tripColors.canvas },
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: tripColors.dark, fontFamily: "Fredoka", fontSize: 26 },
  stepper: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  stepItem: { flex: 1, alignItems: "center", position: "relative" },
  stepDot: { width: 32, height: 32, borderRadius: 17, borderWidth: 1.5, borderColor: "#E8DDF3", backgroundColor: "#F0EAF7", alignItems: "center", justifyContent: "center", zIndex: 1 },
  stepDotActive: { borderColor: tripColors.purple, backgroundColor: tripColors.purple },
  stepNumber: { fontFamily: "Inter", fontSize: 12, fontWeight: "700", color: tripColors.muted },
  whiteText: { color: "white" },
  stepLabel: { color: "#897A98", fontFamily: "Inter", fontSize: 11, marginTop: 6 },
  stepLabelActive: { color: tripColors.purple, fontWeight: "700" },
  stepLine: { position: "absolute", height: 1.5, backgroundColor: "#E4D9ED", left: "58%", right: "-42%", top: 15 },
  stepLineActive: { backgroundColor: "#C4A7E4" },
  content: { paddingHorizontal: 20, paddingTop: 7, paddingBottom: 20, gap: 14 },
  footer: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 10, backgroundColor: tripColors.canvas },
  titleBlock: { gap: 5, marginBottom: 1 },
  title: { color: tripColors.dark, fontFamily: "Fredoka", fontSize: 26, lineHeight: 32, fontWeight: "700" },
  subtitle: { color: tripColors.muted, fontFamily: "Inter", fontSize: 13, lineHeight: 19 },
  choice: { flex: 1, minHeight: 164, backgroundColor: tripColors.white, borderRadius: 20, borderWidth: 1.5, borderColor: tripColors.line, alignItems: "center", justifyContent: "center", padding: 14, gap: 7, position: "relative" },
  choiceSelected: { borderColor: tripColors.purple, backgroundColor: "#FCFAFF" },
  choiceIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: tripColors.lavender, alignItems: "center", justifyContent: "center" },
  choiceIconSelected: { backgroundColor: "#ECE0FA" },
  choiceTitle: { color: tripColors.dark, fontFamily: "Fredoka", fontSize: 18 },
  choiceDescription: { color: tripColors.muted, fontFamily: "Inter", fontSize: 11, textAlign: "center", lineHeight: 16 },
  selectedCheck: { position: "absolute", top: 10, right: 10, width: 21, height: 21, borderRadius: 11, backgroundColor: tripColors.purple, alignItems: "center", justifyContent: "center" },
});
