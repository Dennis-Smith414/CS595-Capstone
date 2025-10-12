// src/lib/api.ts
export const API_BASE = 'http://10.0.2.2:5000';

// -------- Public routes --------
export async function fetchRouteList() {
  const res = await fetch(`${API_BASE.replace(/\/+$/, '')}/api/routes/list`);
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.items ?? [];
  } catch {
    throw new Error(`Bad JSON from /routes/list: ${text.slice(0,200)}`);
  }
}

export async function fetchRouteGeo(id: number) {
  const r = await fetch(`${API_BASE.replace(/\/+$/, '')}/api/routes/${id}.geojson`);
  if (!r.ok) throw new Error(`geo error ${r.status}`);
  return r.json();
}

// -------- Auth helpers (match server contract) --------
export async function login(emailOrUsername: string, password: string) {
  const res = await fetch(`${API_BASE.replace(/\/+$/, '')}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ emailOrUsername, password }),
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok || !json?.ok || !json?.token) {
    throw new Error(json?.error || `Login failed (${res.status})`);
  }
  return json as { ok: true; token: string; user?: any };
}

export async function register(username: string, email: string, password: string) {
  const res = await fetch(`${API_BASE.replace(/\/+$/, '')}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok || !json?.ok || !json?.token) {
    throw new Error(json?.error || `Register failed (${res.status})`);
  }
  return json as { ok: true; token: string; user?: any };
}

export async function fetchMe(token: string) {
  const res = await fetch(`${API_BASE.replace(/\/+$/, '')}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch {}
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `Failed to load /me (${res.status})`);
  }
  return json.user;
}

// -------- These were 404s before; use working endpoints or implement on server --------
// For now, return public lists filtered client-side or implement server routes later.
export async function fetchUserRoutes(_token: string) {
  // TODO: implement /api/users/me/routes on the server; placeholder:
  return fetchRouteList();
}
export async function fetchUserWaypoints(token: string) {
  // If you add /api/users/me/waypoints on the server, call it here.
  // For now, you likely want to GET /api/routes/:id.waypoints (if/when you add it).
  // Placeholder return:
  const me = await fetchMe(token);
  return { user: me, waypoints: [] };
}
