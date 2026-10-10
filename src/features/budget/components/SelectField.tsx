import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/ui";

export type SelectOption = { id: string; label: string };

type Props = {
  label: string;
  value: SelectOption | null;
  options: SelectOption[];
  onChange: (option: SelectOption) => void;
  placeholder?: string;
};

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Select",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-full border border-line bg-lavender px-3 py-1.5"
      >
        <Text className="text-xs font-semibold text-brand">
          {value ? value.label : placeholder}
        </Text>
        <Text className="text-xs text-brand ml-1">▾</Text>
      </Pressable>

      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View className="gap-1">
          {options.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`rounded-lg px-4 py-3 ${
                value?.id === option.id ? "bg-lavender" : ""
              }`}
            >
              <Text
                className={`text-base ${
                  value?.id === option.id
                    ? "text-brand font-semibold"
                    : "text-ink"
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}