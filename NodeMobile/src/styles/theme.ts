// theme.ts
import { StyleSheet, Appearance, useColorScheme } from "react-native";
import React from "react";



/** ---- 0) Tiny override store (no Provider needed) ---- */
type ThemeOverride = "system" | "light" | "dark";
let __override: ThemeOverride = "system";
const __listeners = new Set<() => void>();

export function setThemeOverride(mode: ThemeOverride) {
  __override = mode;
  __listeners.forEach((fn) => fn());
}

export function useThemeOverride(): ThemeOverride {
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const fn = () => force((n) => n + 1);
    __listeners.add(fn);
    return () => __listeners.delete(fn);
  }, []);
  return __override;
}


/** ---- 1) Palettes ---- */
type Palette = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  backgroundAlt: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
};

export const lightColors: Palette = {
  primary: "#40E0D0",     // turquoise
  secondary: "#008B8B",   // dark cyan
  accent: "#5F9EA0",      // cadet blue
  background: "#FFFFFF",
  backgroundAlt: "#F8F9FA",
  textPrimary: "#222222",
  textSecondary: "#666666",
  border: "#E5E7EB",
};

export const darkColors: Palette = {
  primary: "#40E0D0",
  secondary: "#00A3A3",
  accent: "#6FB0B5",
  background: "#101214ff",
  backgroundAlt: "#1A1F23",
  textPrimary: "#EAEAEA",
  textSecondary: "#A6A6A6",
  border: "#2B3137",
};

/** ---- 2) Fonts (unchanged) ---- */
export const fonts = {
  header: {
    fontFamily: "Comfortaa-Bold", // for titles & headings
  },
  body: {
    fontFamily: "System", // default device sans serif for readability
  },
  button: {
    fontFamily: "Comfortaa-Bold", // for buttons and menu options
  },
};

/** ---- 3) Style factory (given a palette) ---- */
const makeBaseStyles = (c: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
    },
    logo: {
      flex: 0.6,
      width: "80%",
    },
    headerText: {
      ...fonts.header,
      fontSize: 28,
      color: c.textPrimary,
    },
    bodyText: {
      ...fonts.body,
      fontSize: 16,
      color: c.textPrimary,
    },
    subText: {
      ...fonts.body,
      fontSize: 14,
      color: c.textSecondary,
    },
    button: {
      width: "70%",
      paddingVertical: 14,
      borderRadius: 30,
      alignItems: "center",
      marginVertical: 8,
    },
    buttonPrimary: {
      backgroundColor: c.primary,
    },
    buttonSecondary: {
      backgroundColor: c.secondary,
    },
    buttonAccent: {
      backgroundColor: c.accent,
    },
    buttonText: {
      ...fonts.button,
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
    },
    input: {
      ...fonts.body,
      width: "80%",
      borderWidth: 1,
      borderColor: c.accent,
      borderRadius: 12,
      padding: 12,
      marginVertical: 8,
      fontSize: 16,
      color: c.textPrimary,
      backgroundColor: c.backgroundAlt,
    },
    error: {
      color: "#b00020",
      textAlign: "center",
      marginTop: 8,
    },
    card: {
      width: "90%",
      padding: 16,
      borderRadius: 16,
      backgroundColor: c.backgroundAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
  });

/** ---- 4) Backwards compatibility (light as default) ---- */
export const colors = lightColors;
export const baseStyles = makeBaseStyles(lightColors);

/** ---- 5) Dark mode helpers (unchanged signature) ---- */

// A) React hook for components
export function useThemeStyles(override?: "light" | "dark") {
  // subscribe to external override changes so screens re-render
  const _override = useThemeOverride();
  const scheme = useColorScheme();

  // Decide mode: explicit arg > global override > system
  let mode: "light" | "dark";
  if (override) {
    mode = override;
  } else if (_override === "system") {
    const sys = (scheme ?? Appearance.getColorScheme() ?? "light") === "dark" ? "dark" : "light";
    mode = sys;
  } else {
    mode = _override; // 'light' | 'dark'
  }

  const c = mode === "dark" ? darkColors : lightColors;
  const styles = makeBaseStyles(c);
  return { colors: c, styles, isDark: mode === "dark" };
}

// B) One-off getter (non-hook usage)
export function getThemed(override?: "light" | "dark") {
  // respects global override if no arg passed
  const eff =
    override ??
    (__override === "system"
      ? (Appearance.getColorScheme() ?? "light")
      : __override);

  const c = eff === "dark" ? darkColors : lightColors;
  const styles = makeBaseStyles(c);
  return { colors: c, styles, isDark: eff === "dark" };
}

// C) Manual factory if you want to pin a theme explicitly
export function createThemedStyles(scheme: "light" | "dark") {
  const c = scheme === "dark" ? darkColors : lightColors;
  return makeBaseStyles(c);
}