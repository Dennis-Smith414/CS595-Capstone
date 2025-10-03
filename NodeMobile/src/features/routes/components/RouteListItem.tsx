import React from "react";
import { TouchableOpacity, Text, View, StyleSheet } from "react-native";
import type { RouteItem } from "../utils/types";

type Props = {
  item: RouteItem;
  selected?: boolean;
  onPress?: (id: number) => void;
};

export default function RouteListItem({ item, selected, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[S.row, selected ? S.rowSelected : null]}
      onPress={() => onPress?.(item.id)}
      accessibilityRole="button"
    >
      <Text style={S.title}>{item.name}</Text>
      {item.region ? <Text style={S.subtle}>{item.region}</Text> : null}
    </TouchableOpacity>
  );
}

const S = StyleSheet.create({
  row: {
    padding: 12,
    marginVertical: 6,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f7f9fb",
    borderWidth: 1,
    borderColor: "#7ad8cf",
  },
  rowSelected: { backgroundColor: "#e7fbf7" },
  title: { fontSize: 16, fontWeight: "600", color: "#111" },
  subtle: { color: "#666", marginTop: 2 },
});
