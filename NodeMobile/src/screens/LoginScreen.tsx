import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { baseStyles, colors } from "../styles/theme";

export default function LoginScreen({ navigation }: { navigation: any }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth(); // context login(token)

  const handleLogin = async () => {
    setError(null);

    const u = username.trim();
    const p = password;

    if (!u || !p) {
      setError("emailOrUsername and password required");
      return;
    }

    try {
      const res = await fetch(`${API_BASE.replace(/\/+$/, "")}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        // IMPORTANT: server expects "emailOrUsername"
        body: JSON.stringify({ emailOrUsername: u, password: p }),
      });

      const text = await res.text();
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* ignore bad JSON */ }

      if (!res.ok || !data?.ok || !data?.token) {
        throw new Error(data?.error || `Login failed (${res.status})`);
      }

      // Hand token to auth context (it persists + navigates in your app flow)
      login(data.token);
    } catch (err: any) {
      setError(err?.message || "Network error");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Image source={require("../assets/images/OCLogoLight.png")} style={styles.logo} resizeMode="contain" />

        <View style={styles.form}>
          <TextInput
            style={baseStyles.input}
            placeholder="Username or Email"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
            returnKeyType="next"
          />

          <TextInput
            style={baseStyles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {error && <Text style={baseStyles.error}>{error}</Text>}

          <TouchableOpacity
            style={[baseStyles.button, baseStyles.buttonPrimary, styles.loginButton]}
            onPress={handleLogin}
          >
            <Text style={baseStyles.buttonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[baseStyles.button, baseStyles.buttonSecondary]}
            onPress={() => navigation.goBack()}
          >
            <Text style={baseStyles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logo: { width: "80%", height: 140, marginBottom: 24 },
  form: { width: "100%", alignItems: "center" },
  loginButton: { marginTop: 8 },
});
