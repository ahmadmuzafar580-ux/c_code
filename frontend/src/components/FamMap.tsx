import React, { useMemo, useRef, useEffect } from "react";
import { StyleSheet, View } from "react-native";
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
  radius: number; // meters
  color?: string;
  label?: string;
};

type Props = {
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  circles?: MapCircle[];
  onMapTap?: (coord: { lat: number; lng: number }) => void;
  interactive?: boolean;
  style?: any;
};

const HTML = (
  center: { lat: number; lng: number },
  zoom: number,
  interactive: boolean
) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #E8ECEF; }
  .avatar-pin {
    width: 44px; height: 44px; border-radius: 999px;
    border: 3px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    background-size: cover; background-position: center; background-color: #3A6047;
  }
  .avatar-pin.self { border-color: #3A6047; }
  .place-pin {
    width: 34px; height: 34px; border-radius: 999px;
    background: #FFFFFF; border: 2px solid #3A6047;
    display: flex; align-items: center; justify-content: center;
    color: #3A6047; font-family: -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 16px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }
  .leaflet-container { background: #E8ECEF !important; }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    dragging: ${interactive ? "true" : "false"},
    touchZoom: ${interactive ? "true" : "false"},
    doubleClickZoom: ${interactive ? "true" : "false"},
    scrollWheelZoom: ${interactive ? "true" : "false"},
    boxZoom: ${interactive ? "true" : "false"},
    tap: ${interactive ? "true" : "false"},
  }).setView([${center.lat}, ${center.lng}], ${zoom});

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);
  var circleLayer = L.layerGroup().addTo(map);

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  map.on('click', function(e){
    post({ type: 'tap', lat: e.latlng.lat, lng: e.latlng.lng });
  });

  window.setMarkers = function(list) {
    markerLayer.clearLayers();
    list.forEach(function(m){
      var html;
      if (m.avatarUrl) {
        html = '<div class="avatar-pin ' + (m.isSelf ? 'self' : '') + '" style="background-image:url(\\'' + m.avatarUrl + '\\');"></div>';
      } else {
        html = '<div class="place-pin">' + (m.label ? m.label.charAt(0).toUpperCase() : 'P') + '</div>';
      }
      var icon = L.divIcon({ className: '', html: html, iconSize: m.avatarUrl ? [44,44] : [34,34], iconAnchor: m.avatarUrl ? [22,22] : [17,17] });
      var mk = L.marker([m.lat, m.lng], { icon: icon });
      if (m.label) mk.bindTooltip(m.label, {direction:'top', offset:[0,-20]});
      mk.addTo(markerLayer);
      mk.on('click', function(){ post({ type: 'markerTap', id: m.id }); });
    });
  };

  window.setCircles = function(list) {
    circleLayer.clearLayers();
    list.forEach(function(c){
      L.circle([c.lat, c.lng], {
        radius: c.radius,
        color: c.color || '#3A6047',
        weight: 2,
        fillColor: c.color || '#3A6047',
        fillOpacity: 0.12,
      }).addTo(circleLayer);
    });
  };

  window.flyTo = function(lat, lng, z) {
    map.flyTo([lat, lng], z || map.getZoom(), { duration: 0.8 });
  };

  window.fitToMarkers = function() {
    var layers = [];
    markerLayer.eachLayer(function(l){ layers.push(l); });
    if (layers.length === 0) return;
    if (layers.length === 1) { map.setView(layers[0].getLatLng(), 15); return; }
    var group = L.featureGroup(layers);
    map.fitBounds(group.getBounds().pad(0.35));
  };

  post({ type: 'ready' });
</script>
</body>
</html>`;

export default function FamMap({
  center = { lat: 37.7749, lng: -122.4194 },
  zoom = 13,
  markers = [],
  circles = [],
  onMapTap,
  interactive = true,
  style,
}: Props) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  const html = useMemo(() => HTML(center, zoom, interactive), []); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = () => {
    if (!webRef.current || !readyRef.current) return;
    const js = `
      window.setMarkers(${JSON.stringify(markers)});
      window.setCircles(${JSON.stringify(circles)});
      true;
    `;
    webRef.current.injectJavaScript(js);
  };

  useEffect(() => { flush(); }, [markers, circles]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === "ready") {
        readyRef.current = true;
        flush();
        // fit to markers on first ready
        setTimeout(() => {
          webRef.current?.injectJavaScript("window.fitToMarkers(); true;");
        }, 200);
      } else if (msg.type === "tap" && onMapTap) {
        onMapTap({ lat: msg.lat, lng: msg.lng });
      }
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  web: { flex: 1, backgroundColor: "transparent" },
});
