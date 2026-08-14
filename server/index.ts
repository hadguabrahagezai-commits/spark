import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { platform } from "node:os";
import { JarvisEngine } from "../src/core/jarvis_engine";
import SystemMonitor, { getSystemMetrics } from "../src/modules/system_monitor";
import BusinessAutomation from "../src/modules/business_automation";
import VoiceEngine from "../src/modules/voice_engine";
import * as IntelligenceAgent from "../src/modules/intelligence_agent";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Startprüfung: welche Live-Dienste sind konfiguriert? (Keine Secrets im Log.)
  const { providerStatus } = await import("./llm");
  const ki = providerStatus();
  if (!ki.aktiv) {
    console.error(
      `[konfiguration] KI nicht verfügbar: AI_PROVIDER=${ki.gewuenscht}; der passende API-Schlüssel fehlt oder der Anbietername ist ungültig. KI-Routen antworten mit HTTP 503.`,
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("[konfiguration] Sprache nicht verfügbar: OPENAI_API_KEY fehlt. Sprachrouten antworten mit HTTP 503.");
  }
  if (process.env.REQUIRE_LIVE_SERVICES === "true" && !ki.aktiv) {
    throw new Error("Pflichtdienste sind nicht konfiguriert. Prüfe AI_PROVIDER, API-Schlüssel und REQUIRE_LIVE_SERVICES.");
  }
  log(
    `KI-Anbieter: ${ki.aktiv || "keiner konfiguriert"} · Google ${process.env.GOOGLE_CLIENT_ID ? "an" : "aus"} · ` +
      `Plaid ${process.env.PLAID_CLIENT_ID ? "an" : "aus"} · Supabase ${process.env.SUPABASE_URL ? "an" : "aus"}`,
    "spark",
  );
  const { checkSupabaseTables } = await import("./supabase");
  void checkSupabaseTables();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Der Port kommt aus der Umgebung (Railway, Render und Fly setzen PORT selbst),
  // sonst 5000.
  const port = parseInt(process.env.PORT || "5000", 10);

  const istWindows = platform() === "win32";
  const istProduktion = process.env.NODE_ENV === "production";

  // Bindeadresse:
  //  - HOST aus der .env hat immer Vorrang.
  //  - In Produktion (Container/PaaS) muss auf 0.0.0.0 gebunden werden, sonst
  //    erreicht der Load Balancer den Prozess nicht.
  //  - Lokal unter Windows wird 127.0.0.1 genutzt: Node 24 wirft dort bei
  //    0.0.0.0 in Verbindung mit manchen Netzwerk-Stacks ENOTSUP.
  const host =
    process.env.HOST?.trim() ||
    (istProduktion ? "0.0.0.0" : istWindows ? "127.0.0.1" : "0.0.0.0");

  // SO_REUSEPORT gibt es nur unter Linux. Unter Windows und macOS führt die
  // Option zu ENOTSUP bzw. wird stillschweigend ignoriert.
  const reusePort = platform() === "linux";

  function starte(bindHost: string | undefined, mitReusePort: boolean) {
    const optionen: { port: number; host?: string; reusePort?: boolean } = { port };
    if (bindHost) optionen.host = bindHost;
    if (mitReusePort) optionen.reusePort = true;

    httpServer.listen(optionen, () => {
      const angezeigt = bindHost ?? "alle Schnittstellen";
      log(`serving on port ${port} (${angezeigt})`);
      if (!istProduktion) {
        log(`http://${bindHost === "0.0.0.0" || !bindHost ? "localhost" : bindHost}:${port}`);
      }
    });
  }

  httpServer.on("error", (fehler: NodeJS.ErrnoException) => {
    // Windows/Node 24: 0.0.0.0 oder reusePort werden nicht unterstützt.
    // Einmalig ohne feste Adresse und ohne reusePort erneut versuchen.
    if (
      !istProduktion &&
      (fehler.code === "ENOTSUP" ||
        fehler.code === "EINVAL" ||
        fehler.code === "EADDRNOTAVAIL")
    ) {
      log(
        `Binden an ${host} fehlgeschlagen (${fehler.code}). Neuer Versuch ohne feste Adresse.`,
        "spark",
      );
      httpServer.removeAllListeners("error");
      httpServer.on("error", (zweiterFehler: NodeJS.ErrnoException) => {
        console.error("Server konnte nicht gestartet werden:", zweiterFehler);
        process.exit(1);
      });
      starte(undefined, false);
      return;
    }

    if (fehler.code === "EADDRINUSE") {
      console.error(
        `Port ${port} ist bereits belegt. Beende den anderen Prozess oder setze PORT in der .env auf einen freien Wert.`,
      );
      process.exit(1);
    }

    console.error("Server konnte nicht gestartet werden:", fehler);
    process.exit(1);
  });

  starte(host, reusePort);

  // Sauberes Herunterfahren, damit Railway/Render den Container zügig ersetzen kann.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      log(`${signal} empfangen — Server wird beendet.`, "spark");
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }

  // Initialize Jarvis integration (non-autonomous by default)
  try {
    const jarvis = new JarvisEngine({ dryRun: true });
    const monitor = new SystemMonitor(5000);
    const business = new BusinessAutomation({});
    // start monitor but keep jarvis in dry-run/safe mode
    monitor.start();
    await business.init();

    // expose jarvis on app locals for routes to use
    (app as any).locals.jarvis = { jarvis, monitor, business, VoiceEngine, IntelligenceAgent };

    // simple API for listing and running tasks
    app.get('/api/jarvis/tasks', (_req, res) => res.json({ ok: true, tasks: jarvis.listTasks() }));
    app.post('/api/jarvis/run/:id', async (req: any, res: any) => {
      try {
        await jarvis.runTask(req.params.id);
        res.json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ ok: false, error: String(e) });
      }
    });

    app.get('/api/jarvis/metrics', (_req, res) => {
      try {
        const snap = getSystemMetrics ? getSystemMetrics() : {};
        res.json({ ok: true, metrics: snap });
      } catch (e) {
        res.json({ ok: false, error: String(e) });
      }
    });
  } catch (e) {
    console.warn('Jarvis integration failed to initialize:', e);
  }
})();
