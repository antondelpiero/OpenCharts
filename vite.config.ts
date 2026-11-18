import { defineConfig, loadEnv, type Plugin, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { buildCsp, buildHeadersFile, extraConnectFromEnv } from "./src/hyperliquid/compliance/csp.ts";

/**
 * Production-only security headers. The strict CSP is injected as a <meta> tag
 * (so it also applies on hosts that cannot set headers) and a matching
 * dist/_headers is written. Dev is untouched: the dev server needs inline
 * scripts and a websocket for HMR, which a strict CSP would break.
 */
function securityHeaders(): Plugin {
  let csp = "";
  let headersFile = "";
  let outDir = "";
  return {
    name: "openbroker-security-headers",
    apply: "build",
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, ["VITE_"]);
      const opts = {
        extraConnect: extraConnectFromEnv(env),
        allowTradingView: env.VITE_CSP_ALLOW_TRADINGVIEW === "1",
      };
      csp = buildCsp(opts);
      headersFile = buildHeadersFile(opts);
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml() {
      return [
        { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: csp }, injectTo: "head-prepend" },
      ];
    },
    closeBundle() {
      // Same policy plus header-only directives; replaces the static public/_headers copy.
      if (fs.existsSync(outDir)) fs.writeFileSync(path.join(outDir, "_headers"), headersFile);
    },
  };
}

const config: UserConfig = {
  // GitHub Pages serves a project site from /<repo>/, so the demo workflow sets
  // BASE_PATH. Local builds and self-hosting stay at the domain root.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), securityHeaders()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@propsim/types": path.resolve(__dirname, "./src/vendor/types.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-router") ||
              id.includes("/@radix-ui/") ||
              id.includes("/@tanstack/") ||
              id.includes("/zustand/") ||
              id.includes("/scheduler/")
            ) {
              return "vendor-react";
            }
            if (id.includes("/lucide-react/")) {
              return "vendor-icons";
            }
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
};

/**
 * Point the dev server's `/api` proxy at API_PROXY_TARGET from the active mode's
 * env file (.env.development: local trading-api; .env.staging: the deployed
 * one, via `npm run dev -- --mode staging`). Unset keeps the target above. Not a
 * VITE_ variable, so it never reaches the browser bundle.
 */
export default defineConfig(({ mode }) => {
  const target = loadEnv(mode, process.cwd(), "").API_PROXY_TARGET;
  if (!target) return config;
  return {
    ...config,
    server: {
      ...config.server,
      proxy: { ...config.server?.proxy, "/api": { target, changeOrigin: true } },
    },
  };
});
