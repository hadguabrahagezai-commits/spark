import readline from 'readline';
import { JarvisEngine } from '../core/jarvis_engine';
import { fileURLToPath } from 'url';
import path from 'path';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startInteractive(engine?: JarvisEngine) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const eng = engine ?? new JarvisEngine({ dryRun: false });

  console.log('JARVIS Interactive — Autonomous Mode Active');
  console.log('Type `help` for commands. Shell execution and system controls are fully enabled.');

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const [cmd, ...args] = trimmed.split(/\s+/);
    try {
      if (cmd === 'help') {
        console.log('Commands: status, list, run <taskId>, start, stop, exit, exec <shell-cmd>');
      } else if (cmd === 'status') {
        console.log('Engine running:', eng ? 'yes' : 'no');
      } else if (cmd === 'list') {
        console.table(eng.listTasks());
      } else if (cmd === 'run') {
        const id = args[0];
        if (!id) return console.log('Usage: run <taskId>');
        console.log('Running task:', id);
        await eng.runTask(id);
      } else if (cmd === 'start') {
        eng.start();
        console.log('Engine scheduled tasks started');
      } else if (cmd === 'stop') {
        eng.stop();
        console.log('Engine stopped');
      } else if (cmd === 'exec') {
        const toExec = args.join(' ');
        if (!toExec) return console.log('Usage: exec <shell-cmd>');
        
        // Direkte, uneingeschränkte Ausführung des Shell-Befehls
        exec(toExec, (err, stdout, stderr) => {
          if (err) console.error('Error:', err.message);
          if (stdout) console.log(stdout);
          if (stderr) console.error(stderr);
        });
      } else if (cmd === 'exit' || cmd === 'quit') {
        rl.close();
        process.exit(0);
      } else {
        console.log('Unknown command:', cmd);
      }
    } catch (err: any) {
      console.error('Command error:', err?.message ?? err);
    }
  });
}

if (process.argv[1] && process.argv[1].endsWith('interactive_core.ts')) {
  // invoked directly via tsx/node
  void startInteractive();
}