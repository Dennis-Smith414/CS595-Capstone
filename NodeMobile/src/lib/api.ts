// src/lib/api.ts
export const API_BASE = "http://10.0.2.2:5000";  // <- 5000 not 5100

export async function fetchRouteList() {
  const res = await fetch(`${API_BASE}/api/routes/list`);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.items ?? [];
  } catch {
    throw new Error(`Bad JSON from /routes/list: ${text.slice(0,200)}`);
  }
}

// Alias to match your screen's import
export const fetchTrailList = fetchRouteList;
export const fetchTrailGeo = fetchRouteGeo;

export async function createUser(payload: {
  username: string;
  email: string;
  password: string;
}) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Register failed (${res.status}): ${text}`);
  try { return JSON.parse(text); } catch { return { ok: true }; }
}

export async function fetchRouteGeo(id: number) {
  const r = await fetch(`${API_BASE}/api/routes/${id}.geojson`);
  if (!r.ok) throw new Error(`geo error ${r.status}`);
  return r.json();
}
