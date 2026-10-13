import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Animated, PanResponder, Text, Vibration, View, type GestureResponderHandlers, type StyleProp, type ViewStyle } from "react-native";
import { GripVertical } from "lucide-react-native";
import { reorderPosition } from "./reorderPosition";
const scrollLocks = new Set<symbol>();
const scrollListeners = new Set<() => void>();
function setScrollLock(token: symbol, locked: boolean) {
 if (locked) scrollLocks.add(token); else scrollLocks.delete(token);
 scrollListeners.forEach((listener) => listener());
}
export function useReorderScrollEnabled() {
 return useSyncExternalStore((listener) => { scrollListeners.add(listener); return () => { scrollListeners.delete(listener); }; }, () => scrollLocks.size === 0, () => true);
}
const HandleContext = createContext<{ handlers: GestureResponderHandlers; active: boolean; disabled: boolean; label: string; move: (offset: number) => void } | null>(null);
export function ReorderHandle() {
 const context = useContext(HandleContext);
 if (!context) return null;
 return <View {...context.handlers} accessible accessibilityRole="button" accessibilityLabel={"Reorder " + context.label} accessibilityHint="Hold until highlighted, then drag up or down and release to move. Tap for move buttons." accessibilityState={{ disabled: context.disabled }} accessibilityActions={[{ name: "increment", label: "Move down" }, { name: "decrement", label: "Move up" }]} onAccessibilityAction={(event) => context.move(event.nativeEvent.actionName === "increment" ? 1 : -1)} style={{ width: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: context.active ? "#E9DCFA" : "transparent" }}><GripVertical size={22} color={context.disabled ? "#D1C6DC" : "#8050C5"} /></View>;
}
export default function DragReorderRow({ children, index, min = 0, max, onMove, onTap, disabled = false, label, style }: { children: ReactNode; index: number; min?: number; max: number; onMove: (index: number) => void; onTap: () => void; disabled?: boolean; label: string; style?: StyleProp<ViewStyle> }) {
 const scrollToken = useRef(Symbol("reorder")).current;
 const latest = useRef({ index, min, max, onMove, onTap, disabled });
 latest.current = { index, min, max, onMove, onTap, disabled };
 const offset = useRef(new Animated.Value(0)).current;
 const height = useRef(78), active = useRef(false), cancelled = useRef(false);
 const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const [dragging, setDragging] = useState(false), [target, setTarget] = useState(index);
 const clearTimer = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };
 const reset = () => { clearTimer(); active.current = false; setScrollLock(scrollToken, false); setDragging(false); offset.setValue(0); };
 useEffect(() => () => { clearTimer(); setScrollLock(scrollToken, false); offset.stopAnimation(); }, [offset, scrollToken]);
 const responder = useRef(PanResponder.create({
  onStartShouldSetPanResponder: () => !latest.current.disabled,
  onMoveShouldSetPanResponder: () => active.current,
  onPanResponderGrant: () => {
   clearTimer(); cancelled.current = false;
   timer.current = setTimeout(() => {
    if (cancelled.current || latest.current.disabled) return;
    active.current = true; setScrollLock(scrollToken, true); setDragging(true); setTarget(latest.current.index); Vibration.vibrate(25);
   }, 350);
  },
  onPanResponderMove: (_, gesture) => {
   if (!active.current) { if (Math.abs(gesture.dy) > 10 || Math.abs(gesture.dx) > 10 || gesture.numberActiveTouches > 1) { cancelled.current = true; clearTimer(); } return; }
   if (gesture.numberActiveTouches > 1 || latest.current.disabled) { cancelled.current = true; reset(); return; }
   const current = latest.current;
   const delta = Math.max((current.min - current.index) * height.current, Math.min((current.max - current.index) * height.current, gesture.dy));
   offset.setValue(delta);
   setTarget(reorderPosition(current.index, delta, height.current, current.min, current.max));
  },
  onPanResponderRelease: (_, gesture) => {
   const current = latest.current;
   const next = reorderPosition(current.index, gesture.dy, height.current, current.min, current.max);
   const shouldMove = active.current && !current.disabled && !cancelled.current && next !== current.index;
   const tap = !active.current && !cancelled.current && !current.disabled;
   reset();
   if (shouldMove) current.onMove(next); else if (tap) current.onTap();
  },
  onPanResponderTerminationRequest: () => !active.current,
  onPanResponderTerminate: reset,
  onShouldBlockNativeResponder: () => true,
 })).current;
 return <HandleContext.Provider value={{ handlers: responder.panHandlers, active: dragging, disabled, label, move: (direction) => { if (!disabled) { const next = Math.max(min, Math.min(max, index + direction)); if (next !== index) onMove(next); } } }}>
 <Animated.View onLayout={(event) => { if (!active.current) height.current = Math.max(44, event.nativeEvent.layout.height); }} style={[style, dragging && { zIndex: 100, elevation: 8, backgroundColor: "#F5F0FB", borderRadius: 12, shadowColor: "#37134F", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, { transform: [{ translateY: offset }] }]}>
 {children}
 {dragging && <View pointerEvents="none" style={{ position: "absolute", top: -20, right: 0, borderRadius: 8, backgroundColor: "#8050C5", paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: "white", fontSize: 11 }}>Release at position {target + 1}</Text></View>}
 </Animated.View>
 </HandleContext.Provider>;
}
