import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { C, F } from "../lib/theme";
import { BrandMark, BrandPattern, MARK_RATIO } from "./brand-mark";

/** Must match imageWidth of the expo-splash-screen plugin in app.json, so native → animated is seamless. */
const NATIVE_MARK = 120;

/**
 * Branded intro shown right after the native splash hides (~2.2s), then fades
 * into the app. Starts on the exact native frame (teal mark, navy background).
 */
export function AuthSplash({ onDone }: { onDone: () => void }) {
  const v = useRef({
    bg: new Animated.Value(0), // pattern + gradient
    lift: new Animated.Value(0), // mark moves up / shrinks
    white: new Animated.Value(0), // teal → white mark
    halo: new Animated.Value(0),
    word: new Animated.Value(0),
    tag: new Animated.Value(0),
    line: new Animated.Value(0),
    out: new Animated.Value(1),
  }).current;

  useEffect(() => {
    const t = (value: Animated.Value, toValue: number, duration: number, delay = 0) =>
      Animated.timing(value, { toValue, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const anim = Animated.sequence([
      Animated.parallel([
        t(v.bg, 1, 700),
        t(v.halo, 1, 1100, 100),
        t(v.lift, 1, 650, 150),
        t(v.white, 1, 500, 300),
        t(v.word, 1, 550, 550),
        t(v.line, 1, 500, 750),
        t(v.tag, 1, 500, 800),
      ]),
      Animated.delay(650),
      t(v.out, 0, 380),
    ]);
    anim.start(({ finished }) => finished && onDone());
    return () => anim.stop();
  }, [v, onDone]);

  const markStyle = {
    transform: [
      { translateY: v.lift.interpolate({ inputRange: [0, 1], outputRange: [0, -56] }) },
      { scale: v.lift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 0.82] }) },
    ],
  };
  const fadeUp = (a: Animated.Value) => ({
    opacity: a,
    transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: v.out }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: v.bg }]}>
        <LinearGradient colors={[C.navy, C.navySoft, C.navy]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        <BrandPattern opacity={0.07} />
      </Animated.View>

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.halo,
            {
              opacity: v.halo.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.35, 0.12] }),
              transform: [
                { translateY: -56 },
                { scale: v.halo.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.25] }) },
              ],
            },
          ]}
        />
        <Animated.View style={markStyle}>
          <BrandMark size={NATIVE_MARK} color={C.teal} />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: v.white }]}>
            <BrandMark size={NATIVE_MARK} color="#ffffff" />
          </Animated.View>
        </Animated.View>

        <View style={styles.texts}>
          <Animated.Text style={[styles.word, fadeUp(v.word)]}>ميثاق العربية</Animated.Text>
          <Animated.View style={[styles.line, { opacity: v.line, transform: [{ scaleX: v.line }] }]} />
          <Animated.Text style={[styles.tag, fadeUp(v.tag)]}>مساعدك القانوني السعودي</Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const MARK_H = NATIVE_MARK * MARK_RATIO;

const styles = StyleSheet.create({
  root: { backgroundColor: C.navy, zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: C.teal,
  },
  // Text block sits below the (lifted) mark without shifting the mark off the native position.
  texts: { position: "absolute", top: "50%", marginTop: MARK_H / 2 - 20, alignItems: "center" },
  word: { fontFamily: F.bold, fontSize: 32, color: "#ffffff", textAlign: "center", lineHeight: 48 },
  line: { width: 44, height: 3, borderRadius: 2, backgroundColor: C.teal, marginVertical: 10 },
  tag: { fontFamily: F.medium, fontSize: 15, color: "rgba(255,255,255,0.72)", textAlign: "center" },
});
