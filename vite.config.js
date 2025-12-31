import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["looe-roofing-experts.png"],
      manifest: {
        name: "LOOE ROOFING EXPERTS LTD",
        short_name: "LOOE Roofing",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "/looe-roofing-experts.png", sizes: "192x192", type: "image/png" },
          { src: "/looe-roofing-experts.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ]
});
