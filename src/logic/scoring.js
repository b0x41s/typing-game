/**
 * Scoring baseline for HackType.
 *
 * The rules follow the MVP brief in `plan.md`.【F:plan.md†L90-L99】
 * - Award base points for every completed command.
 * - Reward finishing early with a time bonus.
 * - Penalise mistakes with a per-error deduction.
 *
 * The module exposes a tiny functional core so the UI layer can
 * stay declarative and serialisable. Calculations are deterministic and
 * side-effect free which keeps the app safe for offline play.
 */

const DEFAULT_CONFIG = Object.freeze({
  baseCommandPoints: 100,
  timeBonus: {
    perSecondRemaining: 5,
    maxBonus: 500
  },
  errorPenalty: {
    perError: 15,
    // Never allow the penalty to nuke more than half of the base score.
    maxShareOfBase: 0.5
  },
  hintPenalty: {
    perHint: 25,
    maxShareOfBase: 0.3
  }
});

/**
 * Clamp a numeric value between two bounds.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalises stats so downstream formulas behave predictably.
 * @param {object} raw
 * @returns {{
 *   completedCommands: number,
 *   elapsedSeconds: number,
 *   totalSeconds: number,
 *   errors: number
 * }}
 */
function normaliseStats(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      completedCommands: 0,
      elapsedSeconds: 0,
      totalSeconds: 60,
      errors: 0,
      basePoints: 0,
      hintCount: 0
    };
  }

  const completedCommands = Math.max(0, Math.floor(Number(raw.completedCommands) || 0));
  const elapsedSeconds = Math.max(0, Number(raw.elapsedSeconds) || 0);
  const totalSeconds = Math.max(elapsedSeconds, Number(raw.totalSeconds) || elapsedSeconds || 60);
  const errors = Math.max(0, Math.floor(Number(raw.errors) || 0));
  const basePoints = Math.max(0, Number(raw.basePoints) || 0);
  const hintCount = Math.max(0, Math.floor(Number(raw.hintCount) || 0));

  return { completedCommands, elapsedSeconds, totalSeconds, errors, basePoints, hintCount };
}

/**
 * Calculate scoring breakdown based on the provided session stats.
 *
 * @param {{
 *   completedCommands: number,
 *   elapsedSeconds: number,
 *   totalSeconds: number,
 *   errors: number
 * }} stats
 * @param {typeof DEFAULT_CONFIG} [config]
 * @returns {{
 *   total: number,
 *   base: number,
 *   timeBonus: number,
 *   penalties: {
 *     errors: number
 *   }
 * }}
 */
export function calculateScore(stats, config = DEFAULT_CONFIG) {
  const {
    completedCommands,
    elapsedSeconds,
    totalSeconds,
    errors,
    basePoints,
    hintCount
  } = normaliseStats(stats);
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const calculatedBase = completedCommands * cfg.baseCommandPoints;
  const base = basePoints > 0 ? basePoints : calculatedBase;

  const remainingSeconds = clamp(totalSeconds - elapsedSeconds, 0, totalSeconds);
  const timeBonus = clamp(
    remainingSeconds * cfg.timeBonus.perSecondRemaining,
    0,
    cfg.timeBonus.maxBonus
  );

  const rawErrorPenalty = errors * cfg.errorPenalty.perError;
  const maxPenalty = base * cfg.errorPenalty.maxShareOfBase;
  const errorPenalty = clamp(rawErrorPenalty, 0, maxPenalty);

  const rawHintPenalty = hintCount * cfg.hintPenalty.perHint;
  const maxHintPenalty = base * cfg.hintPenalty.maxShareOfBase;
  const hintPenalty = clamp(rawHintPenalty, 0, maxHintPenalty);

  const totalPenalty = Math.min(base, errorPenalty + hintPenalty);
  const total = Math.max(0, Math.round(base + timeBonus - totalPenalty));

  return {
    total,
    base,
    timeBonus,
    penalties: {
      errors: errorPenalty,
      hints: hintPenalty
    }
  };
}

/**
 * Factory that returns a pure scoring helper.
 *
 * It tracks minimal aggregates in memory and exposes methods to
 * add command results and finalise the score at the end of the run.
 */
export function createScoringSession(config = DEFAULT_CONFIG) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  let completedCommands = 0;
  let errors = 0;
  let elapsedSeconds = 0;
  let basePoints = 0;
  let hintCount = 0;

  return Object.freeze({
    /**
     * Register a single command result.
     * @param {{
     *   completed?: boolean,
     *   errors?: number,
     *   durationSeconds?: number
     * }} result
     */
    addCommand(result = {}) {
      if (result.completed) {
        completedCommands += 1;
        const multiplier = Number.isFinite(result.baseMultiplier)
          ? Math.max(1, result.baseMultiplier)
          : 1;
        basePoints += cfg.baseCommandPoints * multiplier;
      }
      if (Number.isFinite(result.errors)) {
        errors += Math.max(0, Math.floor(result.errors));
      }
      if (Number.isFinite(result.durationSeconds)) {
        elapsedSeconds += Math.max(0, result.durationSeconds);
      }
    },

    registerHint(useCount = 1) {
      if (!Number.isFinite(useCount)) {
        return;
      }
      hintCount += Math.max(0, Math.floor(useCount));
    },

    /**
     * Finalise the session and return the score breakdown.
     * @param {{ totalSeconds?: number }} [summary]
     * @returns {ReturnType<typeof calculateScore>}
     */
    finalise(summary = {}) {
      return calculateScore(
        {
          completedCommands,
          errors,
          elapsedSeconds,
          totalSeconds: summary.totalSeconds ?? summary.durationSeconds ?? summary.roundSeconds,
          basePoints,
          hintCount
        },
        cfg
      );
    }
  });
}

export const SCORING_DEFAULTS = DEFAULT_CONFIG;

export default {
  SCORING_DEFAULTS,
  calculateScore,
  createScoringSession
};
