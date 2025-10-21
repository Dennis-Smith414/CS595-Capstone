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

/* ============================ TYPES ============================ */
type RouteItem = { id: number; slug: string; name: string; region?: string };

type GeoGeometry =
  | { type: "LineString"; coordinates: number[][] }
  | { type: "MultiLineString"; coordinates: number[][][] };

type GeoFeature = { type: "Feature"; geometry: GeoGeometry; properties?: Record<string, any> };

type FeatureCollection = { type: "FeatureCollection"; features: GeoFeature[] };

type Waypoint = {
  id: number | string; // string for optimistic
  route_id: number;
  user_id?: number | null;
  name: string;
  description?: string | null;
  lat: number;
  lon: number;
  type?: string | null;
  created_at?: string;
  username?: string;
};

declare global {
  interface Window {
    L: any; // Leaflet injected via CDN
  }
}

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
  const j = await r.json();
  if (!r.ok || j.ok === false) throw new Error(j.error || `Failed waypoints (${r.status})`);
  return j.items || [];
}

async function createWaypoint(body: {
  route_id: number;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  description?: string;
}): Promise<Waypoint> {
  const r = await fetch(`${API}/api/waypoints`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok || j.ok === false) throw new Error(j.error || `Create waypoint failed (${r.status})`);
  return j.waypoint;
}

/* ================================= MAIN SHELL ================================= */
export default function WebApp() {
  const nav = useNavigate();

  // auth guard (belt & suspenders in case router missed it)
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
          {tab === "routes"
            ? "Select Routes"
            : tab === "map"
            ? "Map"
            : tab === "account"
            ? "My Account"
            : "File Manager"}
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
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const list = await fetchRouteList();
        if (alive) setRoutes(list);
      } catch (e: any) {
        if (alive) setErr(e.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

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
      <div style={{ display: "flex", gap: 12 }}>
        <button style={sx.primaryPill} onClick={() => alert("Upload Route (wire this to backend)")}>
          + Create / Upload Route
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

  // waypoints (by route id)
  const wpsByRouteRef = useRef<Record<number, Waypoint[]>>({});
  // chooser state
  const [chooser, setChooser] = useState<null | { x: number; y: number; lat: number; lon: number; routeId: number }>(
    null
  );

  // load Leaflet + map once
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
    });

    return () => {
      mapRef.current?.remove?.();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // draw (or re-draw) when map becomes ready OR selection changes
  useEffect(() => {
    if (!mapReady) return;

    (async () => {
      const L = (window as any).L;
      const map = mapRef.current;
      if (!L || !map) return;

      // clear previous layers
      layerRefs.current.forEach((lyr) => map.removeLayer(lyr));
      layerRefs.current = [];
      wpsByRouteRef.current = {};

      if (!selected.length) return;

      const bounds = L.latLngBounds([]);

      for (const id of selected) {
        try {
          // 1) fetch FeatureCollection and draw directly (route)
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

          // 2) load existing waypoints saved by mobile/backend
          const wps = await listWaypointsForRoute(id);
          wpsByRouteRef.current[id] = wps;

          for (const wp of wps) {
            const mk = L.marker([wp.lat, wp.lon], { icon: iconForType(wp.type || "generic"), title: wp.name })
              .addTo(map)
              .bindPopup(
                `<div style="font-family:system-ui">
                  <div style="font-weight:700">${escapeHtml(wp.name || wp.type || "Waypoint")}</div>
                  ${wp.username ? `<div style="color:#6b7a8c;font-size:12px">by ${escapeHtml(wp.username)}</div>` : ""}
                  ${
                    wp.description
                      ? `<div style="margin-top:6px">${escapeHtml(wp.description)}</div>`
                      : ""
                  }
                  <div style="color:#7b8a8c;font-size:12px;margin-top:6px">${wp.lat.toFixed(5)}, ${wp.lon.toFixed(
                    5
                  )}</div>
                </div>`
              );
            layerRefs.current.push(mk);
          }
        } catch (err) {
          console.warn("Failed to load route or waypoints", id, err);
        }
      }

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24] });
    })();
  }, [mapReady, selected]);

  // chooser actions
  async function handlePick(type: string) {
    if (!chooser || !mapRef.current) return;
    const L = (window as any).L;
    const map = mapRef.current;
    const { lat, lon, routeId } = chooser;
    setChooser(null);

    // optimistic marker
    const optimistic: Waypoint = {
      id: `tmp-${Date.now()}`,
      route_id: routeId,
      name: type,
      lat,
      lon,
      type,
    };
    const tempMarker = L.marker([lat, lon], {
      icon: iconForType(type),
      opacity: 0.7,
      title: type,
    })
      .addTo(map)
      .bindPopup(`<div style="font-family:system-ui">${type} (saving…)</div>`);
    layerRefs.current.push(tempMarker);

    try {
      const saved = await createWaypoint({
        route_id: routeId,
        name: type,
        lat,
        lon,
        type,
      });

      // replace temp popup content
      tempMarker.setOpacity(1);
      tempMarker.setPopupContent(
        `<div style="font-family:system-ui">
          <div style="font-weight:700">${escapeHtml(saved.name || saved.type || "Waypoint")}</div>
          <div style="color:#7b8a8c;font-size:12px;margin-top:6px">${saved.lat.toFixed(
            5
          )}, ${saved.lon.toFixed(5)}</div>
        </div>`
      );
    } catch (e: any) {
      // rollback
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
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 10, background: colorForType(t) }} />
              <span style={{ textTransform: "capitalize" }}>{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountScreen({ onLogout }: { onLogout: () => void }) {
  // (placeholder until /api/auth/me is wired)
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

/* ============================ MAP HELPERS ============================ */
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
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
