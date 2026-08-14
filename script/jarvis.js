#!/usr/bin/env node
/*
  JARVIS CLI (safe stub)
  - Dieser CLI-Stub implementiert keine autonome Logik.
  - Er zeigt Persona-Informationen und erzeugt lokale Artefakt-Vorlagen.
  - Ausführung von generierten Skripten liegt bei dir (Master).
*/

const fs = require('fs');
const path = require('path');

function help() {
  console.log('JARVIS CLI — Safe Stub');
  console.log('Usage: node script/jarvis.js <command>');
  console.log('Commands:');
  console.log('  persona      Show persona info');
  console.log('  gen-skeleton Generate a project skeleton file (local, non-executing)');
  console.log('  protocol     Open JARVIS_PROTOCOL.md');
}

function loadConfig() {
  try {
    const cfg = fs.readFileSync(path.join(__dirname, '..', 'config', 'jarvis.config.json'), 'utf8');
    return JSON.parse(cfg);
  } catch (e) {
    return null;
  }
}

const cmd = process.argv[2];
if (!cmd || cmd === 'help') return help();

if (cmd === 'persona') {
  const cfg = loadConfig();
  if (!cfg) return console.error('Keine Konfiguration gefunden at config/jarvis.config.json');
  console.log('Persona:', cfg.persona.displayName);
  console.log('Tone:', cfg.persona.tone);
  console.log('Autonomy enabled:', cfg.autonomy.enabled);
  process.exit(0);
}

if (cmd === 'gen-skeleton') {
  const out = path.join(process.cwd(), 'JARVIS_SKEL.txt');
  const content = `JARVIS Skeleton generated on ${new Date().toISOString()}\n\nNote: This is a template. No actions executed.`;
  fs.writeFileSync(out, content, 'utf8');
  console.log('Wrote', out);
  process.exit(0);
}

if (cmd === 'protocol') {
  const md = path.join(process.cwd(), 'JARVIS_PROTOCOL.md');
  if (fs.existsSync(md)) {
    console.log('\n--- JARVIS Protocol ---\n');
    console.log(fs.readFileSync(md, 'utf8'));
  } else console.error('Protocol doc not found');
  process.exit(0);
}

help();
