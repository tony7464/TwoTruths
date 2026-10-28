// Dev server for e2e/regress.js only.
// client/vite.config.js always proxies /api to port 5555. This file uses
// E2E_API_PORT instead, so a developer's npm start is not involved.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, "../client");
const requireFromClient = createRequire(path.join(clientDir, "package.json"));

async function loadDefault(specifier) {
  const file = pathToFileURL(requireFromClient.resolve(specifier)).href;
  const loaded = await import(file);
  return loaded.default;
}

export default async function e2eViteConfig() {
  const react = await loadDefault("@vitejs/plugin-react");
  const tailwindcss = await loadDefault("@tailwindcss/vite");
  const apiPort = process.env.E2E_API_PORT || "5565";
  const webPort = Number(process.env.E2E_WEB_PORT || "5183");

  return {
    root: clientDir,
    plugins: [react(), tailwindcss()],
    server: {
      host: "127.0.0.1",
      port: webPort,
      strictPort: true,
      proxy: {
        "/api": `http://127.0.0.1:${apiPort}`,
      },
    },
  };
}
