import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Standalone config for self-hosting (no Lovable wrapper). Use: npm run build:standalone / dev:standalone. Server code reads secrets from process.env,
// so load every .env value into it for `vite dev` too.
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    server: { port: 3000, host: true },
    plugins: [
      tsConfigPaths(),
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      tanstackStart({ server: { entry: "server" } }),
      viteReact(),
      tailwindcss(),
      nitro(), // builds a Node server in .output/ by default; set NITRO_PRESET for other hosts
    ],
  };
});
