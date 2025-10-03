import { fetchRouteList as fetchRouteListFromLib } from "../../../lib/api";
import type { RouteItem } from "../utils/types";

/**
 * Feature-facing API. We wrap the shared lib so this feature
 * has a single import point and we can swap/extend later.
 */
export async function fetchRouteList(): Promise<RouteItem[]> {
  const items = await fetchRouteListFromLib();
  // Optionally validate/shape here
  return Array.isArray(items) ? items as RouteItem[] : [];
}
