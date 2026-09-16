import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,

    // Local frontend requests /api/* to the FastAPI backend.
    // Without this proxy Vite returns index.html for /api requests,
    // which causes JSON.parse / "Unexpected token <" errors.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
