import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ============================ STYLES ============================ */
const sx: Record<string, React.CSSProperties> = {
  app: {
    display: "grid",
    gridTemplateRows: "72px 1fr 72px",
    height: "100vh",
    background: "#f7fafc",
    color: "#102a43",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  },
  header: {
    display: "grid",
    alignContent: "center",
    justifyContent: "center",
    borderBottom: "1px solid #e6eaf0",
    background: "#fff",
  },
  h1: { margin: 0, fontWeight: 800, fontSize: 28, letterSpacing: 0.2 },
  content: { padding: 16, overflow: "auto" },

  tabbar: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    borderTop: "1px solid #e6eaf0",
    background: "#fff",
  },
  tabBtn: {
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: 4,
    padding: "10px 0",
    border: "none",
    background: "transparent",
    color: "#6b7a8c",
    cursor: "pointer",
    fontWeight: 600,
  },
  tabBtnActive: { color: "#0ec1ac" },
  icon: { width: 24, height: 24 },

  primary: {
    background: "#0ec1ac",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryAlt: {
    background: "#6b7a8c",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
  },
  primaryPill: {
    background: "#77c9bd",
    color: "#fff",
    border: "none",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },
  search: {
    flex: 1,
    minWidth: 200,
    border: "1px solid #e6eaf0",
    borderRadius: 999,
    padding: "10px 14px",
    outline: "none",
  },
  listGrid: {
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    alignContent: "start",
  },
  listItem: {
    position: "relative",
    padding: 16,
    borderRadius: 14,
    border: "2px solid #e6eaf0",
    background: "#fff",
    textAlign: "left",
    display: "grid",
    gap: 8,
  },
  radioOuter: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "2px solid #0ec1ac",
    display: "grid",
    placeItems: "center",
    background: "#fff",
  },
  radioDot: { width: 12, height: 12, borderRadius: 999, background: "#0ec1ac", transition: "opacity .15s ease" },

  mapWrap: { position: "relative" },
  map: {
    width: "100%",
    height: "calc(100vh - 72px - 72px - 24px)",
    borderRadius: 16,
    border: "1px solid #e6eaf0",
    background: "#e6edf2",
  },
  mapBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    background: "rgba(255,255,255,.9)",
    border: "1px solid #e6eaf0",
    padding: "6px 8px",
    borderRadius: 8,
    fontSize: 12,
  },
  chooser: {
    position: "fixed",
    transform: "translate(-50%,-110%)",
    background: "#fff",
    border: "1px solid #e6eaf0",
    borderRadius: 12,
    padding: 8,
    boxShadow: "0 8px 24px rgba(16,42,67,0.15)",
    display: "grid",
    gridTemplateColumns: "repeat(3, auto)",
    gap: 6,
    zIndex: 1000,
  } as React.CSSProperties,

  cardTitle: { margin: 0, fontWeight: 800, fontSize: 16 },
};

/* =============================== ICONS =============================== */
const Icons = {
  routes: (
    <svg width="24" height="24" viewBox="0 0 24 24" style={sx.icon}>
      <path d="M5 6h14M5 12h14M5 18h14" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  compass: (
    <svg width="24" height="24" viewBox="0 0 24 24" style={sx.icon}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M10 14l2-6 2 6-6-2 6-2" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  account: (
    <svg width="24" height="24" viewBox="0 0 24 24" style={sx.icon}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M4 20c2-4 14-4 16 0" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
  folder: (
    <svg width="24" height="24" viewBox="0 0 24 24" style={sx.icon}>
      <path d="M3 6h6l2 2h10v10H3z" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  ),
};

/* ============================ ENV / HELPERS ============================ */
const API =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (window as any)?.__API_BASE__ ||
  "http://localhost:5000";

const authHeader = (): Record<string, string> => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const DEBUG_API = false;

async function requestJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();
  const json = ct.includes("application/json") ? (raw ? JSON.parse(raw) : {}) : {};
  if (DEBUG_API) console.log("[requestJson]", { url, status: res.status, ok: res.ok, json, raw: ct ? undefined : raw });
  return { res, json, raw };
}

/* ============================ TYPES ============================ */
type RouteItem = { id: number; slug: string; name: string; region?: string };

type GeoGeometry =
  | { type: "LineString"; coordinates: number[][] }
  | { type: "MultiLineString"; coordinates: number[][][] };

type GeoFeature = { type: "Feature"; geometry: GeoGeometry; properties?: Record<string, any> };

type FeatureCollection = { type: "FeatureCollection"; features: GeoFeature[] };

type Waypoint = {
  id: number | string;
  route_id: number;
  user_id?: number | null;
  name: string;
  description?: string | null;
  lat: number;
  lon: number;
  type?: string | null;
  created_at?: string;
  username?: string;
  votes?: number;
  vote_count?: number;
  distance_mi?: number;
};

/* ============================ API CALLS ============================ */
async function fetchRouteList(): Promise<RouteItem[]> {
  const r = await fetch(`${API}/api/routes/list`, { headers: authHeader() });
  const txt = await r.text();
  try {
    const j = JSON.parse(txt);
    return Array.isArray(j?.items) ? j.items : [];
  } catch {
    console.warn("Bad JSON from /api/routes/list:", txt);
    return [];
  }
}

async function fetchRouteGeoFC(id: number): Promise<FeatureCollection> {
  const r = await fetch(`${API}/api/routes/${id}.geojson`, { headers: authHeader() });
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const body = await r.text();
    throw new Error(`Non-JSON from ${r.url} (${r.status}): ${body.slice(0, 120)}`);
  }
  if (!r.ok) throw new Error(`geo ${r.status}`);
  return r.json();
}

async function listWaypointsForRoute(routeId: number): Promise<Waypoint[]> {
  const r = await fetch(`${API}/api/waypoints/route/${routeId}`, { headers: authHeader() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `Failed waypoints (${r.status})`);
  return j.items || j.waypoints || [];
}

/** Robust createWaypoint: tries common endpoints + payload keys. */
async function createWaypoint(body: {
  route_id: number;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  description?: string;
}): Promise<Waypoint> {
  const headers = { "Content-Type": "application/json", ...authHeader() };

  const snake = {
    route_id: body.route_id, name: body.name, lat: body.lat, lon: body.lon,
    ...(body.type ? { type: body.type } : {}),
    ...(body.description ? { description: body.description } : {})
  };
  const camel = {
    routeId: body.route_id, name: body.name, lat: body.lat, lon: body.lon,
    ...(body.type ? { type: body.type } : {}),
    ...(body.description ? { description: body.description } : {})
  };

  const variants: Array<{url:string; payload:any; pick:(j:any)=>Waypoint|null}> = [
    { url: `${API}/api/waypoints`, payload: snake, pick: (j)=> j?.waypoint ?? j?.item ?? null },
    { url: `${API}/api/waypoints`, payload: camel, pick: (j)=> j?.waypoint ?? j?.item ?? null },
    { url: `${API}/api/routes/${body.route_id}/waypoints`, payload: snake, pick: (j)=> j?.waypoint ?? j?.item ?? null },
    { url: `${API}/api/users/me/waypoints`, payload: snake, pick: (j)=> j?.waypoint ?? j?.item ?? null },
  ];

  let lastErr: Error | null = null;
  for (const v of variants) {
    try {
      const { res, json } = await requestJson(v.url, { method:"POST", headers, body: JSON.stringify(v.payload) });
      if (res.status === 404 || res.status === 405) continue;
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Create waypoint failed (${res.status})`);
      const picked = v.pick(json);
      if (picked) return picked;
      if (typeof json?.id !== "undefined" && typeof json?.lat !== "undefined" && typeof json?.lon !== "undefined") {
        return json as Waypoint;
      }
      continue;
    } catch (e:any) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      continue;
    }
  }
  throw lastErr || new Error("Create waypoint failed (no matching endpoint)");
}

/** Robust upvote: tries multiple paths and payload keys. */
// keep your API + authHeader
const headersJSON = { "Content-Type": "application/json", ...authHeader() };

async function tryJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();
  const json = ct.includes("application/json") && raw ? JSON.parse(raw) : {};
  return { res, json, raw };
}

/** Tries multiple endpoints/payloads for voting. Returns total votes or null. */
async function upvoteWaypointResilient(id: number) {
  const variants = [
    { url: `${API}/api/ratings/waypoint/${id}`, payload: { value: 1 } }, // singular + value
    { url: `${API}/api/ratings/waypoints/${id}`, payload: { value: 1 } }, // plural + value
    { url: `${API}/api/ratings/waypoint/${id}`, payload: { val: 1 } },    // singular + val
    { url: `${API}/api/waypoints/${id}/rate`, payload: { value: 1 } },    // alt path
    { url: `${API}/api/ratings`, payload: { waypoint_id: id, value: 1 } } // flat collection
  ];

  let lastErr: any = null;
  for (const v of variants) {
    try {
      const { res, json } = await tryJson(v.url, {
        method: "POST",
        headers: headersJSON,
        body: JSON.stringify(v.payload),
      });
      if (res.status === 404 || res.status === 405) continue;
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Vote failed (${res.status})`);
      console.info("[upvoteWaypoint] using", v.url);
      return typeof json?.votes === "number"
        ? json.votes
        : typeof json?.vote_count === "number"
        ? json.vote_count
        : null;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Vote failed (no matching endpoint)");
}

/** Tries multiple create-waypoint variants and returns the created waypoint. */
async function createWaypointResilient(body: {
  route_id: number; name: string; lat: number; lon: number; type?: string; description?: string;
}) {
  const snake = { route_id: body.route_id, name: body.name, lat: body.lat, lon: body.lon, ...(body.type ? {type: body.type}:{}), ...(body.description ? {description: body.description}:{}) };
  const camel = { routeId: body.route_id, name: body.name, lat: body.lat, lon: body.lon, ...(body.type ? {type: body.type}:{}), ...(body.description ? {description: body.description}:{}) };

  const variants = [
    { url: `${API}/api/waypoints`, payload: snake },
    { url: `${API}/api/waypoints`, payload: camel },
    { url: `${API}/api/routes/${body.route_id}/waypoints`, payload: snake },
    { url: `${API}/api/routes/${body.route_id}/waypoints`, payload: camel },
  ];

  let lastErr: any = null;
  for (const v of variants) {
    try {
      const { res, json } = await tryJson(v.url, {
        method: "POST",
        headers: headersJSON,
        body: JSON.stringify(v.payload),
      });
      if (res.status === 404 || res.status === 405) continue;
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Create waypoint failed (${res.status})`);
      const wp = json?.waypoint ?? json?.item ?? json;
      if (wp?.lat != null && wp?.lon != null) {
        console.info("[createWaypoint] using", v.url);
        return wp;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Create waypoint failed (no matching endpoint)");
}


/** Upload GPX to create/update a route. */
async function uploadRouteGPX(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const { res, json, raw } = await requestJson(`${API}/api/routes/upload`, {
    method: "POST",
    headers: { ...authHeader() }, // DO NOT set Content-Type; browser will
    body: fd as any,
  });
  if (!res.ok || json?.ok === false) throw new Error(json?.error || `Upload failed (${res.status})`);
  // expected: { ok:true, id, slug, name }
  return json as { ok: true; id: number; slug: string; name: string; region?: string };
}

/* ================================= MAIN SHELL ================================= */
export default function WebApp() {
  const nav = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem("token")) nav("/login", { replace: true });
  }, [nav]);

  const [tab, setTab] = useState<"routes" | "map" | "account" | "files">("routes");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const toggleId = (id: number) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div style={sx.app}>
      <div style={sx.header}>
        <h1 style={sx.h1}>
          {tab === "routes" ? "Select Routes" : tab === "map" ? "Map" : tab === "account" ? "My Account" : "File Manager"}
        </h1>
      </div>

      <div style={sx.content}>
        {tab === "routes" && (
          <RoutesScreen selected={selectedIds} onToggle={toggleId} onShowMap={() => setTab("map")} />
        )}
        {tab === "map" && <MapScreen selected={selectedIds} />}
        {tab === "account" && (
          <AccountScreen
            onLogout={() => {
              localStorage.removeItem("token");
              nav("/login", { replace: true });
            }}
          />
        )}
        {tab === "files" && <FilesScreen />}
      </div>

      <nav style={sx.tabbar}>
        <TabBtn label="Routes" active={tab === "routes"} onClick={() => setTab("routes")} icon={Icons.routes} />
        <TabBtn label="Map" active={tab === "map"} onClick={() => setTab("map")} icon={Icons.compass} />
        <TabBtn label="Account" active={tab === "account"} onClick={() => setTab("account")} icon={Icons.account} />
        <TabBtn label="Files" active={tab === "files"} onClick={() => setTab("files")} icon={Icons.folder} />
      </nav>
    </div>
  );
}

/* ================================== SCREENS ================================== */
function RoutesScreen({
  selected,
  onToggle,
  onShowMap,
}: {
  selected: number[];
  onToggle: (id: number) => void;
  onShowMap: () => void;
}) {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function loadRoutes() {
    setLoading(true);
    setErr("");
    try {
      const list = await fetchRouteList();
      setRoutes(list);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoutes();
  }, []);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const created = await uploadRouteGPX(file);
      setRoutes((prev) => [
        { id: created.id, slug: created.slug, name: created.name, region: created.region },
        ...prev,
      ]);
      alert(`Uploaded: ${created.name}`);
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return routes;
    return routes.filter(
      (r) =>
        r.name?.toLowerCase().includes(s) ||
        r.slug?.toLowerCase().includes(s) ||
        r.region?.toLowerCase().includes(s)
    );
  }, [routes, q]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <input
        ref={fileRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        style={{ display: "none" }}
        onChange={onPickFile}
      />

      <div style={{ display: "flex", gap: 12 }}>
        <button
          style={sx.primaryPill}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload a .gpx file to create/update a route"
        >
          {uploading ? "Uploading…" : "+ Upload GPX"}
        </button>

        <input
          placeholder="Search routes…"
          value={q}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
          style={sx.search}
        />

        <button
          onClick={onShowMap}
          disabled={selected.length === 0}
          style={{ ...sx.primary, opacity: selected.length ? 1 : 0.6 }}
        >
          Show on Map
        </button>

        <button onClick={loadRoutes} style={sx.primaryAlt} aria-label="Refresh route list">
          Refresh
        </button>
      </div>

      {loading ? (
        <Card center>Loading…</Card>
      ) : err ? (
        <Card center style={{ color: "#c92a2a" }}>
          Error: {err}
        </Card>
      ) : filtered.length === 0 ? (
        <Card center>No routes found.</Card>
      ) : (
        <div style={sx.listGrid}>
          {filtered.map((r) => {
            const isSelected = selected.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id)}
                style={{
                  ...sx.listItem,
                  borderColor: isSelected ? "#0ec1ac" : "#e6eaf0",
                  background: isSelected ? "#e6fcf5" : "#fff",
                }}
                aria-pressed={isSelected}
              >
                <div style={{ fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "#7b8a97" }}>{r.region || r.slug || "—"}</div>
                <div style={sx.radioOuter}>
                  <div style={{ ...sx.radioDot, opacity: isSelected ? 1 : 0 }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MapScreen({ selected }: { selected: number[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRefs = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const [chooser, setChooser] = useState<null | { x: number; y: number; lat: number; lon: number; routeId: number }>(
    null
  );

  // load Leaflet via CDN
  useEffect(() => {
    const ensureLeaflet = () =>
      new Promise<void>((resolve) => {
        if ((window as any).L) return resolve();

        const cssId = "leaflet-css";
        if (!document.getElementById(cssId)) {
          const css = document.createElement("link");
          css.id = cssId;
          css.rel = "stylesheet";
          css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(css);
        }

        const jsId = "leaflet-js";
        if (!document.getElementById(jsId)) {
          const s = document.createElement("script");
          s.id = jsId;
          s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload = () => resolve();
          document.body.appendChild(s);
        } else {
          resolve();
        }
      });

    ensureLeaflet().then(() => {
      const L = (window as any).L;
      if (!L || !containerRef.current) return;

      const map = L.map(containerRef.current, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "",
      }).addTo(map);

      map.setView([37.7749, -122.4194], 12);
      setMapReady(true);
      ensureWaypointCSS();
    });

    return () => {
      mapRef.current?.remove?.();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // draw on selection
  useEffect(() => {
    if (!mapReady) return;

    (async () => {
      const L = (window as any).L;
      const map = mapRef.current;
      if (!L || !map) return;

      layerRefs.current.forEach((lyr) => map.removeLayer(lyr));
      layerRefs.current = [];

      if (!selected.length) return;

      const bounds = L.latLngBounds([]);

      for (const id of selected) {
        try {
          // draw route
          const fc = await fetchRouteGeoFC(id);
          const routeLayer = L.geoJSON(fc, {
            style: { weight: 4, color: "#0ec1ac" },
            onEachFeature: (_feature: any, lyr: any) => {
              lyr.on("click", (e: any) => {
                const { lat, lng } = e.latlng;
                const { clientX, clientY } = e.originalEvent || {};
                setChooser({ x: clientX, y: clientY, lat, lon: lng, routeId: id });
              });
            },
          }).addTo(map);
          layerRefs.current.push(routeLayer);

          const b = routeLayer.getBounds?.();
          if (b && b.isValid()) bounds.extend(b);

          // waypoints
          const wps = await listWaypointsForRoute(id);
          for (const wp of wps) {
            const mk = L.marker([wp.lat, wp.lon], { icon: iconForType(wp.type || "generic"), title: wp.name })
              .addTo(map)
              .bindPopup(waypointPopupHTML(wp));

            mk.on("popupopen", (e: any) => wirePopupHandlers(e, wp));
            layerRefs.current.push(mk);
          }
        } catch (err) {
          console.warn("Failed to load route or waypoints", id, err);
        }
      }

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
    })();
  }, [mapReady, selected]);

  // pick type and create waypoint
  async function handlePick(type: string) {
    if (!chooser || !mapRef.current) return;
    const L = (window as any).L;
    const map = mapRef.current;
    const { lat, lon, routeId } = chooser;
    setChooser(null);

    const tempMarker = L.marker([lat, lon], {
      icon: iconForType(type),
      opacity: 0.7,
      title: type,
    })
      .addTo(map)
      .bindPopup(`<div style="font-family:system-ui">${escapeHtml(type)} (saving…)</div>`);
    layerRefs.current.push(tempMarker);

    try {
      const saved = await createWaypoint({ route_id: routeId, name: type, lat, lon, type });
      tempMarker.setOpacity(1);
      tempMarker.setPopupContent(waypointPopupHTML(saved));
      tempMarker.off("popupopen");
      tempMarker.on("popupopen", (e: any) => wirePopupHandlers(e, saved));
    } catch (e: any) {
      map.removeLayer(tempMarker);
      alert(e?.message || "Failed to save waypoint");
    }
  }

  return (
    <div style={sx.mapWrap}>
      <div ref={containerRef} style={sx.map} />
      {!selected.length && <div style={sx.mapBadge}>Select a route on the Routes tab, then come back here.</div>}

      {chooser && (
        <div
          style={{ ...sx.chooser, top: chooser.y, left: chooser.x }}
          onMouseLeave={() => setChooser(null)}
          onWheel={(e) => e.stopPropagation()}
        >
          {["water", "rest", "bathroom", "campsite", "hazard", "landmark"].map((t) => (
            <button
              key={t}
              onClick={() => handlePick(t)}
              style={{
                border: "1px solid #e6eaf0",
                background: "#fff",
                padding: "6px 10px",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: 10,
                  background: colorForType(t),
                }}
              />
              <span style={{ textTransform: "capitalize" }}>{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountScreen({ onLogout }: { onLogout: () => void }) {
  const [me] = useState({ username: "DemoUser", email: "demo@example.com" });

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 520, margin: "0 auto" }}>
      <Card>
        <h3 style={sx.cardTitle}>My Account</h3>
        <Row label="Username" value={me.username} />
        <Row label="Email" value={me.email} />
      </Card>

      <Card>
        <h3 style={sx.cardTitle}>Profile Statistics</h3>
        <Row label="Cairns created" value="12" />
        <Row label="Comments written" value="14" />
        <Row label="Ratings given" value="34" />
        <Row label="Member since" value="August 9, 2025" />
      </Card>

      <button onClick={onLogout} style={{ ...sx.primary, width: 280, justifySelf: "center" }}>
        Log Out
      </button>
    </div>
  );
}

function FilesScreen() {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
      <div style={{ fontSize: 28, color: "#6b7a8c" }}>File Manager Screen</div>
    </div>
  );
}

/* ================================== UI Bits ================================== */
function Card({
  children,
  center = false,
  style,
}: {
  children: React.ReactNode;
  center?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        border: "1px solid #e6eaf0",
        background: "#fff",
        boxShadow: "0 2px 6px rgba(16,42,67,0.06)",
        ...(center ? { display: "grid", placeItems: "center", color: "#6b7a8c" } : {}),
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
      <div style={{ color: "#6b7a8c" }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function TabBtn({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button onClick={onClick} style={{ ...sx.tabBtn, ...(active ? sx.tabBtnActive : {}) }}>
      <span style={{ display: "grid", placeItems: "center" }}>{icon}</span>
      <span style={{ fontSize: 12 }}>{label}</span>
    </button>
  );
}

/* ============================ POPUP + MAP HELPERS ============================ */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
}

function ensureWaypointCSS() {
  const id = "wp-popup-css";
  if (document.getElementById(id)) return;
  const css = `
  .wp-card { display:grid; grid-template-columns: 1fr auto; gap:8px; padding:10px; border-radius:12px; }
  .wp-left { display:grid; gap:4px; min-width:220px; }
  .wp-title { font-weight:800; font-size:14px; color:#0f172a; margin:0; }
  .wp-desc { font-size:12px; color:#475569; line-height:1.3; max-width:280px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .wp-footer { font-size:11px; color:#64748b; margin-top:4px; }
  .wp-right { display:grid; align-content:center; justify-items:center; gap:4px; padding-left:10px; }
  .wp-up { background:#e2f8f5; border:1px solid #0ec1ac; color:#0ec1ac; width:28px; height:28px; border-radius:6px; display:grid; place-items:center; cursor:pointer; }
  .wp-up:hover { background:#d6f4f0; }
  .wp-count { font-weight:800; font-size:12px; color:#0f172a; }
  .wp-avatar { width:18px; height:18px; border-radius:999px; display:inline-grid; place-items:center; background:#f1f5f9; margin-right:6px; font-size:12px; }
  `;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

function fmtDate(iso?: string) {
  try {
    return iso ? new Date(iso).toLocaleDateString() : "";
  } catch {
    return "";
  }
}
function shortDesc(s?: string | null) {
  if (!s) return "";
  const t = String(s).trim();
  return t.length > 160 ? t.slice(0, 157) + "…" : t;
}
function emojiForType(t?: string | null) {
  const k = (t || "").toLowerCase();
  if (k.includes("water")) return "💧";
  if (k.includes("rest") || k.includes("bath")) return "🚻";
  if (k.includes("camp")) return "🏕️";
  if (k.includes("hazard")) return "⚠️";
  if (k.includes("landmark")) return "📍";
  return "🚶";
}
function waypointPopupHTML(wp: any) {
  const name = wp.name || wp.type || "Waypoint";
  const desc = shortDesc(wp.description);
  const date = fmtDate(wp.created_at);
  const who = wp.username ? ` • ${wp.username}` : "";
  const dist = wp.distance_mi ? ` • ${Number(wp.distance_mi).toFixed(2)} mi` : "";
  const vote = Number(wp.votes || wp.vote_count || 0);

  return `
    <div class="wp-card" data-wp-id="${wp.id}">
      <div class="wp-left">
        <div class="wp-title">${escapeHtml(name)}</div>
        ${desc ? `<div class="wp-desc">${escapeHtml(desc)}</div>` : ""}
        <div class="wp-footer">
          <span class="wp-avatar">${emojiForType(wp.type)}</span>
          ${date}${who}${dist}
        </div>
      </div>
      <div class="wp-right">
        <button class="wp-up" title="Upvote" data-action="upvote">⬆</button>
        <div class="wp-count" data-role="count">${vote}</div>
      </div>
    </div>
  `;
}

/** Attach handlers when a popup opens. */
function wirePopupHandlers(e: any, wp: Waypoint) {
  const container: HTMLElement | null = e?.popup?.getElement?.() || null;
  if (!container) return;

  // add inline comment form (once)
  if (!container.querySelector("[data-role='cform']")) {
    const form = document.createElement("div");
    form.setAttribute("data-role", "cform");
    form.innerHTML = `
      <div style="display:grid; gap:6px; margin-top:8px;">
        <textarea rows="2" placeholder="Add a comment…" style="resize:vertical; border:1px solid #e6eaf0; border-radius:8px; padding:6px;"></textarea>
        <button data-action="comment" style="justify-self:end; border:1px solid #0ec1ac; background:#0ec1ac; color:#fff; border-radius:8px; padding:6px 10px; cursor:pointer;">Post</button>
      </div>`;
    container.querySelector(".wp-left")?.appendChild(form);
  }

  // upvote
  const upBtn = container.querySelector("[data-action='upvote']") as HTMLButtonElement | null;
  const countEl = container.querySelector("[data-role='count']") as HTMLElement | null;
  upBtn?.addEventListener(
    "click",
    async () => {
      if (!upBtn) return;
      upBtn.disabled = true;
      try {
        const total = await upvoteWaypoint(Number(wp.id));
        if (countEl) {
          countEl.textContent =
            typeof total === "number" ? String(total) : String(Number(countEl.textContent || "0") + 1);
        }
      } catch (err: any) {
        alert(err?.message || "Vote failed");
      } finally {
        upBtn.disabled = false;
      }
    },
    { once: true }
  );

  // comment
  const postBtn = container.querySelector("[data-action='comment']") as HTMLButtonElement | null;
  const textarea = container.querySelector("textarea") as HTMLTextAreaElement | null;
  postBtn?.addEventListener(
    "click",
    async () => {
      const text = (textarea?.value || "").trim();
      if (!text) return;
      if (!postBtn) return;
      postBtn.disabled = true;
      try {
        await addWaypointComment(Number(wp.id), text);
        if (textarea) textarea.value = "";
        postBtn.textContent = "Posted!";
        setTimeout(() => (postBtn.textContent = "Post"), 900);
      } catch (err: any) {
        alert(err?.message || "Comment failed");
        postBtn.disabled = false;
      }
    },
    { once: true }
  );
}

function colorForType(t: string) {
  return t === "water"
    ? "#3b82f6"
    : t === "rest" || t === "bathroom"
    ? "#10b981"
    : t === "campsite"
    ? "#f59e0b"
    : t === "hazard"
    ? "#ef4444"
    : t === "landmark"
    ? "#8b5cf6"
    : "#64748b";
}
function iconForType(t: string) {
  const L = (window as any).L;
  const color = colorForType(t);
  return L.divIcon({
    className: "wp-dot",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}
