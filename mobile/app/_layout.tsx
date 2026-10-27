import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import type { Session } from "@supabase/supabase-js";
import { type Href, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";

import { AuthSplash } from "../components/auth-splash";
import { onboardingSignal } from "../components/auth-ui";
import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";

// Keep the native splash up until fonts + session (+ onboarding state) are known.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [onboarded, setOnboarded] = useState<boolean | undefined>(undefined);
  const [intro, setIntro] = useState(true);
  const segments = useSegments();
  const router = useRouter();
  const uid = session?.user.id;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    onboardingSignal.done = () => setOnboarded(true);
    return () => data.subscription.unsubscribe();
  }, []);

  // profiles.onboarded for the signed-in user (same gate as the website's /app shell).
  useEffect(() => {
    setOnboarded(undefined);
    if (!uid) return;
    let live = true;
    (async () => {
      const load = () => supabase.from("profiles").select("onboarded").eq("id", uid).maybeSingle();
      let { data, error } = await load();
      if (data && !data.onboarded) {
        // Pending invitations (team member / client) join the firm and mark the profile onboarded.
        const { data: claimed } = await supabase.rpc("claim_invitations");
        if (typeof claimed === "number" && claimed > 0) ({ data, error } = await load());
      }
      // On a read error, let them in rather than risk creating a duplicate workspace.
      if (live) setOnboarded(error ? true : !!data?.onboarded);
    })();
    return () => {
      live = false;
    };
  }, [uid]);

  const ready = (fontsLoaded || !!fontError) && session !== undefined && (!session || onboarded !== undefined);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Route guard: signed out → welcome; not onboarded → onboarding; otherwise → app.
  const top = segments[0] as string | undefined;
  useEffect(() => {
    if (!ready) return;
    const inAuth = top === "(auth)" || top === "login";
    let target: Href | null = null;
    if (!session) target = inAuth ? null : "/welcome";
    else if (!onboarded) target = top === "onboarding" ? null : "/onboarding";
    else if (!top || top === "index" || inAuth || top === "onboarding") target = "/(tabs)/chat";
    if (target) router.replace(target);
  }, [ready, session, onboarded, top, router]);

  const endIntro = useCallback(() => setIntro(false), []);
  const navyScreen = intro || !session || !onboarded;

  return (
    <>
      <StatusBar style={navyScreen ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.navy } }}>
        <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: C.surface }, animation: "fade" }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      </Stack>
      {ready && intro && <AuthSplash onDone={endIntro} />}
    </>
  );
}
