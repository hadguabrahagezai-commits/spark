import express from 'express';
import path from 'path';
import { JarvisEngine } from '../core/jarvis_engine';
import SystemMonitor from '../modules/system_monitor';
import fs from 'fs/promises';

const app = express();
const port = Number(process.env.JARVIS_DASH_PORT || 4002);
const engine = new JarvisEngine({ dryRun: true });
const monitor = new SystemMonitor(3000);

monitor.start();

app.use('/dashboard', express.static(path.join(process.cwd(), 'public', 'dashboard')));

app.get('/api/logs/engine', async (req, res) => {
  try {
    const txt = await fs.readFile(path.resolve(process.cwd(), 'jarvis_engine.log'), 'utf8').catch(() => '');
    res.type('text/plain').send(txt);
  } catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

app.get('/api/tasks', (req, res) => {
  res.json({ tasks: engine.listTasks() });
});

app.get('/api/metrics', (req, res) => {
  try {
    const snap = monitor.getSystemMetrics ? monitor.getSystemMetrics() : {};
    res.json({ ok: true, metrics: snap });
  } catch (e) {
    res.json({ ok: false, error: String(e) });
  }
});

app.get('/', (req, res) => {
  res.redirect('/dashboard/');
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Jarvis dashboard listening on http://localhost:${port}/dashboard`);
});

export default app;
