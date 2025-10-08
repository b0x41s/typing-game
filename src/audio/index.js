const DEFAULT_PRESETS = {
  correct: {
    masterGain: 0.26,
    steps: [
      { type: 'tone', frequency: 880, duration: 0.1, wave: 'triangle', gain: 1 },
      { type: 'tone', frequency: 1175, duration: 0.08, wave: 'triangle', gain: 0.85, delayAfter: 0.01 }
    ]
  },
  error: {
    masterGain: 0.32,
    steps: [
      { type: 'tone', frequency: 220, duration: 0.14, wave: 'sawtooth', gain: 0.9 },
      { type: 'tone', frequency: 180, duration: 0.12, wave: 'sawtooth', gain: 0.75 }
    ]
  },
  level_up: {
    masterGain: 0.24,
    steps: [
      { type: 'tone', frequency: 523.25, duration: 0.12, wave: 'sine', gain: 0.9 },
      { type: 'tone', frequency: 659.25, duration: 0.12, wave: 'sine', gain: 0.85 },
      { type: 'tone', frequency: 784, duration: 0.16, wave: 'sine', gain: 0.8 }
    ]
  }
};

function normaliseStep(step) {
  if (!step || typeof step !== 'object' || step.type !== 'tone') {
    return null;
  }
  const duration = Math.max(0.02, Number(step.duration) || 0.1);
  const frequency = Math.max(20, Math.min(8000, Number(step.frequency) || 440));
  return {
    type: 'tone',
    frequency,
    duration,
    wave: typeof step.wave === 'string' ? step.wave : 'sine',
    gain: Math.max(0, Number(step.gain) || 1),
    delayAfter: Math.max(0, Number(step.delayAfter) || 0)
  };
}

function normalisePreset(preset) {
  if (!preset || typeof preset !== 'object' || !Array.isArray(preset.steps)) {
    return null;
  }
  const steps = preset.steps.map(normaliseStep).filter(Boolean);
  if (!steps.length) {
    return null;
  }
  return {
    masterGain: Math.max(0, Math.min(1, Number(preset.masterGain) || 0.25)),
    steps
  };
}

function normalisePresets(raw) {
  const presets = {};
  if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([key, preset]) => {
      const normalised = normalisePreset(preset);
      if (normalised) {
        presets[key] = normalised;
      }
    });
  }
  return Object.keys(presets).length ? presets : { ...DEFAULT_PRESETS };
}

function createOscillatorStep(context, outputGain, preset, step, startTime) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = step.wave;
  oscillator.frequency.setValueAtTime(step.frequency, startTime);

  const effectiveGain = step.gain * preset.masterGain;
  const attack = Math.min(0.02, step.duration / 3);
  const releaseTime = startTime + step.duration;

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(effectiveGain, startTime + attack);
  gainNode.gain.linearRampToValueAtTime(0, releaseTime);

  oscillator.connect(gainNode);
  gainNode.connect(outputGain);

  oscillator.start(startTime);
  oscillator.stop(releaseTime + 0.05);
}

function normaliseMusicSources(primaryUrl, sources) {
  const unique = new Set();
  const result = [];

  function push(candidate) {
    if (!candidate) {
      return;
    }
    const url = String(candidate).trim();
    if (!url || unique.has(url)) {
      return;
    }
    unique.add(url);
    result.push(url);
  }

  if (Array.isArray(sources)) {
    sources.forEach((item) => {
      if (typeof item === 'string') {
        push(item);
      } else if (item && typeof item === 'object' && typeof item.src === 'string') {
        push(item.src);
      }
    });
  }

  if (primaryUrl) {
    push(primaryUrl);
  }

  return result;
}

export function createAudioController({
  presetsUrl = 'assets/audio/presets.json',
  masterVolume = 0.7,
  musicUrl = 'assets/audio/chiptune-bg.wav',
  musicVolume = 0.18,
  musicSources = null
} = {}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const supportsAudio = Boolean(AudioContextClass);
  const resolvedMusicSources = normaliseMusicSources(
    musicUrl,
    Array.isArray(musicSources) && musicSources.length
      ? musicSources
      : ['assets/audio/chiptune-bg.mp3', musicUrl, 'assets/audio/chiptune-bg.wav']
  );

  let context = null;
  let outputGain = null;
  let musicGain = null;
  let musicSourceNode = null;
  let musicBuffer = null;
  let musicLoadPromise = null;
  let musicOffset = 0;
  let musicStartedAt = 0;
  let effectsEnabled = true;
  let musicEnabled = true;
  let loadedPresets = null;
  let loadPromise = null;

  function ensureContext() {
    if (!supportsAudio || (!effectsEnabled && !musicEnabled)) {
      return null;
    }
    if (!context) {
      context = new AudioContextClass();
      outputGain = context.createGain();
      outputGain.gain.value = Math.max(0, Math.min(1, masterVolume));
      outputGain.connect(context.destination);
    } else if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
    return context;
  }

  function ensureMusicGain(ctx) {
    if (!ctx || !resolvedMusicSources.length) {
      return null;
    }
    if (!musicGain) {
      musicGain = ctx.createGain();
      musicGain.gain.value = Math.max(0, Math.min(1, musicVolume));
      if (outputGain) {
        musicGain.connect(outputGain);
      } else {
        musicGain.connect(ctx.destination);
      }
    }
    return musicGain;
  }

  function stopMusicNode() {
    if (!musicSourceNode) {
      return;
    }
    try {
      musicSourceNode.stop();
    } catch (error) {
      // Bron kan al gestopt zijn; negeren.
    }
    try {
      musicSourceNode.disconnect();
    } catch (error) {
      // Node kan al ontkoppeld zijn; negeren.
    }
    musicSourceNode.onended = null;
    musicSourceNode = null;
  }

  function loadPresets() {
    if (loadedPresets) {
      return Promise.resolve(loadedPresets);
    }
    if (!loadPromise) {
      loadPromise = fetch(presetsUrl, { cache: 'no-store' })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load presets (${response.status})`);
          }
          return response.json();
        })
        .catch(() => DEFAULT_PRESETS)
        .then((raw) => {
          loadedPresets = normalisePresets(raw);
          return loadedPresets;
        });
    }
    return loadPromise;
  }

  async function loadMusicBuffer(ctx) {
    if (!ctx || !resolvedMusicSources.length) {
      return null;
    }
    if (musicBuffer) {
      return musicBuffer;
    }
    if (!musicLoadPromise) {
      musicLoadPromise = (async () => {
        for (const source of resolvedMusicSources) {
          if (!source) {
            continue;
          }
          try {
            const response = await fetch(source, { cache: 'no-store' });
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = await ctx.decodeAudioData(arrayBuffer);
            musicBuffer = buffer;
            return buffer;
          } catch (error) {
            console.warn(`HackType: muziekbron ${source} laden mislukt.`, error);
          }
        }
        throw new Error('Geen geldige muziekbron gevonden.');
      })().catch((error) => {
        console.warn('HackType: achtergrondmuziek laden faalde.', error);
        musicLoadPromise = null;
        throw error;
      });
    }
    return musicLoadPromise;
  }

  async function playCue(name) {
    if (!supportsAudio || !effectsEnabled) {
      return;
    }
    const ctx = ensureContext();
    if (!ctx) {
      return;
    }
    const presets = await loadPresets();
    const preset = presets[name];
    if (!preset) {
      return;
    }

    const startAt = ctx.currentTime;
    let offset = 0;

    preset.steps.forEach((step) => {
      const stepStart = startAt + offset;
      createOscillatorStep(ctx, outputGain, preset, step, stepStart);
      offset += step.duration + (step.delayAfter || 0);
    });
  }

  async function startBackgroundMusicInternal() {
    if (!musicEnabled) {
      return;
    }
    const ctx = ensureContext();
    if (!ctx) {
      return;
    }
    const gain = ensureMusicGain(ctx);
    if (!gain) {
      return;
    }
    try {
      const buffer = await loadMusicBuffer(ctx);
      if (!buffer) {
        return;
      }
      stopMusicNode();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.onended = () => {
        if (musicSourceNode === source) {
          musicSourceNode = null;
        }
      };
      source.connect(gain);
      const startOffset = buffer.duration > 0
        ? Math.max(0, musicOffset % buffer.duration)
        : 0;
      musicStartedAt = ctx.currentTime - startOffset;
      source.start(0, startOffset);
      musicSourceNode = source;
    } catch (error) {
      console.warn('HackType: achtergrondmuziek starten faalde.', error);
    }
  }

  function pauseBackgroundMusicInternal() {
    if (!context || !musicSourceNode) {
      return;
    }
    if (musicBuffer) {
      const elapsed = Math.max(0, context.currentTime - musicStartedAt);
      const duration = Math.max(musicBuffer.duration, 0.0001);
      musicOffset = elapsed % duration;
    } else {
      musicOffset = 0;
    }
    stopMusicNode();
  }

  function stopBackgroundMusicInternal() {
    pauseBackgroundMusicInternal();
    musicOffset = 0;
  }

  function applyEffectsEnabled(value) {
    effectsEnabled = Boolean(value);
    if (!effectsEnabled && !musicEnabled) {
      if (context && context.state === 'running') {
        context.suspend().catch(() => {});
      }
      if (context) {
        pauseBackgroundMusicInternal();
        musicOffset = 0;
      }
    } else {
      ensureContext();
    }
  }

  function applyMusicEnabled(value) {
    musicEnabled = Boolean(value);
    if (!musicEnabled) {
      stopBackgroundMusicInternal();
      if (!effectsEnabled && context && context.state === 'running') {
        context.suspend().catch(() => {});
      }
    } else {
      ensureContext();
    }
  }

  return {
    unlock() {
      if (!supportsAudio) {
        return;
      }
      const ctx = ensureContext();
      loadPresets().catch(() => {});
      if (ctx) {
        loadMusicBuffer(ctx).catch(() => {});
      }
    },
    setEnabled(value) {
      const next = Boolean(value);
      applyEffectsEnabled(next);
      applyMusicEnabled(next);
    },
    isEnabled() {
      return effectsEnabled || musicEnabled;
    },
    setEffectsEnabled(value) {
      applyEffectsEnabled(value);
    },
    areEffectsEnabled() {
      return effectsEnabled;
    },
    setMusicEnabled(value) {
      applyMusicEnabled(value);
    },
    isMusicEnabled() {
      return musicEnabled;
    },
    playCorrect() {
      playCue('correct');
    },
    playError() {
      playCue('error');
    },
    playLevelUp() {
      playCue('level_up');
    },
    startBackgroundMusic() {
      return startBackgroundMusicInternal();
    },
    pauseBackgroundMusic() {
      pauseBackgroundMusicInternal();
    },
    stopBackgroundMusic() {
      stopBackgroundMusicInternal();
    },
    isBackgroundMusicLoaded() {
      return Boolean(musicBuffer);
    }
  };
}
