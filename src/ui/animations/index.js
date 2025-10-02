const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  try {
    return window.matchMedia(MOTION_QUERY).matches;
  } catch (error) {
    console.warn('HackType animations: matchMedia failed, assuming motion allowed.', error);
    return false;
  }
}

function forceReflow(element) {
  if (!element) {
    return;
  }
  void element.offsetWidth;
}

export function createAnimationController({
  successClass = 'anim-success-glow',
  errorClass = 'anim-error-shake',
  successDurationMs = 520,
  errorDurationMs = 420
} = {}) {
  const disabled = prefersReducedMotion();
  const timeouts = new Map();

  function applyAnimation(element, className, duration) {
    if (!element || disabled) {
      return;
    }

    const previous = timeouts.get(element);
    if (previous) {
      clearTimeout(previous);
      timeouts.delete(element);
    }

    element.classList.remove(className);
    forceReflow(element);
    element.classList.add(className);

    const timeoutId = window.setTimeout(() => {
      element.classList.remove(className);
      timeouts.delete(element);
    }, duration);

    timeouts.set(element, timeoutId);
  }

  return {
    playSuccess(element) {
      applyAnimation(element, successClass, successDurationMs);
    },
    playError(element) {
      applyAnimation(element, errorClass, errorDurationMs);
    }
  };
}

export default {
  createAnimationController
};
