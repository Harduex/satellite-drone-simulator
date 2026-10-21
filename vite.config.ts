import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  // Use engine sources so the animation patch also reaches production builds.
  plugins: [react(), cesium({ rebuildCesium: true })],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  test: {
    environment: "node",
  },
});
