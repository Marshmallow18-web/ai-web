import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000",
      "/v1/traces": "http://localhost:4000",
      "/loki": "http://localhost:4000",
      "/metrics": "http://localhost:4000",
    },
  },
});
