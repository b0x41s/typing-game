import { createScoringSession } from '../../logic/scoring.js';
import {
  evaluateTyping,
  countCommandErrors,
  formatAccuracy,
  formatWpm,
  formatDisplay
} from '../../logic/typing.js';
import { recordScore, getProgress, getPackStats, setLastPackId } from '../../storage/local/index.js';

const numberFormatter = new Intl.NumberFormat('nl-NL');

const LEVEL_UP_THRESHOLD = 5;

function formatNumber(value) {
  return numberFormatter.format(Math.max(0, Math.floor(value)));
}

function formatDifficulty(value) {
  if (!value) {
    return '–';
  }
  const lower = String(value).trim().toLowerCase();
  if (!lower) {
    return '–';
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createCoreLoop({
  screens,
  manifest = [],
  pack: initialPack,
  durationSeconds,
  announce,
  audio,
  animations,
  onTutorialRequested,
  loadPackById
}) {
  const startScreen = screens.start;
  const playScreen = screens.play;
  const resultsScreen = screens.results;

  const packSelectEl = startScreen.querySelector('#pack-select');
  const packTitleEl = startScreen.querySelector('#pack-title');
  const packSummaryEl = startScreen.querySelector('#pack-summary');
  const packDifficultyEl = startScreen.querySelector('#pack-difficulty');
  const packSizeEl = startScreen.querySelector('#pack-size');
  const packBestEl = startScreen.querySelector('#pack-best');
  const startButton = startScreen.querySelector('[data-action="start-run"]');
  const tutorialButton = startScreen.querySelector('[data-action="start-tutorial"]');
  const tutorialStatusEl = startScreen.querySelector('#tutorial-status');

  const commandTitleEl = playScreen.querySelector('#command-title');
  const commandDescriptionEl = playScreen.querySelector('#command-description');
  const commandTagsEl = playScreen.querySelector('#command-tags');
  const commandOutputEl = playScreen.querySelector('#command-output');
  const commandDisplayEl = playScreen.querySelector('#command-display');
  const inputEl = playScreen.querySelector('#command-input');
  const hintEl = playScreen.querySelector('#play-hint');
  const capsWarningEl = playScreen.querySelector('#caps-warning');
  const statsTimeEl = playScreen.querySelector('#stat-time');
  const statsCommandsEl = playScreen.querySelector('#stat-commands');
  const statsWpmEl = playScreen.querySelector('#stat-wpm');
  const statsAccEl = playScreen.querySelector('#stat-acc');

  const resultScoreEl = resultsScreen.querySelector('#result-score');
  const resultCommandsEl = resultsScreen.querySelector('#result-commands');
  const resultAccEl = resultsScreen.querySelector('#result-acc');
  const resultHighscoreEl = resultsScreen.querySelector('#result-highscore');
  const resultBaseEl = resultsScreen.querySelector('#result-base');
  const resultBonusEl = resultsScreen.querySelector('#result-bonus');
  const resultPenaltyEl = resultsScreen.querySelector('#result-penalty');
  const restartButton = resultsScreen.querySelector('[data-action="restart"]');
  const backButton = resultsScreen.querySelector('[data-action="back-to-start"]');

  const state = {
    screen: 'loading',
    pack: initialPack,
    manifest: Array.isArray(manifest) ? manifest : [],
    queue: [],
    currentCommand: null,
    currentTarget: null,
    scoringSession: null,
    timerId: null,
    startedAt: null,
    elapsed: 0,
    remainingSeconds: durationSeconds,
    commandStartedAt: null,
    runActive: false,
    runFinished: false,
    totalTyped: 0,
    correctChars: 0,
    completedCommands: 0,
    lastInputLength: 0,
    currentCommandTyped: 0,
    errorActive: false,
    loadingPack: false
  };

  function populatePackSelect() {
    if (!packSelectEl) {
      return;
    }
    packSelectEl.innerHTML = '';
    const items = Array.isArray(state.manifest) ? state.manifest : [];
    items.forEach((entry) => {
      if (!entry || !entry.packId) {
        return;
      }
      const option = document.createElement('option');
      option.value = entry.packId;
      const labelDifficulty = formatDifficulty(entry.difficulty);
      option.textContent = `${entry.title ?? entry.packId} — ${labelDifficulty}`;
      packSelectEl.appendChild(option);
    });

    if (!packSelectEl.options.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Geen packs beschikbaar';
      option.disabled = true;
      packSelectEl.appendChild(option);
      packSelectEl.disabled = true;
      return;
    }

    if (state.pack && state.pack.packId) {
      packSelectEl.value = state.pack.packId;
    } else {
      packSelectEl.selectedIndex = 0;
    }
  }

  function ensureManifestEntry(packEntry) {
    if (!packEntry || !packEntry.packId) {
      return;
    }
    if (!Array.isArray(state.manifest)) {
      state.manifest = [];
    }
    const existing = state.manifest.find((item) => item.packId === packEntry.packId);
    const commandCount = Array.isArray(packEntry.commands) ? packEntry.commands.length : 0;
    const nextValues = {
      packId: packEntry.packId,
      title: packEntry.title ?? existing?.title ?? 'HackType pack',
      summary: packEntry.summary ?? existing?.summary ?? '',
      difficulty: packEntry.difficulty ?? existing?.difficulty ?? 'mixed',
      commandCount,
      default: existing?.default ?? false
    };
    if (existing) {
      Object.assign(existing, nextValues);
    } else {
      state.manifest.push(nextValues);
    }
    populatePackSelect();
  }

  function updatePackDisplay() {
    if (!state.pack) {
      packTitleEl.textContent = '–';
      packSummaryEl.textContent = 'Geen pack geladen.';
      packDifficultyEl.textContent = '–';
      packSizeEl.textContent = '0';
      packBestEl.textContent = '0';
      if (packSelectEl) {
        packSelectEl.value = '';
      }
      return;
    }

    ensureManifestEntry(state.pack);
    packTitleEl.textContent = state.pack.title ?? 'HackType pack';
    packSummaryEl.textContent = state.pack.summary ?? '';
    packDifficultyEl.textContent = formatDifficulty(state.pack.difficulty);
    const commandCount = Array.isArray(state.pack.commands) ? state.pack.commands.length : 0;
    packSizeEl.textContent = formatNumber(commandCount);
    const packStats = state.pack.packId ? getPackStats(state.pack.packId) : null;
    const best = packStats?.bestScore ?? 0;
    packBestEl.textContent = formatNumber(best);
    if (packSelectEl && state.pack.packId) {
      packSelectEl.value = state.pack.packId;
    }
  }

  function setPack(nextPack, { silentAnnounce = false } = {}) {
    if (!nextPack) {
      return;
    }
    state.pack = nextPack;
    state.queue = [];
    ensureManifestEntry(nextPack);
    updatePackDisplay();
    if (!silentAnnounce) {
      announce?.(`Pack geladen: ${nextPack.title ?? nextPack.packId}`);
    }
    if (nextPack.packId) {
      setLastPackId(nextPack.packId);
    }
  }

  function disablePackSelection() {
    if (packSelectEl) {
      packSelectEl.disabled = true;
    }
  }

  function enablePackSelection() {
    if (packSelectEl) {
      packSelectEl.disabled = state.loadingPack || state.runActive;
    }
  }

  async function switchPack(packId) {
    if (!packId || typeof loadPackById !== 'function' || state.loadingPack) {
      return;
    }
    state.loadingPack = true;
    disablePackSelection();
    if (startButton) {
      startButton.disabled = true;
    }
    packSummaryEl.textContent = 'Pack laden…';
    try {
      const nextPack = await loadPackById(packId);
      if (nextPack) {
        setPack(nextPack, { silentAnnounce: true });
        announce?.(`Pack geladen: ${nextPack.title ?? nextPack.packId}.`);
      } else {
        packSummaryEl.textContent = 'Pack niet beschikbaar.';
      }
    } catch (error) {
      console.error('HackType: pack laden mislukt', error);
      packSummaryEl.textContent = 'Pack laden mislukt. Probeer opnieuw.';
      announce?.('Pack laden mislukt.');
    } finally {
      state.loadingPack = false;
      enablePackSelection();
      if (startButton) {
        startButton.disabled = false;
      }
      updatePackDisplay();
    }
  }

  populatePackSelect();
  if (state.pack) {
    setPack(state.pack, { silentAnnounce: true });
  } else {
    updatePackDisplay();
  }

  function updateCapsState(event) {
    if (!capsWarningEl || typeof event.getModifierState !== 'function') {
      return;
    }
    capsWarningEl.hidden = !event.getModifierState('CapsLock');
  }

  function resetCapsState() {
    if (!capsWarningEl) {
      return;
    }
    capsWarningEl.hidden = true;
  }

  function setCommandCard(command) {
    commandTitleEl.textContent = command.command;
    commandDescriptionEl.textContent = command.description ?? '';

    commandTagsEl.innerHTML = '';
    if (command.tags && command.tags.length) {
      command.tags.forEach((tag) => {
        const span = document.createElement('span');
        span.textContent = tag;
        commandTagsEl.appendChild(span);
      });
      commandTagsEl.hidden = false;
    } else {
      commandTagsEl.hidden = true;
    }

    const output = command.mock_output ?? '';
    commandOutputEl.textContent = output;
    commandOutputEl.hidden = output.trim().length === 0;
  }

  function showScreen(name) {
    state.screen = name;
    Object.entries(screens).forEach(([key, el]) => {
      if (!el) {
        return;
      }
      el.hidden = key !== name;
    });
  }

  function ensureQueue() {
    if (!state.pack || !Array.isArray(state.pack.commands)) {
      state.queue = [];
      return;
    }
    if (!state.queue.length) {
      state.queue = shuffle(state.pack.commands);
    }
  }

  function drawNextCommand() {
    ensureQueue();
    return state.queue.shift() ?? null;
  }

  function updateStatsDisplay(elapsedSeconds) {
    const remaining = Math.max(0, Math.floor(durationSeconds - elapsedSeconds));
    if (remaining !== state.remainingSeconds) {
      state.remainingSeconds = remaining;
      statsTimeEl.textContent = `${remaining}s`;
    }

    statsCommandsEl.textContent = formatNumber(state.completedCommands);
    statsAccEl.textContent = `${formatAccuracy(state.correctChars, state.totalTyped)}%`;
    statsWpmEl.textContent = formatNumber(formatWpm(state.correctChars, elapsedSeconds));
  }

  function renderCommandProgress(typedValue) {
    const evaluation = evaluateTyping(state.currentCommand, typedValue);
    state.currentTarget = evaluation.target;
    commandDisplayEl.innerHTML = formatDisplay(evaluation.displayHtml);
    const hasError = typedValue.length > 0 && !evaluation.isPrefix;
    inputEl.classList.toggle('input-error', hasError);

    if (hasError && !state.errorActive) {
      state.errorActive = true;
      audio?.playError();
      animations?.playError(inputEl);
    } else if (!hasError && state.errorActive) {
      state.errorActive = false;
    }

    return evaluation;
  }

  function prepareNextCommand() {
    const nextCommand = drawNextCommand();
    if (!nextCommand) {
      state.currentCommand = null;
      state.currentTarget = null;
      inputEl.value = '';
      inputEl.disabled = true;
      commandDisplayEl.innerHTML = '&nbsp;';
      hintEl.textContent = 'Geen commando\'s beschikbaar in deze pack.';
      return;
    }

    state.currentCommand = nextCommand;
    state.currentCommandTyped = 0;
    state.lastInputLength = 0;
    state.errorActive = false;
    state.commandStartedAt = performance.now();
    inputEl.disabled = false;
    inputEl.value = '';
    inputEl.classList.remove('input-error');
    setCommandCard(state.currentCommand);
    renderCommandProgress('');
    hintEl.textContent = 'Blijf typen tot het commando compleet is.';
    announce?.(`Nieuw commando geladen: ${state.currentCommand.command}`);
  }

  function stopTimer(persistElapsed = true) {
    if (state.timerId) {
      cancelAnimationFrame(state.timerId);
      state.timerId = null;
    }
    if (persistElapsed && state.startedAt) {
      state.elapsed += (performance.now() - state.startedAt) / 1000;
    }
    state.startedAt = null;
  }

  function finishRun() {
    if (!state.runActive) {
      return;
    }
    stopTimer(true);
    state.runActive = false;
    state.runFinished = true;
    enablePackSelection();

    inputEl.disabled = true;
    inputEl.blur();
    resetCapsState();
    state.errorActive = false;

    const elapsedSeconds = Math.min(durationSeconds, state.elapsed);
    const accuracy = formatAccuracy(state.correctChars, state.totalTyped);
    const score = state.scoringSession.finalise({ totalSeconds: durationSeconds });
    const activePackId = state.pack?.packId ?? null;
    const record = recordScore({
      modeId: 'core',
      score: score.total,
      packId: activePackId,
      completed: true
    });

    const packStats = record.pack ?? (activePackId ? getPackStats(activePackId) : null);
    const packBest = packStats?.bestScore ?? 0;
    if (packStats && activePackId) {
      packBestEl.textContent = formatNumber(packBest);
    }
    updatePackDisplay();

    resultScoreEl.textContent = formatNumber(score.total);
    resultCommandsEl.textContent = formatNumber(state.completedCommands);
    resultAccEl.textContent = `${accuracy}%`;
    resultHighscoreEl.textContent = formatNumber(packBest);
    resultBaseEl.textContent = formatNumber(score.base);
    resultBonusEl.textContent = formatNumber(score.timeBonus);
    resultPenaltyEl.textContent = formatNumber(score.penalties.errors);

    announce?.(`Run klaar. Score ${score.total}. Accuracy ${accuracy} procent.`);
    showScreen('results');
  }

  function timerStep() {
    if (!state.runActive || !state.startedAt) {
      return;
    }
    const now = performance.now();
    const elapsedSeconds = state.elapsed + (now - state.startedAt) / 1000;
    updateStatsDisplay(elapsedSeconds);
    if (elapsedSeconds >= durationSeconds) {
      finishRun();
      return;
    }
    state.timerId = requestAnimationFrame(timerStep);
  }

  function startTimer() {
    if (state.timerId) {
      return;
    }
    if (!state.startedAt) {
      state.startedAt = performance.now();
    }
    state.timerId = requestAnimationFrame(timerStep);
  }

  function pauseTimer() {
    if (!state.runActive) {
      return;
    }
    stopTimer(true);
  }

  function resetRunState() {
    if (state.pack && Array.isArray(state.pack.commands) && state.pack.commands.length) {
      state.queue = shuffle(state.pack.commands);
    } else {
      state.queue = [];
    }
    state.currentCommand = null;
    state.currentTarget = null;
    state.scoringSession = createScoringSession();
    state.timerId = null;
    state.startedAt = null;
    state.elapsed = 0;
    state.remainingSeconds = durationSeconds;
    state.commandStartedAt = null;
    state.runActive = true;
    state.runFinished = false;
    state.totalTyped = 0;
    state.correctChars = 0;
    state.completedCommands = 0;
    state.lastInputLength = 0;
    state.currentCommandTyped = 0;
    state.errorActive = false;

    statsTimeEl.textContent = `${durationSeconds}s`;
    statsCommandsEl.textContent = '0';
    statsWpmEl.textContent = '0';
    statsAccEl.textContent = '100%';
    resetCapsState();
  }

  function startRun() {
    if (state.loadingPack) {
      return;
    }
    if (!state.pack || !Array.isArray(state.pack.commands) || !state.pack.commands.length) {
      hintEl.textContent = 'Geen commando\'s beschikbaar. Kies een andere pack.';
      announce?.('Geen commando\'s beschikbaar in deze pack.');
      return;
    }
    resetRunState();
    audio?.unlock();
    showScreen('play');
    prepareNextCommand();
    inputEl.disabled = false;
    inputEl.focus();
    hintEl.textContent = 'Blijf typen tot het commando compleet is.';
    announce?.('Run gestart. Volle focus.');
    disablePackSelection();
    startTimer();
  }

  function handleInput(event) {
    if (!state.runActive) {
      event.target.value = '';
      return;
    }

    let rawValue = event.target.value;
    const trimmedStart = rawValue.replace(/^\s+/, '');
    if (trimmedStart !== rawValue) {
      rawValue = trimmedStart;
      event.target.value = rawValue;
    }

    const diff = Math.max(rawValue.length - state.lastInputLength, 0);
    if (diff > 0) {
      state.totalTyped += diff;
      state.currentCommandTyped += diff;
    }
    state.lastInputLength = rawValue.length;

    const evaluation = renderCommandProgress(rawValue);

    if (evaluation.isComplete) {
      const commandLength = evaluation.completedValue.length;
      state.correctChars += commandLength;
      state.completedCommands += 1;

      const commandErrors = countCommandErrors(state.currentCommandTyped, commandLength);
      const durationSeconds = state.commandStartedAt
        ? Math.max(0, (performance.now() - state.commandStartedAt) / 1000)
        : 0;

      state.scoringSession.addCommand({
        completed: true,
        errors: commandErrors,
        durationSeconds
      });

      state.errorActive = false;
      audio?.playCorrect();
      animations?.playSuccess(commandDisplayEl);
      if (state.completedCommands > 0 && state.completedCommands % LEVEL_UP_THRESHOLD === 0) {
        audio?.playLevelUp();
      }

      hintEl.textContent = 'Mooi. Volgende opdracht komt eraan.';
      announce?.(`Commando gehaald: ${evaluation.completedValue}`);

      prepareNextCommand();
    }
  }

  function showStartScreen() {
    populatePackSelect();
    updatePackDisplay();
    enablePackSelection();
    if (startButton) {
      startButton.disabled = state.loadingPack;
    }

    const progress = getProgress();
    const tutorialCompleted = progress.tutorialCompleted;

    if (tutorialButton) {
      tutorialButton.disabled = false;
      tutorialButton.textContent = tutorialCompleted ? 'Tutorial opnieuw' : '60s tutorial';
    }

    if (tutorialStatusEl) {
      tutorialStatusEl.textContent = tutorialCompleted
        ? 'Tutorial afgerond — speel hem gerust opnieuw voor een opfrisser.'
        : 'Nieuw? Doe eerst de 60s tutorial voor uitleg.';
    }

    showScreen('start');
    const title = state.pack?.title ?? state.pack?.packId ?? 'HackType pack';
    announce?.(`Pack geladen: ${title}. Klaar om te starten.`);
  }

  function handleRestart() {
    startRun();
  }

  function handleBackToStart() {
    showStartScreen();
  }

  packSelectEl?.addEventListener('change', (event) => {
    const value = event.target.value;
    if (!value || (state.pack && state.pack.packId === value)) {
      return;
    }
    switchPack(value);
  });

  startButton.addEventListener('click', startRun);
  tutorialButton?.addEventListener('click', () => {
    onTutorialRequested?.();
  });
  restartButton.addEventListener('click', handleRestart);
  backButton.addEventListener('click', handleBackToStart);
  inputEl.addEventListener('input', handleInput);

  document.addEventListener('keydown', updateCapsState);
  document.addEventListener('keyup', updateCapsState);

  document.addEventListener('keydown', (event) => {
    if (state.screen === 'results' && event.key === 'Enter') {
      event.preventDefault();
      handleRestart();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseTimer();
    } else if (document.visibilityState === 'visible' && state.runActive) {
      state.startedAt = performance.now();
      startTimer();
    }
  });

  return {
    showStartScreen,
    startRun
  };
}
