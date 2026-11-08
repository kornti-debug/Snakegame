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
 * Portable gameplay parameters. The host applies `config/tuning.json`
 * at startup. Fall back to the shared defaults on missing keys or a bad file
 * so the game always has sane values.
 *
 * The loaded config is exposed as a mutable `TUNING` object — powerup definitions
 * read from it via property getters so they see the current values at activation
 * time. The Node host watches the JSON for edits; the Pages build bundles it.
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

export function deepMerge<T>(base: T, patch: unknown): T {
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

/** Shared by the Node host and the browser-only game. */
export const TUNING: Tuning = deepMerge(DEFAULTS, {});

export function applyTuning(patch: unknown): Tuning {
  Object.assign(TUNING, deepMerge(DEFAULTS, patch));
  return TUNING;
}
