import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  // Configuração para build de produção
  build: {
    outDir: "dist",
    sourcemap: false,
    // Otimizações para produção
    minify: "esbuild", // Usa esbuild que já vem com Vite (mais rápido que terser)
  },
});
