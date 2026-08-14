import fs from 'fs/promises';
import path from 'path';

type TaskFn = (meta: { dryRun: boolean }) => Promise<void> | void;

export type Task = {
  id: string;
  name: string;
  fn: TaskFn;
  interval?: number; // ms for periodic tasks
  lastRun?: number;
};

export class JarvisEngine {
  private tasks = new Map<string, Task>();
  private timers = new Map<string, NodeJS.Timeout>();
  private running = false;
  public dryRun = false; // standardmäßig auf autonom (false) geschaltet
  public logFile: string;

  constructor(opts?: { dryRun?: boolean; logFile?: string }) {
    // Wenn dryRun nicht explizit als true übergeben wird, bleibt es strikt auf false (autonom)
    if (opts?.dryRun === true) {
      this.dryRun = true;
    } else {
      this.dryRun = false;
    }
    this.logFile = opts?.logFile ?? path.resolve(process.cwd(), 'jarvis_engine.log');
  }

  async log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    await fs.appendFile(this.logFile, line).catch(() => {});
  }

  registerTask(task: Task) {
    if (this.tasks.has(task.id)) throw new Error('Task exists: ' + task.id);
    this.tasks.set(task.id, task);
    this.log(`Registered task ${task.id} (${task.name})`);
  }

  unregisterTask(id: string) {
    if (!this.tasks.has(id)) return;
    this.tasks.delete(id);
    const t = this.timers.get(id);
    if (t) clearInterval(t);
    this.timers.delete(id);
    this.log(`Unregistered task ${id}`);
  }

  async runTask(id: string) {
    const task = this.tasks.get(id);
    if (!task) throw new Error('No such task: ' + id);
    try {
      await this.log(`Running task ${id} (dryRun=${this.dryRun})`);
      const res = await task.fn({ dryRun: this.dryRun });
      task.lastRun = Date.now();
      await this.log(`Completed task ${id}`);
      return res;
    } catch (err: any) {
      await this.log(`Task ${id} failed: ${String(err.message ?? err)}`);
      task.lastRun = Date.now();
      return;
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    for (const [id, task] of Array.from(this.tasks.entries())) {
      if (task.interval && task.interval > 0) {
        const timer = setInterval(() => void this.runTask(id), task.interval);
        this.timers.set(id, timer);
      }
    }
    this.log('Engine started in autonomous mode');
  }

  stop() {
    for (const t of Array.from(this.timers.values())) clearInterval(t);
    this.timers.clear();
    this.running = false;
    void this.log('Engine stopped');
  }

  listTasks() {
    return Array.from(this.tasks.values()).map(t => ({ id: t.id, name: t.name, interval: t.interval ?? null, lastRun: t.lastRun ?? null }));
  }
}

export default JarvisEngine;