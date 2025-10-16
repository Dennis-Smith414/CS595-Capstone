// client/src/lib/waypoints.ts
const API =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (window as any)?.__API_BASE__ ||
  "http://localhost:5000";

const auth = () => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// List all waypoints for a route (server returns w.* + username)
export async function listWaypointsForRoute(routeId: number) {
  const r = await fetch(`${API}/api/waypoints/route/${routeId}`, {
    headers: { ...auth() },
  });
  const j = await r.json();
  if (!r.ok || j.ok === false) {
    throw new Error(j.error || `Failed to load waypoints (${r.status})`);
  }
  return j.items as Array<{
    id: number;
    route_id: number;
    user_id: number | null;
    name: string;
    description?: string | null;
    lat: number;
    lon: number;
    type?: string | null;
    created_at: string;
    username?: string; // server joins users.username
  }>;
}
