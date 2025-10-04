import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

type SubmitPayload = { username: string; email: string; password: string };

export type AccountFormProps = {
  logoSource?: ImageSourcePropType;
  /** If provided, form will call this directly */
  createUser?: (payload: SubmitPayload) => Promise<any>;
  /** Alternative: the parent handles submission */
  onSubmit?: (payload: SubmitPayload) => Promise<any> | any;
  onSuccess?: () => void;
  onCancel?: () => void;
};

const strongPwd = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

export default function AccountForm({
  logoSource,
  createUser,
  onSubmit,
  onSuccess,
  onCancel,
}: AccountFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setError(null);

    if (!username || !email || !password || !confirm) {
      setError("Please fill out all fields.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!strongPwd.test(password)) {
      setError(
        "Password must be at least 8 characters, include 1 capital letter, and 1 symbol."
      );
      return;
    }

    setBusy(true);
    try {
      if (onSubmit) {
        await onSubmit({ username, email, password });
      } else if (createUser) {
        await createUser({ username, email, password });
      } else {
        throw new Error("No submit handler provided to AccountForm.");
      }
      onSuccess?.();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={S.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={S.inner} keyboardShouldPersistTaps="handled">
        {logoSource ? <Image source={logoSource} style={S.logo} /> : null}

        <Text style={S.title}>Create Account</Text>

        <TextInput
          style={S.input}
          placeholder="Username"
          placeholderTextColor="lightgray"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          returnKeyType="next"
        />
        <TextInput
          style={S.input}
          placeholder="Email"
          placeholderTextColor="lightgray"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          returnKeyType="next"
        />
        <TextInput
          style={S.input}
          placeholder="Password"
          placeholderTextColor="lightgray"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          returnKeyType="next"
        />
        <TextInput
          style={S.input}
          placeholder="Confirm Password"
          placeholderTextColor="lightgray"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          returnKeyType="done"
        />

{error ? (
  <Text testID="account-error" accessibilityRole="alert" style={S.error}>
    {error}
  </Text>
) : null}

<TouchableOpacity
  style={[S.button, S.primary]}
  onPress={handleCreate}
  disabled={busy}
  accessibilityRole="button"
  accessibilityLabel="submit-create-account"
  testID="submit-create-account"
>
  {busy ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <Text style={S.buttonText}>Create Account</Text>
  )}
</TouchableOpacity>

<TouchableOpacity
  style={[S.button, S.secondary]}
  onPress={onCancel}
  accessibilityRole="button"
  accessibilityLabel="cancel-create-account"
  testID="cancel-create-account"
>
  <Text style={S.secondaryText}>Cancel</Text>
</TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { width: "80%", height: 140, marginBottom: 8, resizeMode: "contain" },
  title: { fontSize: 22, fontWeight: "700", marginVertical: 8, color: "#222" },
  input: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  button: {
    width: "70%",
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: "center",
    marginVertical: 6,
  },
  primary: { backgroundColor: "#008b8b" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondary: { backgroundColor: "transparent", borderWidth: 2, borderColor: "#40e0d0" },
  secondaryText: { color: "#40e0d0", fontSize: 16, fontWeight: "700" },
  error: { color: "#b00020", textAlign: "center", marginTop: 8 },
});
