import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { BottomSheet, Button } from "@/components/ui";
import { calendarCells } from "./detailsModel";
const purple = "#8050C5";
export function CalendarDateField({
  label,
  value,
  onChange,
  minimum,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimum?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(value);
  function show() {
    const initial = value || minimum;
    setMonth(initial ? new Date(initial + "T12:00:00") : new Date());
    setSelected(value);
    setOpen(true);
  }
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: "#857695",
          fontFamily: "Inter",
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label + " date: " + (value || "Choose date")}
        onPress={show}
        style={{
          minHeight: 44,
          paddingHorizontal: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#E8DDF3",
          backgroundColor: "white",
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Text
          style={{
            flex: 1,
            fontFamily: "Inter",
            fontSize: 12,
            color: value ? "#31145B" : "#796C87",
          }}
        >
          {value || "Choose date"}
        </Text>
        <CalendarDays size={17} color={purple} />
      </Pressable>
      <BottomSheet
        visible={open}
        title={label === "From" ? "Departure date" : "Return date"}
        onClose={() => setOpen(false)}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            style={{ padding: 12 }}
          >
            <ChevronLeft color={purple} size={22} />
          </Pressable>
          <Text
            style={{ fontFamily: "Inter", color: "#31145B", fontWeight: "700" }}
          >
            {month.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            style={{ padding: 12 }}
          >
            <ChevronRight color={purple} size={22} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row" }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <Text
              key={day}
              style={{
                width: "14.2857%",
                textAlign: "center",
                color: "#857695",
                fontSize: 11,
              }}
            >
              {day}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {calendarCells(month.getFullYear(), month.getMonth()).map(
            (date, i) => {
              const disabled = !date || (!!minimum && date < minimum);
              return (
                <View
                  key={date || "blank-" + i}
                  style={{ width: "14.2857%", padding: 2 }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={date || "Empty day"}
                    accessibilityState={{
                      selected: date === selected,
                      disabled,
                    }}
                    disabled={disabled}
                    onPress={() => date && setSelected(date)}
                    style={{
                      minHeight: 40,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor:
                        date && date === selected ? purple : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter",
                        color: disabled
                          ? "#CFC5DB"
                          : date === selected
                            ? "white"
                            : "#31145B",
                      }}
                    >
                      {date ? Number(date.slice(-2)) : ""}
                    </Text>
                  </Pressable>
                </View>
              );
            },
          )}
        </View>
        <Button
          disabled={!selected || (!!minimum && selected < minimum)}
          onPress={() => {
            onChange(selected);
            setOpen(false);
          }}
        >
          Confirm Date
        </Button>
        <Button
          variant="ghost"
          onPress={() => {
            onChange("");
            setOpen(false);
          }}
        >
          Clear date
        </Button>
      </BottomSheet>
    </View>
  );
}
