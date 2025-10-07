import { loadPack, createFallbackPack, loadManifest } from './data/packs.js';
import { createAudioController } from './audio/index.js';
import { createAnimationController } from './ui/animations/index.js';
import { createCoreLoop } from './ui/core-loop/index.js';
import { createOnboarding } from './ui/onboarding/index.js';
import { getProgress } from './storage/local/index.js';

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
    tutorial: app.querySelector('[data-screen="tutorial"]'),
    play: app.querySelector('[data-screen="play"]'),
    results: app.querySelector('[data-screen="results"]')
  };

  hideAllScreens(screens);
  showLoading(screens, "Commando's laden…");

  const liveRegion = document.getElementById('live-region');
  const announce = createAnnouncer(liveRegion);
  const progress = getProgress();

  let manifestEntries;
  try {
    manifestEntries = await loadManifest();
  } catch (error) {
    console.warn('HackType: manifest laden mislukt, val terug op standaardlijst.', error);
    manifestEntries = [
      {
        packId: DEFAULT_PACK_ID,
        title: 'Fallback Ops',
        summary: 'Ingebakken reeks commandoregels voor als het pack niet laadt.',
        difficulty: 'mixed',
        commandCount: 0,
        default: true
      }
    ];
  }

  const knownPackIds = new Set(manifestEntries.map((entry) => entry.packId));
  const defaultEntry = manifestEntries.find((entry) => entry.default) ?? manifestEntries[0];
  let initialPackId = progress.lastPackId && knownPackIds.has(progress.lastPackId)
    ? progress.lastPackId
    : defaultEntry?.packId ?? DEFAULT_PACK_ID;

  async function loadPackSafe(packId) {
    const targetId = packId || DEFAULT_PACK_ID;
    try {
      return await loadPack(targetId);
    } catch (error) {
      console.warn(`HackType: pack ${targetId} laden mislukt, val terug op fallback.`, error);
      return createFallbackPack(targetId);
    }
  }

  const pack = await loadPackSafe(initialPackId);

  const audio = createAudioController();
  const animations = createAnimationController();

  let coreLoop;

  const onboarding = createOnboarding({
    screens,
    announce,
    audio,
    animations,
    onFinish: () => {
      coreLoop.showStartScreen();
    }
  });

  coreLoop = createCoreLoop({
    screens,
    manifest: manifestEntries,
    pack,
    durationSeconds: RUN_DURATION_SECONDS,
    announce,
    audio,
    animations,
    onTutorialRequested: () => {
      onboarding.showIntro();
    },
    loadPackById: loadPackSafe
  });

  if (progress.tutorialCompleted) {
    coreLoop.showStartScreen();
  } else {
    onboarding.showIntro();
  }
}

bootstrap().catch((error) => {
  console.error('HackType initialisatie mislukt', error);
});
