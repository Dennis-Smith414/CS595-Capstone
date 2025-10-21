// src/components/RouteView.tsx
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import L, { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

/* ============================ ENV / AUTH ============================ */
const API =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (window as any).__API_BASE__ ||
  "http://localhost:5000";

const authHeader = (): Record<string, string> => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const headersJSON = { "Content-Type": "application/json", ...authHeader() };

/* ============================ STYLE INJECTION ============================ */
function ensureWaypointCSS() {
  const id = "wp-popup-css";
  if (document.getElementById(id)) return;
  const css = `
  .wp-card { display:grid; grid-template-columns: 1fr auto; gap:8px; padding:10px; border-radius:12px; }
  .wp-left { display:grid; gap:6px; min-width:240px; }
  .wp-title { font-weight:800; font-size:14px; color:#0f172a; margin:0; }
  .wp-desc { font-size:12px; color:#475569; line-height:1.35; max-width:320px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
  .wp-footer { font-size:11px; color:#64748b; margin-top:2px; display:flex; gap:6px; align-items:center; }
  .wp-right { display:grid; align-content:center; justify-items:center; gap:4px; padding-left:10px; }
  .wp-up { background:#e2f8f5; border:1px solid #0ec1ac; color:#0ec1ac; width:28px; height:28px; border-radius:6px; display:grid; place-items:center; cursor:pointer; }
  .wp-up[disabled] { opacity:.6; cursor:not-allowed; }
  .wp-count { font-weight:800; font-size:12px; color:#0f172a; }
  .wp-avatar { width:18px; height:18px; border-radius:999px; display:inline-grid; place-items:center; background:#f1f5f9; margin-right:6px; font-size:12px; }
  .wp-comment { margin-top:4px; }
  .wp-comment textarea { width:100%; min-height:44px; padding:8px; resize:vertical; border:1px solid #dbe2ea; border-radius:8px; font-size:12px; outline:none; }
  .wp-comment button { margin-top:6px; padding:6px 10px; border:none; background:#0ec1ac; color:#fff; border-radius:8px; cursor:pointer; font-weight:700; }
  `;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/* ============================ HELPERS ============================ */
function fmtDate(iso?: string) {
  try { return iso ? new Date(iso).toLocaleDateString() : ""; } catch { return ""; }
}
function shortDesc(s?: string | null) {
  if (!s) return "";
  const t = String(s).trim();
  return t.length > 160 ? t.slice(0, 157) + "…" : t;
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
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
function iconForType(color: string) {
  return L.divIcon({
    className: "wp-dot",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
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

/* ============================ API SHAPES ============================ */
type GeoGeometry =
  | { type: "LineString"; coordinates: number[][] }
  | { type: "MultiLineString"; coordinates: number[][][] };
type FeatureCollection = { type: "FeatureCollection"; features: { type:"Feature"; geometry: GeoGeometry; properties?: Record<string, any> }[] };

type Waypoint = {
  id: number | string;
  route_id: number;
  name: string;
  lat: number;
  lon: number;
  type?: string | null;
  description?: string | null;
  created_at?: string;
  username?: string;
  votes?: number;
  vote_count?: number;
  distance_mi?: number;
};

/* ============================ BACKEND CALLS (resilient) ============================ */
/** Try common endpoint shapes for voting; return new total or null. */
async function upvoteWaypoint(id: number) {
  const variants = [
    { url: `${API}/api/ratings/waypoint/${id}`, payload: { value: 1 } },
    { url: `${API}/api/ratings/waypoints/${id}`, payload: { value: 1 } },
    { url: `${API}/api/ratings/waypoint/${id}`, payload: { val: 1 } },
    { url: `${API}/api/waypoints/${id}/rate`, payload: { value: 1 } },
    { url: `${API}/api/ratings`, payload: { waypoint_id: id, value: 1 } },
  ];
  let lastErr: any = null;
  for (const v of variants) {
    try {
      const res = await fetch(v.url, { method: "POST", headers: headersJSON, body: JSON.stringify(v.payload) });
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      const json = ct.includes("application/json") && text ? JSON.parse(text) : {};
      if (res.status === 404 || res.status === 405) continue; // try next
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Vote failed (${res.status})`);
      return typeof json?.votes === "number" ? json.votes :
             typeof json?.vote_count === "number" ? json.vote_count : null;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Vote failed");
}

/** Try common shapes for posting a comment. */
async function postComment(waypointId: number, text: string) {
  const variants = [
    { url: `${API}/api/waypoints/${waypointId}/comments`, payload: { text } },
    { url: `${API}/api/comments`, payload: { waypoint_id: waypointId, text } },
    { url: `${API}/api/waypoint/${waypointId}/comments`, payload: { body: text } },
  ];
  let lastErr: any = null;
  for (const v of variants) {
    try {
      const res = await fetch(v.url, { method: "POST", headers: headersJSON, body: JSON.stringify(v.payload) });
      const ct = res.headers.get("content-type") || "";
      const textBody = await res.text();
      const json = ct.includes("application/json") && textBody ? JSON.parse(textBody) : {};
      if (res.status === 404 || res.status === 405) continue;
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `Comment failed (${res.status})`);
      return json;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Comment failed");
}

/* ===== TEMP global shims so any lingering inline handlers don’t explode ===== */
if (typeof window !== "undefined") {
  (window as any).upvoteWaypoint = async (id: number) => upvoteWaypoint(Number(id));
  (window as any).postWaypointComment = async (id: number, text: string) => postComment(Number(id), text);
}

/* ============================ POPUP TEMPLATE ============================ */
function waypointPopupHTML(wp: Waypoint) {
  const name = wp.name || wp.type || "Waypoint";
  const desc = shortDesc(wp.description);
  const date = fmtDate(wp.created_at);
  const who = wp.username ? `• ${wp.username}` : "";
  const dist = wp.distance_mi ? `• ${Number(wp.distance_mi).toFixed(2)} mi` : "";
  const vote = Number(wp.votes ?? wp.vote_count ?? 0);

  return `
    <div class="wp-card" data-wp-id="${wp.id}">
      <div class="wp-left">
        <div class="wp-title">${escapeHtml(name)}</div>
        ${desc ? `<div class="wp-desc">${escapeHtml(desc)}</div>` : ""}
        <div class="wp-footer">
          <span class="wp-avatar">${emojiForType(wp.type || "")}</span>
          <span>${date}</span><span>${who}</span><span>${dist}</span>
        </div>
        <div class="wp-comment">
          <textarea placeholder="Add a comment…" data-role="comment"></textarea>
          <button data-action="post-comment">Post</button>
        </div>
      </div>
      <div class="wp-right">
        <button class="wp-up" title="Upvote" data-action="upvote">⬆</button>
        <div class="wp-count" data-role="count">${vote}</div>
      </div>
    </div>
  `;
}

/* ============================ COMPONENT ============================ */
export default function RouteView() {
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();

  // prefer :id, else ?ids=1,2, else localStorage
  const ids = useMemo(() => {
    if (id) return [Number(id)].filter(Number.isFinite);
    const qs = new URLSearchParams(location.search).get("ids");
    if (qs) return qs.split(",").map(Number).filter(Number.isFinite);
    try {
      const fromLs = JSON.parse(localStorage.getItem("selectedRouteIds") || "[]");
      if (Array.isArray(fromLs)) return fromLs.map(Number).filter(Number.isFinite);
    } catch {}
    return [];
  }, [id, location.search]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeGroupRef = useRef<LayerGroup | null>(null);
  const wpGroupRef = useRef<LayerGroup | null>(null);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    ensureWaypointCSS();

    const map = L.map(containerRef.current).setView([37.78, -122.4], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    routeGroupRef.current = L.layerGroup().addTo(map);
    wpGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      routeGroupRef.current = null;
      wpGroupRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // load + draw whenever ids change
  useEffect(() => {
    const map = mapRef.current;
    const routeGroup = routeGroupRef.current;
    const wpGroup = wpGroupRef.current;
    if (!map || !routeGroup || !wpGroup) return;

    routeGroup.clearLayers();
    wpGroup.clearLayers();
    if (!ids.length) return;

    (async () => {
      const bounds = L.latLngBounds([]);

      for (const rid of ids) {
        // 1) Route geometry
        const geoRes = await fetch(`${API}/api/routes/${rid}.geojson`, { headers: authHeader() });
        const ct = geoRes.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const text = await geoRes.text();
          throw new Error(`Non-JSON from /routes/${rid}.geojson (${geoRes.status}): ${text.slice(0, 120)}`);
        }
        const fc: FeatureCollection = await geoRes.json();

        const routeLayer = L.geoJSON(fc, { style: { weight: 4, color: "#0ec1ac" } }).addTo(routeGroup);
        try {
          const b = (routeLayer as any).getBounds?.();
          if (b?.isValid()) bounds.extend(b);
        } catch {}

        // 2) Waypoints for the route
        const wpsRes = await fetch(`${API}/api/waypoints/route/${rid}`, { headers: authHeader() });
        const wpsJson = await wpsRes.json().catch(() => ({}));
        const waypoints: Waypoint[] = Array.isArray(wpsJson?.items) ? wpsJson.items : [];

        for (const wp of waypoints) {
          const color = colorForType(wp.type || "");
          const mk = L.marker([wp.lat, wp.lon], {
            icon: iconForType(color),
            title: wp.name || wp.type || "Waypoint",
          }).addTo(wpGroup);

          mk.bindPopup(waypointPopupHTML(wp), { maxWidth: 380, minWidth: 280, closeButton: true });

          // Delegated handlers (no globals)
          mk.on("popupopen", (e: any) => {
            const container: HTMLElement | null = e.popup?._container || null;
            if (!container) return;

            const onClick = async (ev: Event) => {
              const target = ev.target as HTMLElement;

              // Upvote
              const upBtn = target.closest('button[data-action="upvote"]') as HTMLButtonElement | null;
              if (upBtn) {
                const countEl = container.querySelector('[data-role="count"]') as HTMLElement | null;
                const old = Number(countEl?.textContent || 0);
                if (countEl) countEl.textContent = String(old + 1);
                upBtn.disabled = true;

                try {
                  const newTotal = await upvoteWaypoint(Number(wp.id));
                  const finalTotal = typeof newTotal === "number" ? newTotal : old + 1;

                  // persist to model + popup cache
                  wp.votes = finalTotal;
                  wp.vote_count = finalTotal;
                  if (countEl) countEl.textContent = String(finalTotal);

                  // update popup content Leaflet caches for next open
                  const p = mk.getPopup();
                  if (p) p.setContent(waypointPopupHTML(wp));
                } catch (err: any) {
                  if (countEl) countEl.textContent = String(old);
                  alert(err?.message || "Vote failed");
                } finally {
                  upBtn.disabled = false;
                }
                return;
              }

              // Post Comment
              const postBtn = target.closest('button[data-action="post-comment"]') as HTMLButtonElement | null;
              if (postBtn) {
                const textarea = container.querySelector('[data-role="comment"]') as HTMLTextAreaElement | null;
                const message = (textarea?.value || "").trim();
                if (!message) return;

                postBtn.disabled = true;
                const oldLabel = postBtn.textContent || "Post";
                postBtn.textContent = "Posting…";
                try {
                  await postComment(Number(wp.id), message);
                  // clear + acknowledge
                  if (textarea) textarea.value = "";
                  postBtn.textContent = "Posted";
                  setTimeout(() => (postBtn.textContent = oldLabel), 800);
                } catch (err: any) {
                  alert(err?.message || "Comment failed");
                  postBtn.textContent = oldLabel;
                } finally {
                  postBtn.disabled = false;
                }
              }
            };

            container.addEventListener("click", onClick);
            mk.once("popupclose", () => container.removeEventListener("click", onClick));
          });
        }
      }

      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    })().catch((e) => console.error(e));
  }, [ids]);

  return <div ref={containerRef} style={{ height: "100vh" }} />;
}
