import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { colors } from "../lib/theme";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  color?: string;
  avatarUrl?: string;
  isSelf?: boolean;
};

export type MapCircle = {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  color?: string;
  label?: string;
};

export type MapLayer = "streets" | "satellite" | "hybrid";

export type FamMapHandle = {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitToMarkers: () => void;
  setLayer: (layer: MapLayer) => void;
};

type Props = {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  circles?: MapCircle[];
  onMapTap?: (coord: { lat: number; lng: number }) => void;
  onMarkerTap?: (id: string) => void;
  interactive?: boolean;
  layer?: MapLayer;
  style?: any;
};

const HTML = (
  center: { lat: number; lng: number },
  zoom: number,
  interactive: boolean,
  layer: MapLayer,
  isWeb: boolean
) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #0b1220; }
  .avatar-pin {
    width: 46px; height: 46px; border-radius: 999px;
    border: 3px solid #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    background-size: cover; background-position: center; background-color: #3A6047;
    position: relative;
  }
  .avatar-pin.self { border-color: #FFD166; }
  .avatar-pin .dot {
    position: absolute; bottom: -2px; right: -2px;
    width: 12px; height: 12px; border-radius: 999px;
    background: #34D399; border: 2px solid #fff;
  }
  .avatar-name {
    position: absolute; top: -22px; left: 50%; transform: translateX(-50%);
    background: rgba(28,28,30,0.85); color: #fff; padding: 2px 8px;
    border-radius: 999px; font: 600 10px -apple-system, system-ui, sans-serif;
    white-space: nowrap; pointer-events: none;
  }
  .place-pin {
    width: 34px; height: 34px; border-radius: 999px;
    background: #FFFFFF; border: 2px solid #3A6047;
    display: flex; align-items: center; justify-content: center;
    color: #3A6047; font-family: -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 16px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  }
  .leaflet-container { background: #0b1220 !important; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7) !important; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var IS_WEB = ${isWeb ? "true" : "false"};
  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    dragging: ${interactive ? "true" : "false"},
    touchZoom: ${interactive ? "true" : "false"},
    doubleClickZoom: ${interactive ? "true" : "false"},
    scrollWheelZoom: ${interactive ? "true" : "false"},
    boxZoom: ${interactive ? "true" : "false"},
    tap: ${interactive ? "true" : "false"},
    zoomAnimation: true, markerZoomAnimation: true, fadeAnimation: true,
  }).setView([${center.lat}, ${center.lng}], ${zoom});

  var LAYERS = {
    streets: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20, subdomains: 'abcd', attribution: '&copy; OSM &copy; CARTO'
    }),
    satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], attribution: '&copy; Google'
    }),
    hybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], attribution: '&copy; Google Hybrid'
    })
  };
  var current = '${layer}';
  LAYERS[current].addTo(map);

  var markerLayer = L.layerGroup().addTo(map);
  var circleLayer = L.layerGroup().addTo(map);
  var markerIndex = {};

  function post(msg) {
    if (IS_WEB) {
      window.parent && window.parent.postMessage(JSON.stringify(msg), '*');
    } else if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }
  }

  map.on('click', function(e){ post({ type: 'tap', lat: e.latlng.lat, lng: e.latlng.lng }); });

  function makeIcon(m) {
    if (m.avatarUrl) {
      var html = ''
        + '<div class="avatar-pin ' + (m.isSelf ? 'self' : '') + '" style="background-image:url(\\'' + m.avatarUrl + '\\');">'
        +   (m.label ? '<div class="avatar-name">' + m.label + '</div>' : '')
        +   '<div class="dot"></div>'
        + '</div>';
      return L.divIcon({ className: '', html: html, iconSize: [46,46], iconAnchor: [23,23] });
    }
    var pfx = '<div class="place-pin">' + (m.label ? m.label.charAt(0).toUpperCase() : 'P') + '</div>';
    return L.divIcon({ className: '', html: pfx, iconSize: [34,34], iconAnchor: [17,17] });
  }

  function setMarkers(list) {
    var seen = {};
    list.forEach(function(m){
      seen[m.id] = true;
      var existing = markerIndex[m.id];
      if (existing) {
        var from = existing.getLatLng();
        var to = L.latLng(m.lat, m.lng);
        if (from.lat !== to.lat || from.lng !== to.lng) animateMarker(existing, from, to, 700);
        existing.setIcon(makeIcon(m));
      } else {
        var mk = L.marker([m.lat, m.lng], { icon: makeIcon(m) });
        mk.addTo(markerLayer);
        mk.on('click', function(){ post({ type: 'markerTap', id: m.id }); });
        markerIndex[m.id] = mk;
      }
    });
    Object.keys(markerIndex).forEach(function(id){
      if (!seen[id]) { markerLayer.removeLayer(markerIndex[id]); delete markerIndex[id]; }
    });
  }

  function animateMarker(marker, from, to, duration) {
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      var e = 1 - Math.pow(1 - t, 3);
      marker.setLatLng([from.lat + (to.lat - from.lat) * e, from.lng + (to.lng - from.lng) * e]);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function setCircles(list) {
    circleLayer.clearLayers();
    list.forEach(function(c){
      L.circle([c.lat, c.lng], {
        radius: c.radius, color: c.color || '#3A6047', weight: 2,
        fillColor: c.color || '#3A6047', fillOpacity: 0.12,
      }).addTo(circleLayer);
    });
  }

  function flyTo(lat, lng, z) { map.flyTo([lat, lng], z || Math.max(map.getZoom(), 15), { duration: 0.9 }); }
  function fitToMarkers() {
    var layers = [];
    markerLayer.eachLayer(function(l){ layers.push(l); });
    if (layers.length === 0) return;
    if (layers.length === 1) { map.setView(layers[0].getLatLng(), 15); return; }
    var group = L.featureGroup(layers);
    map.fitBounds(group.getBounds().pad(0.35));
  }
  function setLayerName(name) {
    if (!LAYERS[name] || name === current) return;
    try { map.removeLayer(LAYERS[current]); } catch(e) {}
    LAYERS[name].addTo(map);
    current = name;
  }

  // Expose to injectJavaScript (mobile)
  window.setMarkers = setMarkers;
  window.setCircles = setCircles;
  window.flyTo = flyTo;
  window.fitToMarkers = fitToMarkers;
  window.setLayer = setLayerName;

  // Web: listen for postMessage commands
  window.addEventListener('message', function(ev){
    try {
      var data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      if (!data || !data.__famrakCmd) return;
      var cmd = data.__famrakCmd;
      if (cmd === 'setMarkers') setMarkers(data.list);
      else if (cmd === 'setCircles') setCircles(data.list);
      else if (cmd === 'flyTo') flyTo(data.lat, data.lng, data.zoom);
      else if (cmd === 'fitToMarkers') fitToMarkers();
      else if (cmd === 'setLayer') setLayerName(data.layer);
    } catch(e) {}
  });

  post({ type: 'ready' });
</script>
</body>
</html>`;

// ---------- Web fallback using iframe ----------
function WebMap(props: Props, ref: React.Ref<FamMapHandle>) {
  const { center = { lat: 37.7749, lng: -122.4194 }, zoom = 13, markers = [], circles = [], onMapTap, onMarkerTap, interactive = true, layer = "hybrid", style } = props;
  const iframeRef = useRef<any>(null);
  const readyRef = useRef(false);
  const html = useMemo(() => HTML(center, zoom, interactive, layer, true), []); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback((payload: any) => {
    if (!iframeRef.current || !readyRef.current) return;
    const win = iframeRef.current.contentWindow;
    if (!win) return;
    win.postMessage(payload, "*");
  }, []);

  const flush = useCallback(() => {
    send({ __famrakCmd: "setMarkers", list: markers });
    send({ __famrakCmd: "setCircles", list: circles });
  }, [markers, circles, send]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, z) => send({ __famrakCmd: "flyTo", lat, lng, zoom: z }),
    fitToMarkers: () => send({ __famrakCmd: "fitToMarkers" }),
    setLayer: (l) => send({ __famrakCmd: "setLayer", layer: l }),
  }));

  useEffect(() => { flush(); }, [flush]);
  useEffect(() => { send({ __famrakCmd: "setLayer", layer }); }, [layer, send]);

  useEffect(() => {
    const handler = (ev: MessageEvent) => {
      const src = iframeRef.current?.contentWindow;
      if (!src || ev.source !== src) return;
      try {
        const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (data?.type === "ready") {
          readyRef.current = true;
          flush();
          setTimeout(() => send({ __famrakCmd: "fitToMarkers" }), 250);
        } else if (data?.type === "tap" && onMapTap) {
          onMapTap({ lat: data.lat, lng: data.lng });
        } else if (data?.type === "markerTap" && onMarkerTap) {
          onMarkerTap(data.id);
        }
      } catch {}
    };
    if (typeof window !== "undefined") window.addEventListener("message", handler);
    return () => { if (typeof window !== "undefined") window.removeEventListener("message", handler); };
  }, [flush, onMapTap, onMarkerTap, send]);

  // React Native Web renders unknown elements via createElement; use dangerouslySetInnerHTML through a wrapper.
  const iframeStyle: any = { border: 0, width: "100%", height: "100%", display: "block", backgroundColor: "#0b1220" };
  return (
    <View style={[styles.wrap, style]}>
      {React.createElement("iframe", {
        ref: iframeRef,
        srcDoc: html,
        style: iframeStyle,
        sandbox: "allow-scripts allow-same-origin",
        title: "FamMap",
      })}
    </View>
  );
}

// ---------- Native mobile using react-native-webview ----------
function NativeMap(props: Props, ref: React.Ref<FamMapHandle>) {
  const { center = { lat: 37.7749, lng: -122.4194 }, zoom = 13, markers = [], circles = [], onMapTap, onMarkerTap, interactive = true, layer = "hybrid", style } = props;
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const html = useMemo(() => HTML(center, zoom, interactive, layer, false), []); // eslint-disable-line react-hooks/exhaustive-deps

  const inject = (js: string) => {
    if (!webRef.current || !readyRef.current) return;
    webRef.current.injectJavaScript(js + "\ntrue;");
  };

  const flush = () => {
    inject(`window.setMarkers(${JSON.stringify(markers)}); window.setCircles(${JSON.stringify(circles)});`);
  };

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, z?: number) => inject(`window.flyTo(${lat}, ${lng}, ${z || "undefined"});`),
    fitToMarkers: () => inject("window.fitToMarkers();"),
    setLayer: (l: MapLayer) => inject(`window.setLayer(${JSON.stringify(l)});`),
  }));

  useEffect(() => { flush(); }, [markers, circles]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { inject(`window.setLayer(${JSON.stringify(layer)});`); }, [layer]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") {
        readyRef.current = true;
        flush();
        setTimeout(() => inject("window.fitToMarkers();"), 250);
      } else if (msg.type === "tap" && onMapTap) onMapTap({ lat: msg.lat, lng: msg.lng });
      else if (msg.type === "markerTap" && onMarkerTap) onMarkerTap(msg.id);
    } catch {}
  };

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={onMessage}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        androidLayerType="hardware"
        allowFileAccess
        setSupportMultipleWindows={false}
        androidHardwareAccelerationDisabled={false}
        mixedContentMode="always"
      />
    </View>
  );
}

const FamMap = forwardRef<FamMapHandle, Props>((props, ref) => {
  if (Platform.OS === "web") return WebMap(props, ref);
  return NativeMap(props, ref);
});
FamMap.displayName = "FamMap";
export default FamMap;

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
});
