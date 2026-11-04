import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // rutas relativas: funciona en la raíz de Cloudflare Pages y en github.io/<repo>/
  server: { port: 5173 },
});
