import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Node = { type: string; props: Record<string, any> };
function harness() {
 const slots: any[] = []; let cursor = 0;
 const writes: Array<{ values: Record<string, any>; resolve: (result: any) => void }> = [];
 const react = {
  useState(initial: any) { const slot = cursor++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], (value: any) => { slots[slot] = typeof value === "function" ? value(slots[slot]) : value; }]; },
  useRef(initial: any) { const slot = cursor++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
  useCallback(callback: any) { return callback; },
 };
 const jsx = (type: string, props: any) => ({ type, props });
 const db = { from(table: string) {
  assert.equal(table, "trip_flights");
  let values: Record<string, any> = {};
  const query: any = {
   insert(input: any) { values = input; return query; },
   select() { return query; },
   single() { return new Promise((resolve) => writes.push({ values, resolve })); },
  };
  return query;
 } };
 const source = readFileSync(new URL("../src/features/trips/disruptions/FlightDisruptionCard.tsx", import.meta.url), "utf8");
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
 const exports: any = {};
 runInNewContext(compiled, { exports, setTimeout, require(name: string) {
  if (name === "react") return react;
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
  if (name === "react-native") return { Image: "Image", Pressable: "Pressable", Switch: "Switch", Text: "Text", TextInput: "TextInput", View: "View" };
  if (name === "expo-router") return { useFocusEffect() {} };
  if (name === "lucide-react-native") return { AlertTriangle: "AlertTriangle", Check: "Check", Plane: "Plane", RefreshCw: "RefreshCw" };
  if (name === "@/components/ui") return { BottomSheet: "BottomSheet" };
  if (name === "@/lib/errors") return { errorMessage: (error: any) => error.message };
  if (name === "@/lib/supabase") return { getSupabase: () => db };
  if (name.includes("CalendarDateField")) return { CalendarDateField: "CalendarDateField" };
  if (name === "./model") return { buildRecoveryPlan: () => [] };
  if (name === "./DisruptionReviewScreen") return { DisruptionReviewScreen: "DisruptionReviewScreen" };
  throw new Error("Unexpected import: " + name);
 } });
 let nodes: Node[] = [];
 function render() {
  cursor = 0; nodes = [];
  const tree = exports.FlightDisruptionCard({ tripId: "trip", userId: "user", startDate: "2026-10-13", isLeader: false, activities: [], onItineraryChanged() {}, showSetup: true });
  function visit(value: any) { if (Array.isArray(value)) value.forEach(visit); else if (value?.props) { nodes.push(value); visit(value.props.children); } }
  visit(tree);
 }
 function find(label: string) { const node = nodes.find((node) => node.props.accessibilityLabel === label); assert(node, label); return node; }
 function fill(leg: "outbound" | "return", number: string, date: string) {
  render(); find((leg === "outbound" ? "Outbound flight" : "Return flight (optional)") + " number").props.onChangeText(number);
  const calendar = nodes.find((node) => node.type === "CalendarDateField" && node.props.title === (leg === "outbound" ? "Outbound flight" : "Return flight (optional)") + " date");
  assert(calendar); calendar.props.onChange(date); render();
 }
 function complete(index: number, error: string | null = null) { const write = writes[index]; write.resolve({ data: { id: write.values.leg_type, ...write.values }, error: error ? { message: error } : null }); }
 return { render, find, fill, writes, complete, nodes: () => nodes };
}
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
test("outbound and return can save independently while the other request is pending", async () => {
 const app = harness();
 app.fill("outbound", "MH123", "2026-10-13"); app.fill("return", "MH124", "2026-10-20");
 app.find("Save outbound flight").props.onPress(); app.render();
 assert.equal(app.find("Save outbound flight").props.disabled, true);
 assert.equal(app.find("Save return flight").props.disabled, false);
 assert.equal(app.find("Save return flight").props.accessibilityState.busy, false);
 assert.equal(app.find("Return flight (optional) number").props.editable, true);
 assert.equal(app.find("Return flight (optional) number").props.value, "MH124");
 app.find("Save return flight").props.onPress(); app.render();
 assert.equal(app.writes.length, 2);
 assert.equal(app.writes[0].values.leg_type, "outbound"); assert.equal(app.writes[0].values.flight_number, "MH123");
 assert.equal(app.writes[1].values.leg_type, "return"); assert.equal(app.writes[1].values.flight_number, "MH124");
 app.complete(0); await flush(); app.render();
 assert.equal(app.find("Save return flight").props.accessibilityState.busy, true);
 assert.equal(app.find("Check outbound flight status").props.disabled, false);
 app.complete(1); await flush(); app.render();
 assert.equal(app.find("Check return flight status").props.disabled, false);
});
test("failure of one save does not clear the other flight's pending request", async () => {
 const app = harness(); app.fill("outbound", "MH123", "2026-10-13"); app.fill("return", "MH124", "2026-10-20");
 app.find("Save outbound flight").props.onPress(); app.find("Save return flight").props.onPress();
 app.complete(0, "Outbound save failed"); await flush(); app.render();
 assert.equal(app.find("Save outbound flight").props.disabled, false);
 assert.equal(app.find("Save return flight").props.accessibilityState.busy, true);
 assert.equal(app.nodes().filter((node) => node.props.accessibilityRole === "alert").length, 1);
 app.complete(1); await flush(); app.render();
 assert.equal(app.find("Check return flight status").props.disabled, false);
});
