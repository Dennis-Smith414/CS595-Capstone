export type LatLng = [number, number];

type GeoFeature = {
  type: "Feature";
  properties: any;
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: number[][] | number[][][];
  };
};

const toLatLng = (xy: number[]) => [xy[1], xy[0]] as LatLng;

export function flattenToLatLng(
  geom: GeoFeature["geometry"]
): LatLng[] {
  if (geom.type === "LineString") {
    return (geom.coordinates as number[][]).map(toLatLng);
  }
  return (geom.coordinates as number[][][]).flatMap(seg => seg.map(toLatLng));
}
