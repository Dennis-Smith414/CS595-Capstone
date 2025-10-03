import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import LeafletRouteMap from "../components/LeafletRouteMap";
import { flattenToLatLng } from "../utils/geo";
import { getRouteGeo } from "../services/api";

export default function TrailMapScreen({ route }: any) {
  const { id } = route.params as { id: number; name?: string };
  const [coords, setCoords] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const feature = await getRouteGeo(Number(id));
        const latlng = flattenToLatLng(feature.geometry);
        if (alive) setCoords(latlng);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <View style={S.center}>
        <ActivityIndicator />
        <Text>Loading trail…</Text>
      </View>
    );
  }
  if (err) {
    return (
      <View style={S.center}>
        <Text style={S.err}>Error: {err}</Text>
      </View>
    );
  }
  if (!coords.length) {
    return (
      <View style={S.center}>
        <Text>No geometry for this trail.</Text>
      </View>
    );
  }

  return <LeafletRouteMap coords={coords} />;
}

const S = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  err: { color: "#b00020", textAlign: "center" },
});
