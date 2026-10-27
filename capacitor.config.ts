import type { CapacitorConfig } from "@capacitor/cli";

// The app needs its server (SSR + /api routes holding secrets), so the native shell loads the
// hosted site instead of a static bundle. Set CAP_SERVER_URL before `npm run cap:sync`
// (e.g. CAP_SERVER_URL=https://app.example.com). mobile/www is only the offline/unset fallback.
// See MOBILE.md.
const url = process.env.CAP_SERVER_URL || process.env.MOBILE_APP_URL;

const config: CapacitorConfig = {
  appId: "sa.mithaqalarabia.app",
  appName: "Mithaq",
  webDir: "mobile/www",
  backgroundColor: "#013041",
  server: {
    ...(url ? { url, errorPath: "index.html" } : {}),
    androidScheme: "https",
    // Keep Supabase auth/API traffic inside the app WebView instead of bouncing to the browser.
    allowNavigation: ["*.supabase.co"],
  },
};

export default config;
