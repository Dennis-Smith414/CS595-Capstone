import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Image } from "react-native";
import { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";

export type LatLng = [number, number];

interface MapPayload { coords: LatLng[]; }

interface Waypoint {
  id: number;
  name: string;
  description?: string;
  lat: number;
  lon: number;
  type?: string;
}

interface LeafletMapProps {
  coordinates: LatLng[];
  center?: LatLng;
  zoom?: number;
  userLocation?: LatLng | null;
  onMapReady?: () => void;
  onMapLongPress?: (lat: number, lon: number) => void;
  waypoints?: Waypoint[];
  onWaypointPress?: (wp: Waypoint | null) => void;
}

const FALLBACK_CENTER: LatLng = [37.7749, -122.4194];
const DEFAULT_ZOOM = 13;

const LeafletMap: React.FC<LeafletMapProps> = ({
  coordinates,
  center = FALLBACK_CENTER,
  zoom = DEFAULT_ZOOM,
  userLocation = null,
  onMapReady,
  onMapLongPress,
  waypoints = [],
  onWaypointPress,
}) => {
  const webRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);
  const didSetInitialView = useRef(false);

  // --- bridge messages from the HTML ---
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const raw = event.nativeEvent.data;
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : null;
        if (!data) return;

        switch (data.type) {
          case "LOG":
            console.log("Map log:", data.msg);
            break;
          case "MAP_READY":
            setIsReady(true);
            onMapReady?.();
            break;
          case "LONG_PRESS":
            onMapLongPress?.(data.lat, data.lon);
            break;
          case "WAYPOINT_CLICK":
            if (data.waypoint) onWaypointPress?.(data.waypoint);
            break;
          case "MAP_TAP":
            onWaypointPress?.(null);
            break;
          default:
            console.log("Unrecognized message type:", data.type);
        }
      } catch (e) {
        console.error("LeafletMap: Message parse error:", e, raw);
      }
    },
    [onMapLongPress, onMapReady, onWaypointPress]
  );

  // --- set the initial view ONCE after MAP_READY ---
  useEffect(() => {
    if (!isReady || didSetInitialView.current) return;
    didSetInitialView.current = true;
    webRef.current?.injectJavaScript(`
      window.__setView(${center[0]}, ${center[1]}, ${zoom});
      true;
    `);
    // We intentionally do NOT depend on center/zoom to avoid recentering on every prop change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  // --- draw/clear the route (HTML calls fitBounds once) ---
  useEffect(() => {
    if (!isReady) return;
    if (coordinates && coordinates.length) {
      const payload: MapPayload = { coords: coordinates };
      webRef.current?.injectJavaScript(`
        window.__clearMap();
        window.__setCoords(${JSON.stringify(payload)});
        true;
      `);
    } else {
      webRef.current?.injectJavaScript(`window.__clearMap(); true;`);
    }
  }, [isReady, coordinates]);

  // --- update/remove the user marker (no recentering in HTML) ---
  useEffect(() => {
    if (!isReady) return;
    if (userLocation) {
      webRef.current?.injectJavaScript(`
        window.__setUserLocation(${userLocation[0]}, ${userLocation[1]});
        true;
      `);
    } else {
      webRef.current?.injectJavaScript(`window.__removeUserLocation(); true;`);
    }
  }, [isReady, userLocation]);

  // --- static icon URIs memoized to appease exhaustive-deps ---
  const iconUrls = useMemo(
    () => ({
      generic: Image.resolveAssetSource(require("../../assets/icons/waypoints/generic.png")).uri,
      water: Image.resolveAssetSource(require("../../assets/icons/waypoints/water.png")).uri,
      campsite: Image.resolveAssetSource(require("../../assets/icons/waypoints/campsite.png")).uri,
      roadAccess: Image.resolveAssetSource(require("../../assets/icons/waypoints/road-access-point.png")).uri,
      intersection: Image.resolveAssetSource(require("../../assets/icons/waypoints/intersection.png")).uri,
      hazard: Image.resolveAssetSource(require("../../assets/icons/waypoints/hazard.png")).uri,
      landmark: Image.resolveAssetSource(require("../../assets/icons/waypoints/landmark.png")).uri,
      parkingTrailhead: Image.resolveAssetSource(require("../../assets/icons/waypoints/parking-trailhead.png")).uri,
    }),
    []
  );

  // --- push waypoints + icons to the HTML ---
  useEffect(() => {
    if (!isReady) return;
    const payload = { waypoints: waypoints || [], iconUrls };
    webRef.current?.injectJavaScript(`
      try { window.__setWaypoints(${JSON.stringify(payload)}); true; }
      catch (err) { console.log('Error injecting waypoints', err); false; }
    `);
  }, [isReady, waypoints, iconUrls]);

  return (
    <WebView
      ref={webRef}
      originWhitelist={["*"]}
      source={require("./LeafletHTML.html")}
      onMessage={handleMessage}
      style={styles.flex}          // no inline styles → clears eslint warning
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      mixedContentMode="always"
    />
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default LeafletMap;
