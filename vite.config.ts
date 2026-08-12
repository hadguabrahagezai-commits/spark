import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Manche Fremdpakete (hier: das in `livekit-client` fest eingebaute `loglevel`,
 * das über das HeyGen-Live-Avatar-SDK hereinkommt) speichern ihre Log-Stufe in
 * `localStorage` bzw. `document.cookie`. Beides ist in der Vorschau-Iframe der
 * Plattform blockiert. Dieses Plugin ersetzt solche Zugriffe in
 * node_modules-Code durch einen speicherfreien Ersatz — rein kosmetische
 * Log-Einstellungen, die Funktionalität bleibt unberührt.
 */
function ersetzeBlockierteSpeicherAPIs(): Plugin {
  const prelude =
    "const __sparkSpeicher = { __c: {}, getItem(k){return this.__c[k] ?? null;}, " +
    "setItem(k,v){this.__c[k]=String(v);}, removeItem(k){delete this.__c[k];}, " +
    "clear(){this.__c={};}, key(i){return Object.keys(this.__c)[i] ?? null;}, " +
    "get length(){return Object.keys(this.__c).length;} };\n" +
    "const __sparkKeksAblage = { value: \"\" };\n";

  return {
    name: "spark-ersetze-blockierte-speicher-apis",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("node_modules")) return null;
      if (!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(code)) return null;

      const patched = code
        .replace(/window\.localStorage/g, "__sparkSpeicher")
        .replace(/window\.sessionStorage/g, "__sparkSpeicher")
        .replace(/window\.document\.cookie/g, "__sparkKeksAblage.value")
        .replace(/\bwindow\.indexedDB\b/g, "undefined");

      if (patched === code) return null;
      return { code: prelude + patched, map: null };
    },
  };
}

export default defineConfig({
  plugins: [ersetzeBlockierteSpeicherAPIs(), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      // `loglevel` (transitiv über livekit-client / HeyGen-SDK) nutzt localStorage
      // und Cookies. Beides ist in der Vorschau-Iframe blockiert, daher ein
      // speicherfreier Ersatz.
      loglevel: path.resolve(import.meta.dirname, "client", "src", "lib", "loglevel-shim.ts"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
