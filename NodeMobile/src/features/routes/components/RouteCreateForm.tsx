import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { baseStyles, colors } from "../../../styles/theme";

export type RouteCreateFormValues = {
  name: string;
  region: string;
  fileUri: string | null;
};

type Props = {
  initial?: Partial<RouteCreateFormValues>;
  onPickFile: () => Promise<void>;
  onSubmit: (values: RouteCreateFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  fileSelected?: boolean;
};

export default function RouteCreateForm({
  initial,
  onPickFile,
  onSubmit,
  onCancel,
  submitting,
  fileSelected,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");

  return (
    <View style={[baseStyles.container, { padding: 20 }]}>
      <Text style={baseStyles.headerText}>Create New Route</Text>

      <Text style={{ marginTop: 16 }}>Name</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: colors.accent,
          borderRadius: 8,
          padding: 8,
          width: "100%",
          marginTop: 4,
        }}
        value={name}
        onChangeText={setName}
      />

      <Text style={{ marginTop: 16 }}>Region</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: colors.accent,
          borderRadius: 8,
          padding: 8,
          width: "100%",
          marginTop: 4,
        }}
        value={region}
        onChangeText={setRegion}
      />

      <TouchableOpacity
        style={[baseStyles.button, { backgroundColor: colors.accent, marginTop: 16 }]}
        onPress={onPickFile}
        disabled={!!submitting}
      >
        <Text style={baseStyles.buttonText}>
          {fileSelected ? "✅ File Selected" : "📎 Pick GPX File"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[baseStyles.button, baseStyles.buttonPrimary, { marginTop: 24 }]}
        onPress={() =>
          onSubmit({ name, region, fileUri: fileSelected ? "_present_" : null })
        }
        disabled={!!submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={baseStyles.buttonText}>🚀 Create Route</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[baseStyles.button, baseStyles.buttonSecondary, { marginTop: 10 }]}
        onPress={onCancel}
        disabled={!!submitting}
      >
        <Text style={baseStyles.buttonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}
