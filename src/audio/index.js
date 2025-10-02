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

export function createAudioController({
  presetsUrl = 'assets/audio/presets.json',
  masterVolume = 0.7
} = {}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const supportsAudio = Boolean(AudioContextClass);
  let context = null;
  let outputGain = null;
  let enabled = true;
  let loadedPresets = null;
  let loadPromise = null;

  function ensureContext() {
    if (!supportsAudio || !enabled) {
      return null;
    }
    if (!context) {
      context = new AudioContextClass();
      outputGain = context.createGain();
      outputGain.gain.value = Math.max(0, Math.min(1, masterVolume));
      outputGain.connect(context.destination);
    } else if (context.state === 'suspended') {
      context.resume();
    }
    return context;
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

  async function playCue(name) {
    if (!enabled || !supportsAudio) {
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

  return {
    unlock() {
      if (!supportsAudio) {
        return;
      }
      ensureContext();
      loadPresets().catch(() => {});
    },
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled && context && context.state === 'running') {
        context.suspend().catch(() => {});
      } else if (enabled) {
        ensureContext();
      }
    },
    isEnabled() {
      return enabled;
    },
    playCorrect() {
      playCue('correct');
    },
    playError() {
      playCue('error');
    },
    playLevelUp() {
      playCue('level_up');
    }
  };
}
