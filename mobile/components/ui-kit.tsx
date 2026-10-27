// Shared visual primitives for the contracts / audit / library tabs. Pure presentation, no data logic.
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { C, F, R, s, shadow } from "../lib/theme";

export type IconName = keyof typeof Ionicons.glyphMap;

/** Light tap feedback; never throws (web / unsupported devices). */
export const tap = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const success = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

/** `color` + 2-digit hex alpha, for tinted surfaces. */
export const tint = (color: string, alpha = "1a") => color + alpha;

export function ScreenHeader({ kicker, title, subtitle }: { kicker?: string; title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4 }}>
      {kicker ? <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.teal, textAlign: "left", letterSpacing: 0.3 }}>{kicker}</Text> : null}
      <Text style={[s.h1, { fontSize: 26, lineHeight: 38 }]}>{title}</Text>
      {subtitle ? <Text style={[s.muted, { fontSize: 14, lineHeight: 22 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
      <Text style={[s.h2, { flex: 1 }]}>{title}</Text>
      {right}
    </View>
  );
}

export function IconTile({ icon, color = C.teal, size = 44, bg }: { icon: IconName; color?: string; size?: number; bg?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: R.md, alignItems: "center", justifyContent: "center", backgroundColor: bg ?? tint(color) }}>
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

export function Pill({ label, color, icon }: { label: string; color: string; icon?: IconName }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: tint(color) }}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />}
      <Text style={{ fontFamily: F.semibold, fontSize: 12, color }}>{label}</Text>
    </View>
  );
}

type BtnVariant = "primary" | "teal" | "outline" | "ghost" | "danger";
export function Button(p: {
  label: string; onPress: () => void; icon?: IconName; variant?: BtnVariant; disabled?: boolean; loading?: boolean;
  style?: StyleProp<ViewStyle>; compact?: boolean;
}) {
  const v = p.variant ?? "primary";
  const bg = { primary: C.navy, teal: C.teal, outline: C.bg, ghost: "transparent", danger: tint(C.danger, "14") }[v];
  const fg = { primary: "#fff", teal: "#fff", outline: C.navy, ghost: C.navy, danger: C.danger }[v];
  const off = p.disabled || p.loading;
  return (
    <Pressable
      onPress={() => { tap(); p.onPress(); }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!p.loading }}
      style={({ pressed }) => [
        { minHeight: 48, borderRadius: R.md, paddingHorizontal: p.compact ? 14 : 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: bg },
        v === "outline" && { borderWidth: 1, borderColor: C.border },
        { opacity: p.disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        p.style,
      ]}
    >
      {p.loading ? <ActivityIndicator color={fg} /> : p.icon ? <Ionicons name={p.icon} size={18} color={fg} /> : null}
      <Text style={{ fontFamily: F.semibold, fontSize: 15, color: fg }} numberOfLines={1}>{p.label}</Text>
    </Pressable>
  );
}

/** Selectable option chip (single choice lists). */
export function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, borderRadius: R.md, paddingHorizontal: 14, borderWidth: 1.5,
        borderColor: active ? C.teal : C.border, backgroundColor: active ? C.tealTint : C.bg }}
    >
      {active && <Ionicons name="checkmark-circle" size={16} color={C.teal} />}
      <Text style={{ fontFamily: active ? F.semibold : F.medium, fontSize: 14, color: active ? C.navy : C.fg }}>{label}</Text>
    </Pressable>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.navy, textAlign: "left" }}>{children}</Text>;
}

/** Pill-style two (or more) way switch. */
export function Segmented<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string, IconName?])[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: "#e8eef1", borderRadius: R.pill, padding: 4 }}>
      {options.map(([k, label, icon]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => { if (!on) { Haptics.selectionAsync().catch(() => {}); onChange(k); } }}
            accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[{ flex: 1, minHeight: 40, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", borderRadius: R.pill },
              on && { backgroundColor: C.bg, ...shadow }]}>
            {icon ? <Ionicons name={icon} size={16} color={on ? C.teal : C.muted} /> : null}
            <Text style={{ fontFamily: on ? F.bold : F.medium, fontSize: 14, color: on ? C.navy : C.muted }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  return (
    <View style={[s.card, { alignItems: "center", gap: 10, paddingVertical: 32 }]}>
      <IconTile icon={icon} size={60} />
      <Text style={[s.h2, { fontSize: 16, textAlign: "center" }]}>{title}</Text>
      {text ? <Text style={[s.muted, { textAlign: "center", maxWidth: 280 }]}>{text}</Text> : null}
    </View>
  );
}

export function Banner({ icon, text, color = C.teal, title }: { icon: IconName; text: string; color?: string; title?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 14, borderRadius: R.md, backgroundColor: tint(color, "14"), borderWidth: 1, borderColor: tint(color, "33") }}>
      <Ionicons name={icon} size={20} color={color} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.navy, textAlign: "left" }}>{title}</Text> : null}
        <Text style={[s.muted, { color: C.fg }]}>{text}</Text>
      </View>
    </View>
  );
}

/** Floating action button, anchored bottom-end of its (relative) parent. */
export function Fab({ icon, onPress, label, loading, disabled }: { icon: IconName; onPress: () => void; label: string; loading?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ position: "absolute", bottom: 20, end: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: C.teal,
        alignItems: "center", justifyContent: "center", ...shadow, elevation: 6, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name={icon} size={28} color="#fff" />}
    </Pressable>
  );
}

export function IconBtn({ icon, onPress, label, color = C.muted }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} accessibilityRole="button" hitSlop={6}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? C.navyTint : "transparent" })}>
      <Ionicons name={icon} size={19} color={color} />
    </Pressable>
  );
}
