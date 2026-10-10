import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { mapDocument, mapUpdateScript } from "../src/features/live-assistant/services/mapDocument.ts";
import type { TripMapProps } from "../src/features/live-assistant/types";

const place = {
  id: "place-1", name: "<script>untrusted name</script>", latitude: 37.57,
  longitude: 126.98, area: "Seoul", description: "Private trip note",
  tripId: "private-trip-id", tags: ["Heritage"],
};
function harness() {
  const messages: { type: string; id?: string }[] = [];
  const camera: unknown[][] = [];
  const markers: { label?: { textContent: string }; click?: () => void }[] = [];
  const layer = () => ({ addTo() { return this; }, clearLayers() { markers.length = 0; } });
  const map = {
    setView(...args: unknown[]) { camera.push(args); return this; },
    fitBounds(...args: unknown[]) { camera.push(args); },
    invalidateSize() {},
    on() {},
  };
  let mapClick: ((event: { latlng: { lat: number; lng: number } }) => void) | undefined;
  map.on = (_event?: unknown, callback?: unknown) => { mapClick = callback as typeof mapClick; };
  const window = {
    ReactNativeWebView: { postMessage: (s: string) => messages.push(JSON.parse(s)) },
    addEventListener() {},
    L: {},
    updateMap: undefined as undefined | ((data: unknown) => void),
  };
  const L = {
    map: () => map,
    control: { attribution: layer },
    layerGroup: layer,
    tileLayer: () => ({ ...layer(), on() {} }),
    circleMarker: () => {
      const marker = {
        ...layer(),
        label: undefined as undefined | { textContent: string },
        click: undefined as undefined | (() => void),
        bindTooltip(label: { textContent: string }) { this.label = label; },
        on(_type: string, callback: () => void) { this.click = callback; },
      };
      markers.push(marker);
      return marker;
    },
    polyline: layer,
  };
  window.L = L;
  const context = {
    window, L,
    document: {
      body: { classList: { toggle() {} } },
      createElement: () => ({ textContent: "" }),
    },
  };
  const inline = mapDocument.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inline);
  runInNewContext(inline, context);
  return { context, messages, camera, markers, clickMap: (lat: number, lng: number) => mapClick?.({ latlng: { lat, lng } }) };
}
const props: TripMapProps = {
  places: [place], selectedPlaceId: place.id, onSelectPlace() {},
};

test("Expo Go map renders the selected place and reports pin clicks", () => {
  const h = harness();
  assert.deepEqual(h.messages, [{ type: "ready" }]);
  runInNewContext(mapUpdateScript(props), h.context);
  assert.equal(h.markers[0].label?.textContent, place.name);
  h.markers[0].click?.();
  assert.deepEqual(h.messages[1], { type: "select", id: place.id });
  assert.deepEqual(JSON.parse(JSON.stringify(h.camera.at(-1))), [[37.57, 126.98], 14]);
});

test("selection preserves the map camera; reset refits the places", () => {
  const h = harness();
  runInNewContext(mapUpdateScript(props), h.context);
  const count = h.camera.length;
  runInNewContext(mapUpdateScript({ ...props, selectedPlaceId: null }), h.context);
  assert.equal(h.camera.length, count);
  runInNewContext(mapUpdateScript({ ...props, resetSignal: 1 }), h.context);
  assert.equal(h.camera.length, count + 1);
});

test("WebView bridge excludes private notes and escapes script-like place names", () => {
  const script = mapUpdateScript(props);
  assert.ok(!script.includes("Private trip note"));
  assert.ok(!script.includes("private-trip-id"));
  assert.ok(!script.includes("<script>"));
  const h = harness();
  runInNewContext(script, h.context);
  assert.equal(h.markers[0].label?.textContent, place.name);
  assert.ok(mapDocument.includes("OpenStreetMap contributors"));
});

test("manual map clicks send coordinates only when pin picking is enabled", () => {
  const h = harness();
  runInNewContext(mapUpdateScript(props), h.context);
  h.clickMap(37.5, 126.9);
  assert.equal(h.messages.length, 1);
  runInNewContext(mapUpdateScript({ ...props, onSelectCoordinate() {} }), h.context);
  h.clickMap(37.5, 126.9);
  assert.deepEqual(h.messages.at(-1), { type: "coordinate", latitude: 37.5, longitude: 126.9 });
});
