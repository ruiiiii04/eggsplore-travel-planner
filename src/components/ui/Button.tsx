import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from "react-native";
import type { ReactNode } from "react";
type Props = Omit<PressableProps, "children"> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
  className?: string;
};
export function Button({
  children,
  variant = "primary",
  busy,
  disabled,
  className = "",
  accessibilityState,
  ...props
}: Props) {
  const solid = variant === "primary" || variant === "danger";
  const background =
    variant === "primary"
      ? "bg-brand"
      : variant === "danger"
        ? "bg-danger"
        : variant === "secondary"
          ? "bg-lavender"
          : "";
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{
        ...accessibilityState,
        disabled: !!(disabled || busy),
        busy: !!busy,
      }}
      disabled={disabled || busy}
      className={`min-h-12 rounded-lg px-4 py-3 flex-row items-center justify-center gap-2 ${background} ${disabled || busy ? "opacity-50" : "active:opacity-75"} ${className}`}
    >
      {busy && <ActivityIndicator color={solid ? "white" : "#7C4DBE"} />}
      {typeof children === "string" ? (
        <Text
          style={{ fontFamily: "Inter" }}
          className={`text-base font-semibold text-center ${solid ? "text-white" : "text-brand"}`}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
