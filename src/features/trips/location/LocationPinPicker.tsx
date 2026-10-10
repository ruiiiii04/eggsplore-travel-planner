import { createElement, useEffect, useRef } from "react";
import { mapDocument, mapUpdateData, mapUpdateScript } from "../../live-assistant/services/mapDocument";
import type { TripMapProps } from "../../live-assistant/types";

const html = mapDocument.replace("<script>", '<script>window.ReactNativeWebView = { postMessage: function(data) { window.parent.postMessage(data, "*"); } };');
export default function LocationPinPicker(props: TripMapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef(props);
  current.current = props;
  const ready = useRef(false);
  const update = mapUpdateScript(props);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      try {
        const message = JSON.parse(event.data);
        if (message.type === "ready") {
          ready.current = true;
          frame.current?.contentWindow?.postMessage({ type: "update", props: mapUpdateData(current.current) }, "*");
        } else if (message.type === "select" && typeof message.id === "string") {
          const place = current.current.places.find((item) => item.id === message.id);
          if (place) current.current.onSelectPlace(place);
        } else if (message.type === "coordinate" && Number.isFinite(message.latitude) &&
            Number.isFinite(message.longitude) && Math.abs(message.latitude) <= 90) {
          current.current.onSelectCoordinate?.({ latitude: message.latitude, longitude: ((message.longitude + 180) % 360 + 360) % 360 - 180 });
        }
      } catch { /* Ignore unrecognized map messages. */ }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => {
    if (ready.current) frame.current?.contentWindow?.postMessage({ type: "update", props: mapUpdateData(props) }, "*");
  }, [update]);
  const document = html.replace('  send("ready");',
    '  window.addEventListener("message", function(event) { if (event.source === window.parent && event.data.type === "update") window.updateMap(event.data.props); });\n  send("ready");');
  return createElement("iframe", { ref: frame, srcDoc: document, title: props.onSelectCoordinate ? "Choose activity location" : "Trip map", sandbox: "allow-scripts", style: { border: 0, width: "100%", height: "100%" } });
}
