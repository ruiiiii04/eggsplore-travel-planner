import { test } from "node:test";
import assert from "node:assert/strict";
import { adjustRecoveryTime, reorderRecoveryDay } from "../src/features/trips/disruptions/model";
const day = "2026-10-16";
const activity = (id: string, time: string) => ({ id, title: id, start_time: day + "T" + time + ":00.000Z" });
const morning = activity("morning", "09:00"), checkin = activity("checkin", "21:30"), dinner = activity("dinner", "20:00");
const delayed = [{ item_id: dinner.id, title: dinner.title, expected_start_time: dinner.start_time, new_start_time: day + "T23:00:00.000Z" }];
test("single affected dinner can move above the manual-review check-in", () => {
 const result = reorderRecoveryDay([morning, checkin, dinner], delayed, 2, 1, day);
 assert(result);
 assert.equal(result.find((change) => change.item_id === "dinner")?.new_start_time.slice(11, 16), "21:30");
 assert.equal(result.find((change) => change.item_id === "checkin")?.new_start_time.slice(11, 16), "23:00");
 assert(!result.some((change) => change.item_id === "morning"));
});
test("manual-review activity can be adjusted and restored to its original time", () => {
 const result = adjustRecoveryTime(checkin, delayed, 15, day); assert(result);
 assert.equal(result.find((change) => change.item_id === "checkin")?.new_start_time.slice(11, 16), "21:45");
 const restored = adjustRecoveryTime(checkin, result, -15, day); assert(restored);
 assert(!restored.some((change) => change.item_id === "checkin"));
 assert.equal(adjustRecoveryTime(checkin, delayed, -15, day), null);
});
test("time controls reject crossing midnight and preserve unrelated changes", () => {
 const late = activity("late", "23:50");
 assert.equal(adjustRecoveryTime(late, delayed, 15, day), null);
 const result = adjustRecoveryTime(dinner, delayed, -15, day); assert(result);
 assert.equal(result[0].new_start_time.slice(11, 16), "22:45");
 const crossing = reorderRecoveryDay([morning, dinner, late], delayed, 2, 0, day);
 assert.equal(crossing, null);
});

// Exercise the rendered reset button and its visible confirmation.
test("regenerate button calls reset and confirms it even when suggested times are unchanged", async () => {
 const { readFileSync } = await import("node:fs");
 const { runInNewContext } = await import("node:vm");
 const { default: ts } = await import("typescript");
 const source = readFileSync(new URL("../src/features/trips/disruptions/DisruptionReviewScreen.tsx", import.meta.url), "utf8");
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
 const exports: any = {}; const states: any[] = []; let cursor = 0, calls = 0;
 const jsx = (type: any, props: any) => ({ type, props });
 runInNewContext(compiled, { exports, require(name: string) {
  if (name === "react") return { useMemo: (fn: any) => fn(), useState(initial: any) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (value: any) => { states[i] = value; }]; } };
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (name.includes("DragReorderRow")) return { default: "DragReorderRow", ReorderHandle: "ReorderHandle", useReorderScrollEnabled: () => true };
  if (name === "./model") return { adjustRecoveryTime, reorderRecoveryDay };
  return new Proxy({}, { get: (_, key) => String(key) });
 } });
 let nodes: any[] = [];
 function render() {
  cursor = 0; nodes = [];
  const tree = exports.DisruptionReviewScreen({ visible: true, event: { impact_date: day, flight_date: day, flight_number: "DEMO123", flight_status: "delayed", delay_minutes: 180, source: "demo", leg_type: "demo" }, activities: [dinner], changes: delayed, isLeader: true, busy: false, error: "", onReset: () => { calls++; } });
  function visit(value: any) { if (Array.isArray(value)) value.forEach(visit); else if (value?.props) { nodes.push(value); visit(value.props.children); } }
  visit(tree);
 }
 render(); const button = nodes.find((node) => node.props.accessibilityLabel === "Regenerate suggested schedule");
 assert(button); assert.equal(button.props.disabled, false); button.props.onPress(); render();
 assert.equal(calls, 1);
 assert(nodes.some((node) => node.props.accessibilityLiveRegion === "polite" && node.props.children.includes("Suggested schedule regenerated")));
});
