import type { TripMapProps } from "../types";

// Only public map presentation data crosses the WebView bridge; never auth tokens.
export function mapUpdateData(props: TripMapProps) {
  return {
    selectCoordinates: typeof props.onSelectCoordinate === "function",
    places: props.places.map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude })),
    selectedPlaceId: props.selectedPlaceId,
    routePlaces: (props.routePlaces ?? []).map(({ latitude, longitude }) => ({ latitude, longitude })),
    center: props.center ? { latitude: props.center.latitude, longitude: props.center.longitude } : null,
    resetSignal: props.resetSignal ?? 0,
    mutedMap: props.mutedMap ?? true,
  };
}
export function mapUpdateScript(props: TripMapProps) {
  const payload = JSON.stringify(mapUpdateData(props)).replace(/[<>&\u2028\u2029]/g, (char) => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
  return "window.updateMap(" + payload + "); true;";
}

export const mapDocument = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
html,body,#map { width:100%; height:100%; margin:0; background:#F2EAFB; }
.leaflet-control-attribution { font:10px sans-serif; }
.leaflet-bottom.leaflet-left { bottom:0; }
.muted .leaflet-tile-pane { filter:saturate(.65); }
</style></head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function () {
  function send(type, extra) {
    window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type:type }, extra || {})));
  }
  if (!window.L) { send("error"); return; }
  var map = L.map("map", { zoomControl:false, attributionControl:false }).setView([15,105],4);
  L.control.attribution({ position:"bottomleft", prefix:false }).addTo(map);
  var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  }).addTo(map);
  tiles.on("tileload", function () { send("tiles"); });
  var markers = L.layerGroup().addTo(map);
  var route = L.layerGroup().addTo(map);
  var picking = false;
  map.on("click", function(event) {
    if (picking) send("coordinate", { latitude:event.latlng.lat, longitude:event.latlng.lng });
  });
  var geometry = null;
  var reset = null;
  window.updateMap = function (data) {
    picking = Boolean(data.selectCoordinates);
    markers.clearLayers();
    route.clearLayers();
    document.body.classList.toggle("muted", Boolean(data.mutedMap));
    data.places.forEach(function (place) {
      var selected = place.id === data.selectedPlaceId;
      var marker = L.circleMarker([place.latitude,place.longitude], {
        radius:selected ? 12 : 9, color:selected ? "#4E2867" : "#FFFFFF",
        weight:3, fillColor:"#9365BC", fillOpacity:1
      }).addTo(markers);
      var label = document.createElement("span");
      label.textContent = place.name;
      marker.bindTooltip(label);
      marker.on("click", function () { send("select", { id:place.id }); });
    });
    if (data.routePlaces.length > 1) {
      L.polyline(data.routePlaces.map(function(p) { return [p.latitude,p.longitude]; }),
        {color:"#8653AF",weight:4,dashArray:"10 5"}).addTo(route);
    }
    var nextGeometry = JSON.stringify([data.places.map(function(p) {
      return [p.id,p.latitude,p.longitude];
    }),data.center]);
    if (geometry !== nextGeometry || reset !== data.resetSignal) {
      var points = data.places.map(function(p) { return [p.latitude,p.longitude]; });
      if (points.length > 1) map.fitBounds(points, {paddingTopLeft:[45,100],paddingBottomRight:[65,85],maxZoom:16});
      else if (points.length === 1) map.setView(points[0],14);
      else if (data.center) map.setView([data.center.latitude,data.center.longitude],12);
      else map.setView([15,105],4);
      geometry = nextGeometry;
      reset = data.resetSignal;
    }
  };
  window.addEventListener("resize", function () { map.invalidateSize(); });
  send("ready");
})();
</script></body></html>`;
