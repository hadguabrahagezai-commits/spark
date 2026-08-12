/**
 * Ersatz für das npm-Paket `loglevel`.
 *
 * Grund: `loglevel` ist eine transitive Abhängigkeit von `livekit-client`
 * (über das HeyGen-Live-Avatar-SDK) und greift zur Speicherung der Log-Stufe
 * auf `window.localStorage` und `document.cookie` zu. Beides ist in der
 * Vorschau-Iframe der Plattform blockiert und führt zu einem abgelehnten Deploy.
 *
 * Dieser Shim bildet die komplette öffentliche API von `loglevel` nach,
 * hält die Log-Stufe aber ausschließlich im Arbeitsspeicher.
 */

type LevelName = "trace" | "debug" | "info" | "warn" | "error" | "silent";

const LEVELS: Record<string, number> = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5,
};

const METHODS: LevelName[] = ["trace", "debug", "info", "warn", "error"];

function noop() {
  /* absichtlich leer */
}

function resolveLevel(level: number | string): number {
  if (typeof level === "number") return level;
  const parsed = LEVELS[String(level).toUpperCase()];
  return parsed === undefined ? LEVELS.WARN : parsed;
}

export interface ShimLogger {
  levels: typeof LEVELS;
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  setLevel: (level: number | string, persist?: boolean) => void;
  getLevel: () => number;
  setDefaultLevel: (level: number | string) => void;
  resetLevel: () => void;
  enableAll: (persist?: boolean) => void;
  disableAll: (persist?: boolean) => void;
  methodFactory: (methodName: string) => (...args: unknown[]) => void;
  rebuild: () => void;
  name?: string;
  getLogger: (name: string) => ShimLogger;
  getLoggers: () => Record<string, ShimLogger>;
  noConflict: () => ShimLogger;
  default?: ShimLogger;
}

const registry: Record<string, ShimLogger> = {};

function createLogger(name?: string): ShimLogger {
  let current = LEVELS.WARN;

  const emit = (method: LevelName) => (...args: unknown[]) => {
    if (current > LEVELS[method.toUpperCase()]) return;
    const target = (console as unknown as Record<string, unknown>)[method];
    if (typeof target === "function") {
      (target as (...a: unknown[]) => void).apply(
        console,
        name ? [`[${name}]`, ...args] : args,
      );
    }
  };

  const logger: ShimLogger = {
    levels: LEVELS,
    name,
    trace: emit("trace"),
    debug: emit("debug"),
    log: emit("debug"),
    info: emit("info"),
    warn: emit("warn"),
    error: emit("error"),
    setLevel: (level) => {
      current = resolveLevel(level);
    },
    getLevel: () => current,
    setDefaultLevel: (level) => {
      current = resolveLevel(level);
    },
    resetLevel: () => {
      current = LEVELS.WARN;
    },
    enableAll: () => {
      current = LEVELS.TRACE;
    },
    disableAll: () => {
      current = LEVELS.SILENT;
    },
    methodFactory: () => noop,
    rebuild: noop,
    getLogger: (childName: string) => {
      if (!registry[childName]) registry[childName] = createLogger(childName);
      return registry[childName];
    },
    getLoggers: () => registry,
    noConflict: () => logger,
  };

  // Nachbildung der Methoden-Konstanten, die manche Bibliotheken direkt lesen.
  for (const method of METHODS) {
    void method;
  }

  return logger;
}

const root = createLogger();
root.default = root;

export const levels = LEVELS;
export const getLogger = root.getLogger;
export const getLoggers = root.getLoggers;
export const noConflict = root.noConflict;
export const setLevel = root.setLevel;
export const getLevel = root.getLevel;
export const setDefaultLevel = root.setDefaultLevel;
export const resetLevel = root.resetLevel;
export const enableAll = root.enableAll;
export const disableAll = root.disableAll;
export const methodFactory = root.methodFactory;
export const trace = root.trace;
export const debug = root.debug;
export const log = root.log;
export const info = root.info;
export const warn = root.warn;
export const error = root.error;

export default root;
