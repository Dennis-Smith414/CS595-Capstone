import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";
import { colors as legacyColors, useThemeStyles } from "../../styles/theme";

type Props = {
  initialText?: string;
  saving?: boolean;
  autoFocus?: boolean;
  onCancel: () => void;
  onSave: (text: string) => Promise<void> | void;
};

export const CommentEditBox: React.FC<Props> = ({
  initialText = "",
  saving = false,
  autoFocus = true,
  onCancel,
  onSave,
}) => {
  const [text, setText] = useState(initialText);
  const { colors } = useThemeStyles(); // ✅ use live theme

  useEffect(() => setText(initialText), [initialText]);

  const canSave = text.trim().length > 0 && !saving;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.backgroundAlt, borderColor: colors.border },
      ]}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!saving}
        autoFocus={autoFocus}
        placeholder="Edit your comment…"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            color: colors.textPrimary,
          },
        ]}
        multiline
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={onCancel}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.secondary },
          ]}
          disabled={saving}
        >
          <Text style={[styles.actionBtnText, { color: colors.buttonText }]}>
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSave(text.trim())}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.primary },
            !canSave && { opacity: 0.6 },
          ]}
          disabled={!canSave}
        >
          <Text style={[styles.actionBtnText, { color: colors.buttonText }]}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  input: {
    minHeight: 80,
    maxHeight: 180,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    width: 90,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  actionBtnText: {
    fontWeight: "700",
  },
});
