import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

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
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL("./index.html", import.meta.url)),
          print: fileURLToPath(new URL("./print.html", import.meta.url)),
        },
      },
    },
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
