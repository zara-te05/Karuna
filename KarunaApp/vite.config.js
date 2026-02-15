import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  root: 'src_old',  // Le decimos a Vite que la raíz es src_old/
  build: {
    target: "esnext",
    outDir: '../dist',  // El build sale a dist/ en la raíz
    emptyOutDir: true
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});