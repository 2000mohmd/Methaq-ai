import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Share, Text, View } from "react-native";

import { C, F, R, shadow } from "../lib/theme";
import { MdText } from "./md-text";

/** Teal-to-navy rounded square with the scales glyph. */
export function BrandMark({ size = 64 }: { size?: number }) {
  return (
    <LinearGradient
      colors={[C.teal, C.navy]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="scale" size={size * 0.52} color="#fff" />
    </LinearGradient>
  );
}

const SUGGESTIONS = [
  { icon: "briefcase", title: "قانون العمل", prompt: "ما هي شروط إنهاء عقد العمل في السعودية؟" },
  { icon: "document-text", title: "صياغة", prompt: "صغ اتفاقية عدم إفصاح ثنائية" },
  { icon: "shield-checkmark", title: "تحليل المخاطر", prompt: "راجع هذا البند من حيث المخاطر" },
  { icon: "people", title: "الأحوال الشخصية", prompt: "ما الشروط التي يمكن إضافتها إلى عقد الزواج؟" },
] as const;

export function ChatEmpty({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <View style={{ paddingTop: 28, alignItems: "center" }}>
      <BrandMark />
      <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.teal, marginTop: 18 }}>ميثاق العربية</Text>
      <Text style={{ fontFamily: F.bold, fontSize: 24, lineHeight: 36, color: C.navy, textAlign: "center", marginTop: 4 }}>
        كيف يمكنني مساعدتك اليوم؟
      </Text>
      <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted, textAlign: "center", marginTop: 6, paddingHorizontal: 24, lineHeight: 22 }}>
        اسأل عن الأنظمة السعودية، اطلب صياغة، أو الصق بنداً لمراجعته
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginTop: 28, alignSelf: "stretch" }}>
        {SUGGESTIONS.map((x) => (
          <Pressable
            key={x.prompt}
            onPress={() => onPick(x.prompt)}
            style={({ pressed }) => [
              { width: "48.5%", minHeight: 128, backgroundColor: C.bg, borderRadius: R.lg, padding: 14, gap: 10, borderWidth: 1, borderColor: C.border },
              pressed && { borderColor: C.teal, backgroundColor: C.tealTint },
            ]}
          >
            <View style={{ width: 36, height: 36, borderRadius: R.sm, backgroundColor: C.tealTint, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={x.icon} size={19} color={C.teal} />
            </View>
            <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.navy, textAlign: "left" }}>{x.title}</Text>
            <Text style={{ fontFamily: F.regular, fontSize: 13, lineHeight: 20, color: C.muted, textAlign: "left" }}>{x.prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function UserBubble({ text }: { text: string }) {
  return (
    <Pressable
      onLongPress={() => Share.share({ message: text })}
      style={{
        alignSelf: "flex-end", maxWidth: "84%", backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 11,
        borderRadius: R.lg, borderBottomEndRadius: 6,
      }}
    >
      <Text selectable style={{ fontFamily: F.regular, fontSize: 15, lineHeight: 24, color: "#fff", textAlign: "left" }}>{text}</Text>
    </Pressable>
  );
}

export function AssistantMessage({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <BrandMark size={28} />
      <Pressable
        onLongPress={() => text && Share.share({ message: text })}
        style={{ flex: 1, backgroundColor: C.bg, borderRadius: R.lg, borderTopStartRadius: 6, paddingHorizontal: 16, paddingVertical: 14, ...shadow }}
      >
        {text ? <MdText text={text} /> : <TypingDots />}
      </Pressable>
    </View>
  );
}

export function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View style={{ flexDirection: "row", gap: 6, paddingVertical: 8 }} accessibilityLabel="جارٍ الكتابة">
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          }}
        />
      ))}
    </View>
  );
}
