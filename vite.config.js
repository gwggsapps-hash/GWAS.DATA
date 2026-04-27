import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      // xlsx is loaded via <script> in index.html, not bundled
      external: [],
      output: {
        globals: {},
      },
    },
  },
});
