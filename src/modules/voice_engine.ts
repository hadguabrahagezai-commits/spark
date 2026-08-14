import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

type SpeakOptions = { voice?: string; rate?: number; pitch?: number; outputFile?: string };

const LOG = path.resolve(process.cwd(), 'voice_engine.log');

export async function log(msg: string) {
  await fs.appendFile(LOG, `[${new Date().toISOString()}] ${msg}\n`).catch(() => {});
}

export const VoiceEngine = {
  async speak(text: string, opts?: SpeakOptions & { dryRun?: boolean }) {
    const envDry = (process.env.JARVIS_TTS_DRY === '1') || (process.env.JARVIS_ENABLE_TTS !== '1');
    const dryRun = opts?.dryRun ?? envDry;
    await log(`speak requested (dryRun=${dryRun}): ${String(text).slice(0, 200)}`);
    if (dryRun) return { ok: true, dryRun: true };

    // If enabled, and a platform binary is available, attempt a local TTS via 'say' (mac) or PowerShell on Windows.
    // This will only run when env JARVIS_ENABLE_TTS=1 is set by the user.
    if (process.platform === 'darwin') {
      const p = spawn('say', [text]);
      p.on('close', code => void log(`say exited ${code}`));
      return { ok: true };
    }

    if (process.platform === 'win32') {
      // Try PowerShell SAPI.SpVoice (may not be available in restricted environments).
      const script = `Add-Type –AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak(\"${text.replace(/\"/g, '\\"')}\")`;
      const p = spawn('powershell', ['-Command', script], { windowsHide: true });
      p.on('close', code => void log(`powershell tts exited ${code}`));
      return { ok: true };
    }

    // Fallback: write text to an output file if requested
    if (opts?.outputFile) {
      const out = path.resolve(process.cwd(), opts.outputFile);
      await fs.writeFile(out, text, 'utf8');
      await log(`Wrote TTS fallback file ${out}`);
      return { ok: true, path: out };
    }

    await log('No TTS provider available for this platform');
    return { ok: false, reason: 'no-provider' };
  },

  async transcribe(filePath: string, opts?: { dryRun?: boolean }) {
    const envDry = (process.env.JARVIS_STT_DRY === '1') || (process.env.JARVIS_ENABLE_STT !== '1');
    const dryRun = opts?.dryRun ?? envDry;
    await log(`transcribe requested (dryRun=${dryRun}): ${filePath}`);
    if (dryRun) return { ok: true, dryRun: true, text: '[dry-run transcription]' };

    // No built-in STT integration in this stub. Users can integrate Whisper/Azure/Google and set env vars.
    await log('No STT provider configured');
    return { ok: false, reason: 'no-provider' };
  }
};

export default VoiceEngine;
