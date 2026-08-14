import ts from 'typescript';
import fs from 'fs/promises';
import path from 'path';

export type PatchSuggestion = { file: string; range: [number, number]; replacement: string; reason: string };

export async function analyzeProject(root = process.cwd()): Promise<{ diagnostics: string[]; suggestions: PatchSuggestion[] }> {
  const diagnostics: string[] = [];
  const suggestions: PatchSuggestion[] = [];
  try {
    const configPath = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
      diagnostics.push('No tsconfig.json found');
      return { diagnostics, suggestions };
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
    // Guard: if parsed.fileNames is very large, skip full program to avoid OOM
    if ((parsed.fileNames?.length ?? 0) > 500) {
      diagnostics.push(`Project too large for full TS analysis (${parsed.fileNames.length} files). Running lightweight scan.`);
      const light = await lightweightScan(root);
      return light;
    }

    const program = ts.createProgram(parsed.fileNames, parsed.options);
    const diags = ts.getPreEmitDiagnostics(program);
    for (const d of diags) {
      const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      const file = d.file?.fileName ?? '<unknown>';
      const line = d.file && d.start ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null;
      diagnostics.push(`${file}${line ? `:${line}` : ''} — ${message}`);
      if (message.toLowerCase().includes('is declared but its value is never read')) {
        suggestions.push({ file, range: [d.start ?? 0, (d.start ?? 0) + (d.length ?? 0)], replacement: `/* unused variable cleaned */`, reason: message });
      }
    }
    return { diagnostics, suggestions };
  } catch (e: any) {
    diagnostics.push('TS analysis failed: ' + String(e?.message ?? e));
    diagnostics.push('Falling back to lightweight scan');
    const light = await lightweightScan(root);
    return light;
  }
}

async function lightweightScan(root: string) : Promise<{ diagnostics: string[]; suggestions: PatchSuggestion[] }> {
  const diagnostics: string[] = [];
  const suggestions: PatchSuggestion[] = [];
  const files = await findFiles(root, ['.ts', '.tsx', '.js', '.jsx']);
  diagnostics.push(`Light scan: checking ${files.length} files`);
  for (const f of files) {
    try {
      const c = await fs.readFile(f, 'utf8');
      if (c.includes('TODO')) suggestions.push({ file: f, range: [0,0], replacement: '', reason: 'Contains TODO' });
      if (c.match(/\bany\b/)) suggestions.push({ file: f, range: [0,0], replacement: '', reason: 'Contains any type usage' });
      if (c.length > 200000) diagnostics.push(`${f} — large file (${c.length} bytes)`);
    } catch {}
  }
  return { diagnostics, suggestions };
}

async function findFiles(dir: string, exts: string[], out: string[] = []) : Promise<string[]> {
  let entries: string[] = [];
  try { entries = await fs.readdir(dir); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e);
    try {
      const st = await fs.stat(full);
      if (st.isDirectory()) {
        if (e === 'node_modules' || e === '.git') continue;
        await findFiles(full, exts, out);
      } else {
        if (exts.includes(path.extname(e))) out.push(full);
      }
    } catch {}
  }
  return out;
}

export async function applyPatches(suggestions: PatchSuggestion[], opts?: { write?: boolean; confirm?: boolean }) {
  const write = !!opts?.write && !!opts?.confirm && process.env.JARVIS_ALLOW_MODIFY === '1';
  const results: any[] = [];
  for (const s of suggestions) {
    if (!write) {
      results.push({ file: s.file, applied: false, reason: 'write-disabled' });
      continue;
    }
    const content = await fs.readFile(s.file, 'utf8');
    const before = content.slice(0, s.range[0]);
    const after = content.slice(s.range[1]);
    const updated = before + s.replacement + after;
    await fs.writeFile(s.file, updated, 'utf8');
    results.push({ file: s.file, applied: true });
  }
  return results;
}

export default { analyzeProject, applyPatches };
