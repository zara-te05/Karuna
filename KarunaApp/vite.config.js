import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  root: 'src/pages',
  build: {
    target: "esnext",
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'src/pages/index.html',
        aulas: 'src/pages/aulas.html',
        crear_aulas: 'src/pages/crear_aulas.html',
        lobby_aulas: 'src/pages/lobby_aulas.html',
        manejo_aulas: 'src/pages/manejo_aulas.html',
        profile: 'src/pages/profile.html',
      }
    }
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