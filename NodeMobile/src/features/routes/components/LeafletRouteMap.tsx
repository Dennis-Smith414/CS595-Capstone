import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType } from "react-native-webview";
import type { LatLng } from "../utils/geo";

type Props = {
  coords: LatLng[];
  testID?: string;
};

const HTML = `<!doctype html><html><head>
<meta charset="utf-8"/><meta name="viewport" content="initial-scale=1, maximum-scale=1, width=device-width"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{height:100%;margin:0}
  .leaflet-container{background:#e6edf2}
  .attribution{position:absolute;right:8px;bottom:8px;background:rgba(255,255,255,.85);padding:4px 6px;border-radius:6px;font:12px/1.2 system-ui,-apple-system,Roboto,Arial}
</style>
</head><body>
  <div id="map"></div>
  <div class="attribution">© OpenStreetMap contributors</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map=L.map('map',{zoomControl:true});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:''}).addTo(map);
    window.__setCoords=function(payload){
      try{
        const coords=(payload&&payload.coords)||[];
        if(!coords.length){map.setView([37.7749,-122.4194],12);return;}
        const line=L.polyline(coords,{weight:4}).addTo(map);
        map.fitBounds(line.getBounds(),{padding:[20,20]});
      }catch(e){console.error('setCoords error',e);}
    };
  </script>
</body></html>`;

export default function LeafletRouteMap({ coords, testID }: Props) {
  const [ready, setReady] = useState(false);
  const webref = useRef<WebViewType>(null);

  const pushCoords = useCallback(() => {
    if (!ready) return;
    const js = `window.__setCoords(${JSON.stringify({ coords })}); true;`;
    webref.current?.injectJavaScript(js);
  }, [ready, coords]);

  useEffect(() => {
    pushCoords();
  }, [pushCoords]);

  if (!coords.length) {
    return (
      <View style={S.center} testID={testID}>
        <ActivityIndicator />
        <Text>Preparing map…</Text>
      </View>
    );
  }

  return (
    <WebView
      ref={webref}
      originWhitelist={["*"]}
      source={{ html: HTML }}
      onLoadEnd={() => setReady(true)}
      onMessage={() => {}}
      style={{ flex: 1 }}
      testID={testID}
    />
  );
}

const S = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
});
