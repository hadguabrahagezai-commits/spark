import path from 'path';
import fs from 'fs/promises';

type Lead = { id: string; email?: string; name?: string; meta?: Record<string, any> };

export class BusinessAutomation {
  private queue: Lead[] = [];
  private outdir: string;

  constructor(opts?: { outdir?: string }) {
    this.outdir = opts?.outdir ?? path.resolve(process.cwd(), 'business_out');
  }

  async init() {
    await fs.mkdir(this.outdir, { recursive: true }).catch(() => {});
  }

  enqueue(lead: Lead) {
    this.queue.push(lead);
  }

  list() {
    return [...this.queue];
  }

  async scheduleEmail(lead: Lead, subject: string, body: string, dryRun = false) {
    const filename = path.join(this.outdir, `${Date.now()}-${lead.id || 'lead'}.eml`);
    const content = `To: ${lead.email || 'n/a'}\nSubject: ${subject}\n\n${body}`;
    
    if (dryRun) {
      await fs.writeFile(filename + '.dry', content, 'utf8');
      return { ok: true, dryRun: true, path: filename + '.dry' };
    }

    // Direkter, echter Schreib- und Ausführungsmodus ohne Dry-Run-Sperre
    await fs.writeFile(filename, content, 'utf8');
    return { ok: true, dryRun: false, path: filename };
  }

  async processQueue(dryRun = false) {
    await this.init();
    const results: any[] = [];
    while (this.queue.length) {
      const lead = this.queue.shift()!;
      const res = await this.scheduleEmail(lead, 'Willkommen', `Hallo ${lead.name || 'Freund'},\n\nDies ist deine automatisierte Nachricht.`, dryRun);
      results.push({ lead: lead.id, result: res });
    }
    return results;
  }
}

export default BusinessAutomation;