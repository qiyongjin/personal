import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig(({ mode }) => {
  // Read only this frontend project's environment; API credentials never enter its build.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const proxy = {
    "/api": {
      target: env.API_PROXY_TARGET || "http://127.0.0.1:3001",
      changeOrigin: false,
    },
  };
  return {
    build: {
      outDir: path.resolve(__dirname, '../dist'),
    },
    emptyOutDir: true, 
    server: {
      port: Number(env.VITE_DEV_PORT || 5173),
      strictPort: true,
      proxy,
    },
    preview: { proxy },
    resolve: {
      alias: {
        "@": "/src",
        i18n: "/src/i18n",
        lib: "/src/lib",
        pages: "/src/pages",
        router: "/src/router",
        components: "/src/components",
      },
    },
    plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler"]] } })],
  };
});
