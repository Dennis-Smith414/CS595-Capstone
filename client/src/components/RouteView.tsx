// src/components/RouteView.tsx
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import L, { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

const API =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (window as any).__API_BASE__ ||
  "http://localhost:5000"; // backend base

export default function RouteView() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();

  // derive ids: prefer :id, then ?ids=1,2, then localStorage
  const ids = useMemo(() => {
    if (id) return [Number(id)].filter(Number.isFinite);
    const qs = new URLSearchParams(location.search).get("ids");
    if (qs) return qs.split(",").map((s) => Number(s)).filter(Number.isFinite);
    try {
      const fromLs = JSON.parse(localStorage.getItem("selectedRouteIds") || "[]");
      if (Array.isArray(fromLs)) return fromLs.map(Number).filter(Number.isFinite);
    } catch {}
    return [];
  }, [id, location.search]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<LayerGroup | null>(null);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([37.78, -122.4], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    // a group to manage drawn layers
    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      layersRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // load ids whenever they change
  useEffect(() => {
    const map = mapRef.current;
    const group = layersRef.current;
    if (!map || !group) return;

    // clear previous layers
    group.clearLayers();

    if (!ids.length) return; // nothing to draw

    (async () => {
      const bounds = L.latLngBounds([]);

      for (const rid of ids) {
        const url = `${API}/api/routes/${rid}.geojson`;
        const res = await fetch(url);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          // helps debug wrong path (HTML 200)
          const text = await res.text();
          throw new Error(`Non-JSON from ${url} (${res.status}): ${text.slice(0, 120)}`);
        }
        const fc = await res.json();

        const layer = L.geoJSON(fc, {
          style: { weight: 4, color: "blue" },
        }).addTo(group);

        try {
          const b = layer.getBounds();
          if (b.isValid()) bounds.extend(b);
        } catch {}
      }

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    })().catch((e) => console.error(e));
  }, [ids]);

  return <div ref={containerRef} style={{ height: "100vh" }} />;
}
