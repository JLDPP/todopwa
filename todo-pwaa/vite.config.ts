
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Service worker personalizado para manejar
      // notificaciones push y sincronización offline.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

      // Mostrar aviso cuando exista una nueva versión.
      registerType: "prompt",

      injectManifest: {
        globPatterns: [
          "**/*.{js,css,html,png,svg,ico,webmanifest}",
        ],

        // No almacenar capturas pesadas en precaché.
        globIgnores: [
          "**/screenshots/**",
        ],

        // Aumentar límite de 2 MiB a 5 MiB.
        // Permite incluir el logo de 2.36 MB.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },

      manifest: {
        id: "/",
        name: "To-Do PWA",
        short_name: "To-Do",
        description:
          "Organiza tus tareas, con o sin conexión, y recibe recordatorios.",

        lang: "es-MX",
        start_url: "/dashboard",
        scope: "/",
        display: "standalone",

        background_color: "#121a2e",
        theme_color: "#121a2e",

        icons: [
          {
            src: "/icons/icon192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon512.png",
            sizes: "512x512",
            type: "image/png",
          },

          // Ícono maskable opcional:
          // {
          //   src: "/icons/maskable512.png",
          //   sizes: "512x512",
          //   type: "image/png",
          //   purpose: "maskable",
          // },
        ],

        screenshots: [
          {
            src: "/screenshots/captura.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Lista de tareas en escritorio",
          },
        ],
      },

      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
      },
    }),
  ],
});
