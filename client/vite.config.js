import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // Keep three, the react-three packages, gsap, and react in their own files.
        // The cube stays a dynamic import, so the flat pages do not download it.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            { name: "three", test: /node_modules[\\/]three[\\/]/, priority: 30 },
            {
              name: "react-three",
              test: /node_modules[\\/]@react-three[\\/]/,
              priority: 20,
              includeDependenciesRecursively: false,
            },
            {
              name: "gsap",
              test: /node_modules[\\/]gsap[\\/]/,
              priority: 20,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
    // three.js is one lazy chunk: 736.97 kB minified (736970 bytes). The cube
    // route is a dynamic import, so the flat pages never download it. 750 sits
    // just above that chunk; the default 500 kB warning would flag it otherwise.
    chunkSizeWarningLimit: 750,
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:5555",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
  },
});
