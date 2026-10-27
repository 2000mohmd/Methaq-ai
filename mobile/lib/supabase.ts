import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState } from "react-native";

const extra = Constants.expoConfig?.extra as { supabaseUrl: string; supabaseKey: string; apiUrl: string };

/** Same Supabase project and RLS as the website; the publishable key is safe to ship. */
export const supabase = createClient(extra.supabaseUrl, extra.supabaseKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener("change", (s) => {
  if (s === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/** The hosted website's server; the AI routes (/api/chat, /api/audit, /api/ocr) live there. */
export const API_URL = extra.apiUrl.replace(/\/$/, "");
