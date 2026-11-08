import { readFileSync, watch as fsWatch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyTuning, type Tuning } from './tuning.js';

function resolveTuningPath(): string {
  // __dirname equivalent for ESM, then walk out to packages/server/config/tuning.json.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', 'config', 'tuning.json');
}

function loadTuning(): Tuning {
  const filePath = resolveTuningPath();
  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const merged = applyTuning(parsed);
    console.log(`[Tuning] Loaded ${filePath}`);
    return merged;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Tuning] Falling back to defaults (${msg})`);
    return applyTuning({});
  }
}

export function reloadTuning(): Tuning {
  return loadTuning();
}

reloadTuning();

// Live reload: rewrite tuning.json and the server picks up new values on the
// next read. Debounced because editors can fire multiple rename/write events
// per save.
let reloadTimer: NodeJS.Timeout | null = null;
try {
  fsWatch(resolveTuningPath(), { persistent: false }, (eventType) => {
    if (eventType !== 'change' && eventType !== 'rename') return;
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      reloadTuning();
      console.log('[Tuning] Reloaded from disk');
    }, 120);
  });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`[Tuning] Live-reload watcher could not attach (${msg})`);
}
