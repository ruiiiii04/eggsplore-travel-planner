import { useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
export function Field({
  label,
  secureTextEntry,
  style,
  ...props
}: TextInputProps & { label: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View className="gap-2">
      <Text
        style={{ fontFamily: "Inter" }}
        className="text-sm font-semibold text-ink"
      >
        {label}
      </Text>
      <View className="relative">
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#A99AC6"
          autoCapitalize="sentences"
          {...props}
          secureTextEntry={secureTextEntry && !visible}
          style={[
            { fontFamily: "Inter", paddingRight: secureTextEntry ? 56 : 16 },
            style,
          ]}
          className="min-h-12 rounded-xl border border-line bg-white px-4 py-3 text-base text-ink"
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              (visible ? "Hide " : "Show ") + label.toLowerCase()
            }
            accessibilityState={{ disabled: props.editable === false }}
            disabled={props.editable === false}
            onPress={() => setVisible((previous) => !previous)}
            style={{
              position: "absolute",
              right: 4,
              top: 0,
              bottom: 0,
              width: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {visible ? (
              <EyeOff size={20} color="#7C4DBE" />
            ) : (
              <Eye size={20} color="#7C4DBE" />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}
