import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  adjustBudget,
  budgetLimits,
  formatBudget,
  parseBudget,
} from "./detailsModel";
export function BudgetRange({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const range = parseBudget(value);
  const [inputs, setInputs] = useState(range.map(String));
  const track = useRef<View>(null);
  const bounds = useRef({ x: 0, width: 1 });
  const active = useRef<0 | 1>(0);
  const latest = useRef(range);
  latest.current = range;
  function commit(bound: 0 | 1, amount: number) {
    if (!Number.isFinite(amount)) return;
    const next = adjustBudget(latest.current, bound, amount);
    latest.current = next;
    setInputs(next.map(String));
    onChange(formatBudget(...next));
  }
  function amountAt(x: number) {
    return (
      budgetLimits.min +
      Math.max(0, Math.min(1, (x - bounds.current.x) / bounds.current.width)) *
        (budgetLimits.max - budgetLimits.min)
    );
  }
  const percent = (amount: number) =>
    ((amount - budgetLimits.min) / (budgetLimits.max - budgetLimits.min)) * 100;
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={{
          fontFamily: "Inter",
          fontWeight: "700",
          color: "#31145B",
          fontSize: 15,
        }}
      >
        {formatBudget(...range)}
      </Text>
      <View style={{ flexDirection: "row", gap: 12 }}>
        {([0, 1] as const).map((bound) => (
          <View key={bound} style={{ flex: 1, gap: 4 }}>
            <Text
              style={{ fontFamily: "Inter", fontSize: 11, color: "#857695" }}
            >
              {bound === 0 ? "Minimum (RM)" : "Maximum (RM)"}
            </Text>
            <TextInput
              accessibilityLabel={
                bound === 0 ? "Minimum budget in RM" : "Maximum budget in RM"
              }
              keyboardType="numeric"
              value={inputs[bound]}
              onChangeText={(text) =>
                setInputs((previous) =>
                  previous.map((v, i) =>
                    i === bound ? text.replace(/[^0-9]/g, "") : v,
                  ),
                )
              }
              onEndEditing={() => commit(bound, Number(inputs[bound]))}
              onSubmitEditing={() => commit(bound, Number(inputs[bound]))}
              onBlur={() => commit(bound, Number(inputs[bound]))}
              style={{
                minHeight: 44,
                borderWidth: 1,
                borderColor: "#E8DDF3",
                borderRadius: 12,
                paddingHorizontal: 12,
                fontFamily: "Inter",
                color: "#31145B",
              }}
            />
          </View>
        ))}
      </View>
      <View
        ref={track}
        onLayout={() =>
          track.current?.measureInWindow((x, _y, width) => {
            bounds.current = { x, width };
          })
        }
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => {
          const pageX = event.nativeEvent.pageX;
          track.current?.measureInWindow((x, _y, width) => {
            bounds.current = { x, width };
            const amount = amountAt(pageX);
            active.current =
              Math.abs(amount - latest.current[0]) <=
              Math.abs(amount - latest.current[1])
                ? 0
                : 1;
            commit(active.current, amount);
          });
        }}
        onResponderMove={(event) =>
          commit(active.current, amountAt(event.nativeEvent.pageX))
        }
        style={{
          minHeight: 44,
          justifyContent: "center",
          marginHorizontal: 12,
        }}
      >
        <View
          pointerEvents="none"
          style={{ height: 8, borderRadius: 5, backgroundColor: "#D5B5EF" }}
        >
          <View
            style={{
              position: "absolute",
              height: 8,
              backgroundColor: "#8050C5",
              borderRadius: 5,
              left: (percent(range[0]) + "%") as `${number}%`,
              width: (percent(range[1]) - percent(range[0]) + "%") as any,
            }}
          />
        </View>
        {([0, 1] as const).map((bound) => (
          <View
            key={bound}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={
              bound === 0 ? "Minimum budget" : "Maximum budget"
            }
            accessibilityValue={{
              min: budgetLimits.min,
              max: budgetLimits.max,
              now: range[bound],
            }}
            accessibilityActions={[
              { name: "increment" },
              { name: "decrement" },
            ]}
            onAccessibilityAction={(event) =>
              commit(
                bound,
                range[bound] +
                  (event.nativeEvent.actionName === "increment" ? 100 : -100),
              )
            }
            pointerEvents="none"
            style={{
              position: "absolute",
              left: (percent(range[bound]) + "%") as any,
              marginLeft: -10,
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: "white",
              backgroundColor: "#8050C5",
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#857695", fontSize: 11 }}>RM 1,000</Text>
        <Text style={{ color: "#857695", fontSize: 11 }}>{`RM ${budgetLimits.max.toLocaleString("en-MY")}`}</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          [1000, 2000],
          [2000, 5000],
          [5000, 10000],
          [10000, 20000],
        ].map(([min, max]) => (
          <Pressable
            key={min}
            accessibilityRole="button"
            onPress={() => {
              setInputs([String(min), String(max)]);
              onChange(formatBudget(min, max));
            }}
            style={{ backgroundColor: "#F1EAF8", borderRadius: 16, padding: 9 }}
          >
            <Text style={{ color: "#8050C5", fontSize: 11 }}>
              {formatBudget(min, max)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
