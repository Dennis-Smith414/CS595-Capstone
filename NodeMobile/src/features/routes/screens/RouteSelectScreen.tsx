import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { baseStyles, colors } from "../../../styles/theme";
import { useRouteSelection } from "../../../context/RouteSelectionContext";
import RouteListItem from "../components/RouteListItem";
import { fetchRouteList } from "../services/RoutesApi";
import type { RouteItem } from "../utils/types";

export default function RouteSelectScreen({ navigation }: any) {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { selectedRouteIds, toggleRouteId } = useRouteSelection();

  const loadRoutes = useCallback(async () => {
    try {
      setRefreshing(true);
      const list = await fetchRouteList();
      setRoutes(list);
    } catch (e: any) {
      console.error("Failed to fetch routes:", e);
      Alert.alert("Error", "Could not load routes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  const confirmSelection = () => {
    navigation.navigate("Map");
  };

  if (loading) {
    return (
      <View style={baseStyles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={baseStyles.subText}>Loading routes…</Text>
      </View>
    );
  }

  return (
    <View style={[baseStyles.container, { padding: 16 }]}>
      <Text style={baseStyles.headerText}>Select Routes</Text>

      <TouchableOpacity
        style={[baseStyles.button, { backgroundColor: colors.accent, marginVertical: 8, paddingVertical: 10 }]}
        onPress={() => navigation.navigate("RouteCreate")}
      >
        <Text style={baseStyles.buttonText}>＋ Create / Upload Route</Text>
      </TouchableOpacity>

      <FlatList
        data={routes}
        keyExtractor={(item) => String(item.id)}
        style={{ width: "100%", marginTop: 8 }}
        refreshing={refreshing}
        onRefresh={loadRoutes}
renderItem={({ item }) => {
  const id = Number(item.id);
  const isSelected = selectedRouteIds.includes(id);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => toggleRouteId(id)}
      style={{
        padding: 14,
        marginVertical: 6,
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isSelected ? colors.primary : colors.accent,
        backgroundColor: isSelected ? "#E6FAF7" : "#fff",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={{ flexShrink: 1 }}>
        <Text
          style={[
            baseStyles.bodyText,
            { fontWeight: "600", color: "#111" },
          ]}
        >
          {item.name}
        </Text>
        {item.region ? (
          <Text style={[baseStyles.subText, { marginTop: 2 }]}>{item.region}</Text>
        ) : null}
      </View>

      {/* Right-side selected chip */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isSelected ? colors.primary : "transparent",
          borderWidth: isSelected ? 0 : 1,
          borderColor: colors.accent,
        }}
      >
        {isSelected ? (
          <Text style={{ color: "#fff", fontWeight: "800" }}>✓</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}}

        ListEmptyComponent={<Text style={baseStyles.subText}>No routes found.</Text>}
      />

      {selectedRouteIds.length > 0 && (
            <TouchableOpacity
            style={[
                baseStyles.button,
                { marginTop: 16, opacity: selectedRouteIds.length ? 1 : 0.4 },
            ]}
            disabled={!selectedRouteIds.length}
            onPress={confirmSelection}
            accessibilityState={{ disabled: !selectedRouteIds.length }}
            >
            <Text style={baseStyles.buttonText}>Show on Map</Text>
            </TouchableOpacity>
      )}
    </View>
  );
}
