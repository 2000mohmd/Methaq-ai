import { StyleSheet } from "react-native";

/** Brand tokens, matching the website's src/styles.css. */
export const C = {
  navy: "#11374a",
  navyTint: "#f1f5f7",
  teal: "#02a79f",
  tealTint: "#e9f6f5",
  bg: "#ffffff",
  fg: "#1c2a31",
  muted: "#6b7a82",
  border: "#e3e8eb",
  danger: "#c0392b",
  amber: "#b7791f",
};

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  h1: { fontSize: 22, fontWeight: "700", color: C.navy, textAlign: "left" },
  text: { fontSize: 15, color: C.fg, textAlign: "left", lineHeight: 22 },
  muted: { fontSize: 13, color: C.muted, textAlign: "left" },
  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: C.fg, backgroundColor: C.bg, textAlign: "left", // RN flips left/right under RTL, so "left" = start
  },
  btn: { backgroundColor: C.navy, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  card: { borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, backgroundColor: C.bg },
});
