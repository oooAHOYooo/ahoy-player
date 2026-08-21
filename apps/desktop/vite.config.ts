import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ahoy/player-core": path.resolve(__dirname, "../../packages/core/src"),
      "@ahoy/player-media-pipeline": path.resolve(
        __dirname,
        "../../packages/media-pipeline/src"
      ),
      "@ahoy/player-react": path.resolve(__dirname, "../../packages/player-react/src"),
      "@ahoy/player-ui-dial": path.resolve(
        __dirname,
        "../../packages/ui-dial/src"
      ),
      "@ahoy/player-web-adapters": path.resolve(__dirname, "../../packages/web-adapters/src")
    }
  },
  server: { host: "127.0.0.1", port: 5173, strictPort: true }
});
