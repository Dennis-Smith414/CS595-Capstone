// src/screens/RouteEditScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";

import { useThemeStyles } from "../styles/theme";
import { createGlobalStyles } from "../styles/globalStyles";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../config/env";

type RouteEditScreenProps = {
  navigation: any;
  route: {
    params?: {
      id?: number;        // some places might send id
      routeId?: number;   // others might send routeId
      name?: string;
      region?: string | null;
      description?: string | null;
    };
  };
};

type RouteDetails = {
  id: number;
  name: string;
  region?: string | null;
  description?: string | null;
};

const RouteEditScreen: React.FC<RouteEditScreenProps> = ({
  navigation,
  route,
}) => {
  const { colors } = useThemeStyles();
  const globalStyles = createGlobalStyles(colors);
  const { userToken } = useAuth();

  const routeId =
    route?.params?.routeId ??
    route?.params?.id ??
    null;

  const [name, setName] = useState(route?.params?.name ?? "");
  const [region, setRegion] = useState(route?.params?.region ?? "");
  const [description, setDescription] = useState(
    route?.params?.description ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch route details if we weren't passed them in params
  useEffect(() => {
    if (!routeId) {
      Alert.alert("Error", "No route id provided.");
      navigation.goBack();
      return;
    }

    if (name) {
      // we already have data from params (Account > My Routes)
      return;
    }

    const loadRoute = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/routes/${routeId}`);
        const text = await res.text();
        let json: any;

        try {
          json = JSON.parse(text);
        } catch {
          throw new Error("Invalid response from server");
        }

        const r: RouteDetails =
          json.route ??
          json.data ??
          json;

        setName(r.name ?? "");
        setRegion(r.region ?? "");
        setDescription(r.description ?? "");
      } catch (err) {
        console.error("Failed to load route details:", err);
        Alert.alert("Error", "Could not load route details.");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadRoute();
  }, [routeId]);

  const handleSave = async () => {
    if (!routeId) {
      Alert.alert("Error", "No route id provided.");
      return;
    }
    if (!userToken) {
      Alert.alert("Login required", "You must be logged in to edit routes.");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Validation", "Route name cannot be empty.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE}/api/routes/${routeId}`, {
        method: "PATCH", // change to PUT if your backend expects that
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          region: region.trim() || null,
          description: description.trim() || null,
        }),
      });

      const text = await res.text();
      let json: any;

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Invalid response from server");
      }

      if (!json.ok && res.status >= 400) {
        throw new Error(json.error || "Failed to update route");
      }

      // optional: you could pass updated route back
      // navigation.navigate("AccountMain", { updatedRoute: json.route });
      Alert.alert("Success", "Route updated successfully.");
      navigation.goBack();
    } catch (err: any) {
      console.error("Failed to update route:", err);
      Alert.alert(
        "Error",
        err?.message || "Could not update route. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[globalStyles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[globalStyles.subText, { marginTop: 8 }]}>
          Loading route…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        paddingVertical: 24,
      }}
      style={{ backgroundColor: colors.background }}
    >
      <Text style={globalStyles.headerText}>Edit Route</Text>

      {/* Name */}
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Route name"
        placeholderTextColor={colors.textSecondary}
        style={[
          globalStyles.input,
          { width: "90%", color: colors.textPrimary },
        ]}
      />

      {/* Region */}
      <TextInput
        value={region}
        onChangeText={setRegion}
        placeholder="Region / area"
        placeholderTextColor={colors.textSecondary}
        style={[
          globalStyles.input,
          { width: "90%", color: colors.textPrimary },
        ]}
      />

      {/* Description (optional) */}
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Short description (optional)"
        placeholderTextColor={colors.textSecondary}
        style={[
          globalStyles.input,
          {
            width: "90%",
            color: colors.textPrimary,
            minHeight: 100,
            textAlignVertical: "top",
          },
        ]}
        multiline
      />

      {/* Buttons */}
      <View
        style={{
          width: "90%",
          marginTop: 16,
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[
            globalStyles.button,
            { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 },
          ]}
        >
          <Text style={globalStyles.buttonText}>
            {saving ? "Saving…" : "Save changes"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            globalStyles.button,
            {
              backgroundColor: colors.backgroundAlt,
              borderWidth: 1,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              globalStyles.buttonText,
              { color: colors.textPrimary },
            ]}
          >
            Cancel
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default RouteEditScreen;
