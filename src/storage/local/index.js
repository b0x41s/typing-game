/**
 * Local storage helpers for HackType.
 *
 * The MVP needs a reliable way to persist high scores and light-weight
 * progress so returning players keep their achievements. This module wraps
 * `window.localStorage` with defensive guards so the game remains safe in
 * privacy hardened browsers or offline contexts.
 */

const STORAGE_KEY = "hacktype::v1::profile";

const DEFAULT_AUDIO_PREFS = Object.freeze({
  musicEnabled: true,
  effectsEnabled: true
});

const DEFAULT_STATE = Object.freeze({
  version: 1,
  highScores: {},
  progress: {
    tutorialCompleted: false,
    lastPackId: null,
    packStats: {},
    audio: DEFAULT_AUDIO_PREFS
  }
});

let memoryState = createDefaultState();

function createDefaultAudioPrefs() {
  return {
    musicEnabled: DEFAULT_AUDIO_PREFS.musicEnabled,
    effectsEnabled: DEFAULT_AUDIO_PREFS.effectsEnabled
  };
}

function resolveAudioPrefs(progress) {
  if (progress && typeof progress === "object") {
    const rawAudio = progress.audio;
    if (rawAudio && typeof rawAudio === "object") {
      return {
        musicEnabled: rawAudio.musicEnabled !== false,
        effectsEnabled: rawAudio.effectsEnabled !== false
      };
    }
    if ("audioEnabled" in progress) {
      const legacy = progress.audioEnabled !== false;
      return {
        musicEnabled: legacy,
        effectsEnabled: legacy
      };
    }
  }
  return createDefaultAudioPrefs();
}

function cloneAudioPrefs(progress) {
  const prefs = resolveAudioPrefs(progress);
  return {
    musicEnabled: prefs.musicEnabled,
    effectsEnabled: prefs.effectsEnabled
  };
}

function createDefaultState() {
  return {
    version: DEFAULT_STATE.version,
    highScores: {},
    progress: {
      tutorialCompleted: DEFAULT_STATE.progress.tutorialCompleted,
      lastPackId: DEFAULT_STATE.progress.lastPackId,
      packStats: {},
      audio: createDefaultAudioPrefs()
    }
  };
}

function cloneState(state) {
  return {
    version: state.version,
    highScores: { ...state.highScores },
    progress: {
      tutorialCompleted: Boolean(state.progress?.tutorialCompleted),
      lastPackId: state.progress?.lastPackId ?? null,
      packStats: Object.fromEntries(
        Object.entries(state.progress?.packStats ?? {}).map(([packId, stats]) => [
          packId,
          {
            attempts: Math.max(0, Math.floor(Number(stats.attempts) || 0)),
            clears: Math.max(0, Math.floor(Number(stats.clears) || 0)),
            bestScore: Math.max(0, Math.floor(Number(stats.bestScore) || 0))
          }
        ])
      ),
      audio: cloneAudioPrefs(state.progress)
    }
  };
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const { localStorage } = window;
    const testKey = `${STORAGE_KEY}::test`;
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return localStorage;
  } catch (error) {
    console.warn("HackType: localStorage unavailable, falling back to memory.", error);
    return null;
  }
}

const storage = getStorage();

function readState() {
  if (!storage) {
    return cloneState(memoryState);
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryState = createDefaultState();
      return cloneState(memoryState);
    }
    const parsed = JSON.parse(raw);
    memoryState = normaliseState(parsed);
    return cloneState(memoryState);
  } catch (error) {
    console.warn("HackType: failed to read profile state, resetting.", error);
    memoryState = createDefaultState();
    if (storage) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch (removeError) {
        console.warn("HackType: failed to clear corrupted localStorage entry.", removeError);
      }
    }
    return cloneState(memoryState);
  }
}

function writeState(state) {
  memoryState = normaliseState(state);
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
  } catch (error) {
    console.warn("HackType: failed to persist profile state.", error);
  }
}

function normaliseState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return createDefaultState();
  }

  const base = createDefaultState();
  const safeHighScores = {};

  if (rawState.highScores && typeof rawState.highScores === "object") {
    for (const [modeId, score] of Object.entries(rawState.highScores)) {
      const numericScore = Math.max(0, Math.floor(Number(score) || 0));
      if (modeId) {
        safeHighScores[modeId] = numericScore;
      }
    }
  }

  const safeProgress = {
    tutorialCompleted: Boolean(rawState.progress?.tutorialCompleted),
    lastPackId: rawState.progress?.lastPackId ?? base.progress.lastPackId,
    packStats: {},
    audio: cloneAudioPrefs(rawState.progress)
  };

  const packStats = rawState.progress?.packStats;
  if (packStats && typeof packStats === "object") {
    for (const [packId, stats] of Object.entries(packStats)) {
      if (!packId || typeof stats !== "object") {
        continue;
      }
      safeProgress.packStats[packId] = {
        attempts: Math.max(0, Math.floor(Number(stats.attempts) || 0)),
        clears: Math.max(0, Math.floor(Number(stats.clears) || 0)),
        bestScore: Math.max(0, Math.floor(Number(stats.bestScore) || 0))
      };
    }
  }

  return {
    version: Number.isFinite(rawState.version) ? rawState.version : base.version,
    highScores: safeHighScores,
    progress: safeProgress
  };
}

function updateState(mutator) {
  const current = readState();
  const draft = cloneState(current);
  const next = mutator(draft) || draft;
  writeState(next);
  return readState();
}

export function getHighScore(modeId = "core") {
  const state = readState();
  return state.highScores[modeId] ?? 0;
}

export function recordScore({ modeId = "core", score = 0, packId = null, completed = false } = {}) {
  const numericScore = Math.max(0, Math.floor(Number(score) || 0));

  let updatedState;
  updateState((state) => {
    const currentHigh = state.highScores[modeId] ?? 0;
    if (numericScore > currentHigh) {
      state.highScores[modeId] = numericScore;
    }

    if (packId) {
      const packStats = state.progress.packStats[packId] ?? {
        attempts: 0,
        clears: 0,
        bestScore: 0
      };
      packStats.attempts += 1;
      if (completed) {
        packStats.clears += 1;
      }
      if (numericScore > packStats.bestScore) {
        packStats.bestScore = numericScore;
      }
      state.progress.packStats[packId] = packStats;
      state.progress.lastPackId = packId;
    }

    updatedState = state;
    return state;
  });

  return {
    highScore: updatedState.highScores[modeId] ?? numericScore,
    pack: packId ? updatedState.progress.packStats[packId] : undefined
  };
}

export function getProgress() {
  const state = readState();
  const progress = cloneState({
    version: state.version,
    highScores: {},
    progress: state.progress
  }).progress;
  progress.audioEnabled = progress.audio.musicEnabled && progress.audio.effectsEnabled;
  return progress;
}

export function getAudioEnabled() {
  const prefs = getAudioPreferences();
  return prefs.musicEnabled && prefs.effectsEnabled;
}

export function setAudioEnabled(value) {
  const enabled = value !== false;
  setMusicPreference(enabled);
  return setEffectsPreference(enabled);
}

export function getAudioPreferences() {
  return cloneAudioPrefs(readState().progress);
}

export function setMusicPreference(value) {
  const enabled = value !== false;
  const updated = updateState((state) => {
    if (!state.progress.audio || typeof state.progress.audio !== "object") {
      state.progress.audio = createDefaultAudioPrefs();
    }
    state.progress.audio.musicEnabled = enabled;
    return state;
  });
  return updated.progress.audio.musicEnabled !== false;
}

export function setEffectsPreference(value) {
  const enabled = value !== false;
  const updated = updateState((state) => {
    if (!state.progress.audio || typeof state.progress.audio !== "object") {
      state.progress.audio = createDefaultAudioPrefs();
    }
    state.progress.audio.effectsEnabled = enabled;
    return state;
  });
  return updated.progress.audio.effectsEnabled !== false;
}

export function markTutorialCompleted() {
  return updateState((state) => {
    if (!state.progress.tutorialCompleted) {
      state.progress.tutorialCompleted = true;
    }
    return state;
  }).progress.tutorialCompleted;
}

export function resetProfile() {
  writeState(createDefaultState());
  if (storage) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("HackType: failed to clear stored profile.", error);
    }
  }
  return readState();
}

export function getPackStats(packId) {
  if (!packId) {
    return null;
  }
  const { packStats } = readState().progress;
  const stats = packStats[packId];
  if (!stats) {
    return {
      attempts: 0,
      clears: 0,
      bestScore: 0
    };
  }
  return { ...stats };
}

export function updatePackStats(packId, patch = {}) {
  if (!packId) {
    return getPackStats(packId);
  }
  const updated = updateState((state) => {
    const current = state.progress.packStats[packId] ?? {
      attempts: 0,
      clears: 0,
      bestScore: 0
    };
    state.progress.packStats[packId] = {
      attempts: Math.max(0, Math.floor(Number(patch.attempts ?? current.attempts) || 0)),
      clears: Math.max(0, Math.floor(Number(patch.clears ?? current.clears) || 0)),
      bestScore: Math.max(0, Math.floor(Number(patch.bestScore ?? current.bestScore) || 0))
    };
    return state;
  });
  return { ...updated.progress.packStats[packId] };
}

export function getProfileSnapshot() {
  return readState();
}

export function setLastPackId(packId) {
  if (!packId) {
    return getProgress().lastPackId ?? null;
  }
  const safePackId = String(packId).trim();
  if (!safePackId) {
    return getProgress().lastPackId ?? null;
  }
  const updated = updateState((state) => {
    state.progress.lastPackId = safePackId;
    return state;
  });
  return updated.progress.lastPackId;
}
