import { API_BASE, fetchRouteList as fetchRouteListFromLib } from "../../../lib/api";
import type { RouteItem } from "../utils/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** ---------- Types ---------- */
export type RouteMeta = { name: string; region: string };
export type UploadResult = { id: number };
export type GeoFeature = {
  type: "Feature";
  properties: any;
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: number[][] | number[][][];
  };
};

/** ---------- Helpers ---------- */
async function jsonOrThrow(res: Response) {
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return {} as any; }
}

const CACHE_KEYS = {
  routeList: "routes:list:v1",
  geo: (id: number) => `routes:geo:${id}:v1`,
};

/** ---------- List routes (with offline cache fallback) ---------- */
export async function fetchRouteList(): Promise<RouteItem[]> {
  try {
    const items = await fetchRouteListFromLib();
    // cache fresh copy
    await AsyncStorage.setItem(CACHE_KEYS.routeList, JSON.stringify(items ?? []));
    return Array.isArray(items) ? (items as RouteItem[]) : [];
  } catch (e) {
    // offline fallback
    const cached = await AsyncStorage.getItem(CACHE_KEYS.routeList);
    if (cached) return JSON.parse(cached) as RouteItem[];
    throw e;
  }
}

/** ---------- Get route GeoJSON (with offline cache fallback) ---------- */
export async function fetchRouteGeo(id: number): Promise<GeoFeature> {
  try {
    const res = await fetch(`${API_BASE}/api/routes/${id}.geojson`);
    const json = await jsonOrThrow(res);
    // cache
    await AsyncStorage.setItem(CACHE_KEYS.geo(id), JSON.stringify(json));
    return json as GeoFeature;
  } catch (e) {
    const cached = await AsyncStorage.getItem(CACHE_KEYS.geo(id));
    if (cached) return JSON.parse(cached) as GeoFeature;
    throw e;
  }
}

/** ---------- Upload GPX file ---------- */
export async function uploadGpxFile(fileUri: string): Promise<UploadResult> {
  const form = new FormData();
  // @ts-ignore React Native file shape
  form.append("file", { uri: fileUri, name: "route.gpx", type: "application/gpx+xml" });

  const res = await fetch(`${API_BASE}/api/gpx/upload`, { method: "POST", body: form });
  const data = await jsonOrThrow(res);
  // expected shape: { id: number }
  if (!data?.id) throw new Error("Upload succeeded but no route id returned");
  return data as UploadResult;
}

/** ---------- Patch route metadata ---------- */
export async function patchRouteMeta(id: number, meta: RouteMeta) {
  const res = await fetch(`${API_BASE}/api/routes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta),
  });
  return jsonOrThrow(res);
}

/** ---------- High-level convenience: createRoute (upload + patch) ---------- */
export async function createRoute(params: { fileUri: string; meta: RouteMeta }) {
  const { id } = await uploadGpxFile(params.fileUri);
  await patchRouteMeta(id, params.meta);
  // refresh list cache (best-effort)
  try { await fetchRouteList(); } catch {}
  return { id };
}
