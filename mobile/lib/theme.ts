import { Platform, StyleSheet } from "react-native";

/** Brand tokens, matching the website's src/styles.css. */
export const C = {
  navy: "#11374a",
  navySoft: "#1f4d63",
  navyTint: "#f1f5f7",
  teal: "#02a79f",
  tealSoft: "#3cbfb8",
  tealTint: "#e9f6f5",
  bg: "#ffffff",
  surface: "#f6f8f9",
  fg: "#1c2a31",
  muted: "#6b7a82",
  border: "#e3e8eb",
  danger: "#c0392b",
  amber: "#b7791f",
};

/** IBM Plex Sans Arabic (same family as the website), loaded in app/_layout.tsx. */
export const F = {
  regular: "IBMPlexSansArabic_400Regular",
  medium: "IBMPlexSansArabic_500Medium",
  semibold: "IBMPlexSansArabic_600SemiBold",
  bold: "IBMPlexSansArabic_700Bold",
};

export const R = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = Platform.select({
  ios: { shadowColor: "#11374a", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  default: { elevation: 3 },
});

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },
  h1: { fontFamily: F.bold, fontSize: 24, color: C.navy, textAlign: "left" },
  h2: { fontFamily: F.semibold, fontSize: 18, color: C.navy, textAlign: "left" },
  text: { fontFamily: F.regular, fontSize: 15, color: C.fg, textAlign: "left", lineHeight: 24 },
  muted: { fontFamily: F.regular, fontSize: 13, color: C.muted, textAlign: "left", lineHeight: 20 },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: F.regular, fontSize: 16, color: C.fg, backgroundColor: C.bg, textAlign: "left", // RN flips left/right under RTL, so "left" = start
  },
  btn: { backgroundColor: C.navy, borderRadius: R.md, paddingVertical: 15, alignItems: "center" },
  btnText: { fontFamily: F.semibold, color: "#fff", fontSize: 16 },
  card: { borderRadius: R.lg, padding: 16, backgroundColor: C.bg, ...shadow },
});
