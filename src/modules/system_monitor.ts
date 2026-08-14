import os from 'os';
import { EventEmitter } from 'events';

export type SystemMetrics = {
  timestamp: number;
  loadavg: number[];
  cpus: { model: string; speed: number; times: NodeJS.Dict<number> }[];
  memory: { total: number; free: number; used: number };
  uptime: number;
};

export function getSystemMetrics(): SystemMetrics {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    timestamp: Date.now(),
    loadavg: os.loadavg(),
    cpus: os.cpus(),
    memory: { total, free, used: total - free },
    uptime: os.uptime(),
  };
}

export class SystemMonitor extends EventEmitter {
  private timer?: NodeJS.Timeout;
  private interval: number;

  constructor(interval = 5000) {
    super();
    this.interval = interval;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        const m = getSystemMetrics();
        this.emit('metrics', m);
      } catch (e) {
        this.emit('error', e);
      }
    }, this.interval);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}

export default SystemMonitor;
