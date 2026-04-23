import { readFileSync, watch as fsWatch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  TURBO_MULTIPLIER, TURBO_MAX_MS, TURBO_COOLDOWN_MS,
  BRAKE_DURATION_MS, BRAKE_COOLDOWN_MS,
  ROUND_WAIT_TIME, ROUND_END_DISPLAY_TIME,
  POWERUP_SPAWN_INTERVAL, POWERUP_MAX_ACTIVE,
  SPEED_BOOST_DURATION, SPEED_BOOST_MULTIPLIER,
  WIDE_TRAIL_DURATION, WIDE_TRAIL_MULTIPLIER,
  GHOST_DURATION,
  STAR_DURATION,
  SWARM_LEADER_DURATION,
  PREDATOR_DURATION,
} from '@snakegame/shared';

/**
 * Runtime-tunable gameplay parameters, loaded from `packages/server/config/tuning.json`
 * at server boot. Fall back to the shared defaults on missing keys or a bad file
 * so the game always has sane values.
 *
 * The loaded config is exposed as a mutable `TUNING` object — powerup definitions
 * read from it via property getters so they see the current values at activation
 * time. Reloading the JSON requires a server restart (tsx-watch does not watch
 * JSON files).
 */
export interface Tuning {
  turbo: {
    multiplier: number;
    maxMs: number;
    cooldownMs: number;
  };
  brake: {
    durationMs: number;
    cooldownMs: number;
  };
  round: {
    waitTimeMs: number;
    endDisplayMs: number;
  };
  powerups: {
    spawnIntervalMs: number;
    maxActive: number;
    speedBoost:  { durationMs: number; multiplier: number; spawnWeight: number };
    wideTrail:   { durationMs: number; multiplier: number; spawnWeight: number };
    ghost:       { durationMs: number; spawnWeight: number };
    star:        { durationMs: number; spawnWeight: number };
    swarmLeader: { durationMs: number; spawnWeight: number };
    predator:    { durationMs: number; spawnWeight: number };
  };
}

const DEFAULTS: Tuning = {
  turbo: {
    multiplier: TURBO_MULTIPLIER,
    maxMs: TURBO_MAX_MS,
    cooldownMs: TURBO_COOLDOWN_MS,
  },
  brake: {
    durationMs: BRAKE_DURATION_MS,
    cooldownMs: BRAKE_COOLDOWN_MS,
  },
  round: {
    waitTimeMs: ROUND_WAIT_TIME,
    endDisplayMs: ROUND_END_DISPLAY_TIME,
  },
  powerups: {
    spawnIntervalMs: POWERUP_SPAWN_INTERVAL,
    maxActive: POWERUP_MAX_ACTIVE,
    speedBoost:  { durationMs: SPEED_BOOST_DURATION, multiplier: SPEED_BOOST_MULTIPLIER, spawnWeight: 10 },
    wideTrail:   { durationMs: WIDE_TRAIL_DURATION,  multiplier: WIDE_TRAIL_MULTIPLIER,  spawnWeight: 8 },
    ghost:       { durationMs: GHOST_DURATION,       spawnWeight: 5 },
    star:        { durationMs: STAR_DURATION,        spawnWeight: 3 },
    swarmLeader: { durationMs: SWARM_LEADER_DURATION,spawnWeight: 4 },
    predator:    { durationMs: PREDATOR_DURATION,    spawnWeight: 5 },
  },
};

function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return base;
  const out: Record<string, unknown> = { ...(base as object) };
  const p = patch as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) {
    if (k.startsWith('_')) continue; // ignore "_comment" etc.
    const baseV = (base as Record<string, unknown>)[k];
    if (baseV !== undefined && typeof baseV === 'object' && baseV !== null && !Array.isArray(baseV)) {
      out[k] = deepMerge(baseV, v);
    } else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') {
      out[k] = v;
    }
  }
  return out as T;
}

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
    const merged = deepMerge(DEFAULTS, parsed);
    console.log(`[Tuning] Loaded ${filePath}`);
    return merged;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Tuning] Falling back to defaults (${msg})`);
    return DEFAULTS;
  }
}

/** Singleton tuning config. Mutate via `reloadTuning()` only. */
export const TUNING: Tuning = loadTuning();

/** Force a fresh read from disk. Safe to call at runtime — existing powerup
 *  definitions read values via getters so they pick up the new numbers on
 *  their next activation. */
export function reloadTuning(): Tuning {
  const next = loadTuning();
  Object.assign(TUNING, next);
  // Deep-merge nested objects so field-level getters see the new numbers.
  for (const k of Object.keys(next) as (keyof Tuning)[]) {
    const nextSection = next[k] as unknown;
    const currentSection = TUNING[k] as unknown;
    if (
      nextSection && typeof nextSection === 'object' && !Array.isArray(nextSection)
      && currentSection && typeof currentSection === 'object' && !Array.isArray(currentSection)
    ) {
      Object.assign(currentSection as object, nextSection as object);
    }
  }
  return TUNING;
}

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
