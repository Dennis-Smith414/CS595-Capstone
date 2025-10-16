import React, { useEffect, useMemo, useRef, useState } from "react";

/** ---------------- API utilities ---------------- */
const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (window as any).__API_BASE__ ||
  "http://localhost:5000";

type RouteItem = {
  id: number;
  slug: string;
  name: string;
  region?: string;
};

type GeoFeature = {
  type: "Feature";
  geometry:
    | { type: "LineString"; coordinates: number[][] }
    | { type: "MultiLineString"; coordinates: number[][][] };
  properties?: Record<string, any>;
};

async function fetchRouteList(): Promise<RouteItem[]> {
  const r = await fetch(`${API_BASE}/api/routes/list`);
  const text = await r.text();
  try {
    const j = JSON.parse(text);
    return Array.isArray(j?.items) ? j.items : [];
  } catch {
    console.warn("Bad JSON from /routes/list:", text);
    return [];
  }
}

async function fetchRouteGeo(id: number): Promise<GeoFeature> {
  const r = await fetch(`${API_BASE}/api/routes/${id}.geojson`);
  if (!r.ok) throw new Error(`geo ${r.status}`);
  return r.json();
}

/** ---------------- Small helpers ---------------- */
const toLatLng = (xy: number[]) => [xy[1], xy[0]] as [number, number];
function flattenToLatLng(geom: GeoFeature["geometry"]): [number, number][] {
  if (geom.type === "LineString") return geom.coordinates.map(toLatLng);
  // MultiLineString
  return geom.coordinates.flatMap((seg) => seg.map(toLatLng));
}

/** ---------------- Shell ---------------- */
type TabKey = "routes" | "map" | "account" | "files";

export default function Dashboard() {
  const [tab, setTab] = useState<TabKey>("routes");
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const toggleRouteId = (id: number) =>
    setSelectedRouteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <Logo />
        <NavButton label="Routes" active={tab === "routes"} onClick={() => setTab("routes")} />
        <NavButton label="Map" active={tab === "map"} onClick={() => setTab("map")} />
        <NavButton label="Account" active={tab === "account"} onClick={() => setTab("account")} />
        <NavButton label="Files" active={tab === "files"} onClick={() => setTab("files")} />
        <div style={{ marginTop: "auto", fontSize: 12, color: "#7b8a97" }}>
          API: <code>{API_BASE}</code>
        </div>
      </aside>

      <main style={S.content}>
        {tab === "routes" && (
          <RoutesPanel
            selected={selectedRouteIds}
            onToggle={toggleRouteId}
            onShowMap={() => setTab("map")}
          />
        )}
        {tab === "map" && <MapPanel selected={selectedRouteIds} />}
        {tab === "account" && <AccountPanel />}
        {tab === "files" && <FilesPanel />}
      </main>
    </div>
  );
}

/** ---------------- Left nav bits ---------------- */
function Logo() {
  return (
    <div style={{ display: "grid", gap: 6, marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 18, color: "#0B7285" }}>OpenCairn</div>
      <div style={{ fontSize: 12, color: "#7b8a97" }}>Web Console</div>
    </div>
  );
}
function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        ...S.navBtn,
        background: active ? "#0B7285" : "transparent",
        color: active ? "#fff" : "#102a43",
      }}
    >
      {label}
    </button>
  );
}

/** ---------------- Routes panel ---------------- */
function RoutesPanel({
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
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const list = await fetchRouteList();
        if (alive) setRoutes(list);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load");
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
        r.name.toLowerCase().includes(s) ||
        r.slug?.toLowerCase().includes(s) ||
        r.region?.toLowerCase().includes(s)
    );
  }, [routes, q]);

  return (
    <section style={S.panel}>
      <header style={S.panelHeader}>
        <h2 style={{ margin: 0 }}>Select Routes</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Search routes…"
            style={S.search}
          />
          <button
            onClick={onShowMap}
            disabled={selected.length === 0}
            style={{ ...S.cta, opacity: selected.length ? 1 : 0.6 }}
          >
            Show on Map
          </button>
        </div>
      </header>

      {loading ? (
        <div style={S.center}>Loading…</div>
      ) : err ? (
        <div style={{ ...S.center, color: "#c92a2a" }}>Error: {err}</div>
      ) : filtered.length === 0 ? (
        <div style={S.center}>No routes found.</div>
      ) : (
        <div style={S.list}>
          {filtered.map((r) => {
            const isSelected = selected.includes(r.id);
            return (
              <button
                key={r.id}
                onClick={() => onToggle(r.id)}
                style={{
                  ...S.card,
                  borderColor: isSelected ? "#0B7285" : "#e1e8f0",
                  background: isSelected ? "#e6fcf5" : "#fff",
                }}
                aria-pressed={isSelected}
              >
                <div style={{ fontWeight: 600 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: "#7b8a97" }}>
                  {r.region || r.slug || "—"}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** ---------------- Map panel ---------------- */
function MapPanel({ selected }: { selected: number[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null); // Leaflet map instance
  const layerRefs = useRef<any[]>([]);

  useEffect(() => {
    // lazy-load Leaflet from CDN for zero-config
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    document.body.appendChild(script);

    script.onload = () => {
      const L = (window as any).L;
      if (!L || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "",
      }).addTo(map);

      map.setView([37.7749, -122.4194], 12); // default SF
    };

    return () => {
      mapRef.current?.remove?.();
      mapRef.current = null;
    };
  }, []);

  // Load/overlay selected routes
  useEffect(() => {
    (async () => {
      const L = (window as any).L;
      const map = mapRef.current;
      if (!L || !map) return;

      // clear previous layers
      layerRefs.current.forEach((lyr) => map.removeLayer(lyr));
      layerRefs.current = [];

      if (selected.length === 0) return;

      const allCoords: [number, number][][] = [];
      for (const id of selected) {
        try {
          const f = await fetchRouteGeo(id);
          const coords = flattenToLatLng(f.geometry);
          allCoords.push(coords);
          const poly = L.polyline(coords, { weight: 4, color: "#0B7285" }).addTo(map);
          layerRefs.current.push(poly);
        } catch (e) {
          console.warn("geo fail", id, e);
        }
      }

      // fit bounds of all
      const flat = allCoords.flat();
      if (flat.length) {
        const bounds = (window as any).L.latLngBounds(flat);
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    })();
  }, [selected]);

  return (
    <section style={S.panel}>
      <header style={S.panelHeader}>
        <h2 style={{ margin: 0 }}>Map</h2>
      </header>
      <div ref={containerRef} style={S.map} />
      <div style={S.attribution}>© OpenStreetMap contributors</div>
    </section>
  );
}

/** ---------------- Account panel ---------------- */
function AccountPanel() {
  // You can wire this to your real /api/users/me endpoint.
  const [summary, setSummary] = useState<{ username: string; routes: number; distanceKm: number }>();

  useEffect(() => {
    // demo data
    setSummary({ username: "demo", routes: 12, distanceKm: 134.5 });
  }, []);

  return (
    <section style={S.panel}>
      <header style={S.panelHeader}>
        <h2 style={{ margin: 0 }}>Account</h2>
      </header>

      {!summary ? (
        <div style={S.center}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <Stat label="User" value={summary.username} />
          <Stat label="Routes" value={String(summary.routes)} />
          <Stat label="Distance" value={`${summary.distanceKm.toFixed(1)} km`} />
        </div>
      )}
    </section>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={S.stat}>
      <div style={{ fontSize: 12, color: "#7b8a97" }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>{value}</div>
    </div>
  );
}

/** ---------------- Files panel ---------------- */
function FilesPanel() {
  const [files, setFiles] = useState<{ name: string; size: number }[]>([]);

  const onPick = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    // You can POST to your server (e.g., /api/files) here.
    setFiles((prev) => [{ name: f.name, size: f.size }, ...prev]);
  };

  return (
    <section style={S.panel}>
      <header style={S.panelHeader}>
        <h2 style={{ margin: 0 }}>Files</h2>
        <label style={{ ...S.cta, cursor: "pointer" }}>
          Upload GPX
          <input type="file" accept=".gpx" onChange={onPick} style={{ display: "none" }} />
        </label>
      </header>

      {files.length === 0 ? (
        <div style={S.center}>No files yet.</div>
      ) : (
        <div style={S.list}>
          {files.map((f, i) => (
            <div key={i} style={S.card}>
              <div style={{ fontWeight: 600 }}>{f.name}</div>
              <div style={{ fontSize: 12, color: "#7b8a97" }}>{(f.size / 1024).toFixed(1)} KB</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** ---------------- Styles (plain objects) ---------------- */
const S: Record<string, React.CSSProperties> = {
  app: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    height: "100vh",
    background: "#f7f9fc",
    color: "#102a43",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 16,
    borderRight: "1px solid #e1e8f0",
    background: "#ffffff",
  },
  navBtn: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid transparent",
    textAlign: "left" as const,
    fontWeight: 600,
    cursor: "pointer",
  },
  content: {
    padding: 16,
    overflow: "auto",
  },
  panel: {
    height: "100%",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 12,
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  search: {
    border: "1px solid #e1e8f0",
    borderRadius: 10,
    padding: "8px 10px",
    minWidth: 220,
  },
  cta: {
    background: "#0B7285",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "8px 12px",
    fontWeight: 700,
  },
  list: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 12,
    alignContent: "start",
  },
  card: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid #e1e8f0",
    background: "#fff",
    display: "grid",
    gap: 6,
    textAlign: "left" as const,
  },
  center: {
    display: "grid",
    placeItems: "center",
    color: "#7b8a97",
  },
  map: {
    width: "100%",
    height: "calc(100vh - 110px)",
    background: "#e6edf2",
    borderRadius: 12,
    border: "1px solid #e1e8f0",
  },
  attribution: {
    position: "absolute",
    right: 18,
    bottom: 18,
    background: "rgba(255,255,255,.9)",
    border: "1px solid #e1e8f0",
    padding: "4px 6px",
    borderRadius: 6,
    fontSize: 12,
  },
  stat: {
    border: "1px solid #e1e8f0",
    borderRadius: 12,
    background: "#fff",
    padding: 14,
  },
};
