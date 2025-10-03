// Thin service wrapper for route-related API calls
import { API_BASE } from "../../../lib/api";

export async function getRouteGeo(id: number) {
  const r = await fetch(`${API_BASE}/api/routes/${id}.geojson`);
  if (!r.ok) throw new Error(`geo error ${r.status}`);
  return r.json();
}
