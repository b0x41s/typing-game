import { loadPack, createFallbackPack } from './data/packs.js';
import { createAudioController } from './audio/index.js';
import { createAnimationController } from './ui/animations/index.js';
import { createCoreLoop } from './ui/core-loop/index.js';

const DEFAULT_PACK_ID = 'beginner';
const RUN_DURATION_SECONDS = 60;

function createAnnouncer(liveRegion) {
  if (!liveRegion) {
    return () => {};
  }
  return (message) => {
    liveRegion.textContent = '';
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 30);
  };
}

function showLoading(screens, message) {
  const loadingScreen = screens.loading;
  if (!loadingScreen) {
    return;
  }
  loadingScreen.hidden = false;
  const status = loadingScreen.querySelector('.status-line');
  if (status && message) {
    status.textContent = message;
  }
}

function hideAllScreens(screens) {
  Object.values(screens).forEach((el) => {
    if (el) {
      el.hidden = true;
    }
  });
}

async function bootstrap() {
  const app = document.getElementById('app');
  if (!app) {
    return;
  }

  const screens = {
    loading: app.querySelector('[data-screen="loading"]'),
    start: app.querySelector('[data-screen="start"]'),
    play: app.querySelector('[data-screen="play"]'),
    results: app.querySelector('[data-screen="results"]')
  };

  hideAllScreens(screens);
  showLoading(screens, "Commando's laden…");

  const liveRegion = document.getElementById('live-region');
  const announce = createAnnouncer(liveRegion);

  let pack;
  try {
    pack = await loadPack(DEFAULT_PACK_ID);
  } catch (error) {
    console.warn('HackType: pack laden mislukt, val terug op ingebakken lijst.', error);
    pack = createFallbackPack(DEFAULT_PACK_ID);
    showLoading(screens, 'Pack laden faalde. Fallback geactiveerd.');
  }

  const audio = createAudioController();
  const animations = createAnimationController();

  const coreLoop = createCoreLoop({
    screens,
    pack,
    durationSeconds: RUN_DURATION_SECONDS,
    announce,
    audio,
    animations
  });

  coreLoop.showStartScreen();
}

bootstrap().catch((error) => {
  console.error('HackType initialisatie mislukt', error);
});
