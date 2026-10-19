import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage } from "node:http";
import { defineConfig, mergeConfig, type Plugin } from "vite-plus";
import baseConfig from "./vite.config";

const BASE = "/app/";
const siteDir = path.resolve(__dirname, "dist-web");
const appDir = path.join(siteDir, "app");

const websiteUrl = process.env.R0_WEBSITE_URL?.trim() || "http://localhost:3000";

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' blob: 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Cloud workspaces are reached over a socket to the r0-cloud Worker.
  "connect-src 'self' https://realtime.adshkumar.is-a.dev wss://realtime.adshkumar.is-a.dev",
  "worker-src 'self' blob:",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  `Content-Security-Policy: ${contentSecurityPolicy}`,
  "X-Frame-Options: DENY",
  "X-Content-Type-Options: nosniff",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security: max-age=63072000; includeSubDomains; preload",
];

/** The Cloudflare `_headers` file: security headers for the app, long caching for hashed files. */
function renderHeadersFile() {
  const block = (pattern: string, headers: string[]) =>
    `${pattern}\n${headers.map((header) => `  ${header}`).join("\n")}\n`;
  return [
    block("/app", securityHeaders),
    block("/app/*", securityHeaders),
    block("/app/assets/*", ["Cache-Control: public, max-age=31536000, immutable"]),
  ].join("");
}

function isAppPage(request: IncomingMessage) {
  const url = request.url ?? "";
  if (!/^\/app(\/|\?|$)/.test(url)) return false;
  const pathname = url.split("?")[0] ?? "";
  return !path.extname(pathname) && Boolean(request.headers.accept?.includes("text/html"));
}

function webAppOutput(): Plugin {
  return {
    name: "r0-web-app-output",
    enforce: "post",
    configureServer(server) {
      // Every page under /app is the web app, as on adshkumar.is-a.dev.
      server.middlewares.use((request, _response, next) => {
        if (isAppPage(request)) request.url = `${BASE}web.html`;
        next();
      });
    },
    buildStart() {
      if (this.meta.watchMode) return;
      fs.rmSync(siteDir, { recursive: true, force: true });
    },
    generateBundle(_options, bundle) {
      const page = bundle["web.html"];
      if (page) page.fileName = "index.html";
    },
    writeBundle() {
      fs.writeFileSync(path.join(siteDir, "_headers"), renderHeadersFile());
    },
  };
}

// Builds the real workbench as a static site with the Tauri backend replaced by an in-memory one
// (src/features/web-workbench). It is never part of the desktop bundle, whose build only starts
// from index.html.
export default mergeConfig(
  baseConfig,
  defineConfig({
    base: BASE,
    define: {
      "import.meta.env.VITE_R0_WEB": JSON.stringify("true"),
    },
    server: {
      host: "localhost",
      port: 1430,
      hmr: false,
      proxy: {
        "^/(?!app(?:/|\\?|$))": { target: websiteUrl, changeOrigin: true, ws: true },
      },
    },
    build: {
      outDir: appDir,
      emptyOutDir: true,
      rolldownOptions: {
        input: { index: path.resolve(__dirname, "web.html") },
      },
    },
    plugins: [webAppOutput()],
  }),
);
