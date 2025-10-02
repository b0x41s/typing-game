import { createScoringSession } from '../../logic/scoring.js';
import {
  evaluateTyping,
  countCommandErrors,
  formatAccuracy,
  formatWpm,
  formatDisplay
} from '../../logic/typing.js';
import { getHighScore, recordScore } from '../../storage/local/index.js';

const numberFormatter = new Intl.NumberFormat('nl-NL');

const LEVEL_UP_THRESHOLD = 5;

function formatNumber(value) {
  return numberFormatter.format(Math.max(0, Math.floor(value)));
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
  pack,
  durationSeconds,
  announce,
  audio,
  animations
}) {
  const startScreen = screens.start;
  const playScreen = screens.play;
  const resultsScreen = screens.results;

  const packTitleEl = startScreen.querySelector('#pack-title');
  const packSummaryEl = startScreen.querySelector('#pack-summary');
  const startHighscoreEl = startScreen.querySelector('#start-highscore');
  const startButton = startScreen.querySelector('[data-action="start-run"]');

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

  const commandsPool = pack.commands;

  const state = {
    screen: 'loading',
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
    errorActive: false
  };

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
    if (!state.queue.length) {
      state.queue = shuffle(commandsPool);
    }
  }

  function drawNextCommand() {
    ensureQueue();
    return state.queue.shift();
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
    state.currentCommand = drawNextCommand();
    state.currentCommandTyped = 0;
    state.lastInputLength = 0;
    state.errorActive = false;
    state.commandStartedAt = performance.now();
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

    inputEl.disabled = true;
    inputEl.blur();
    resetCapsState();
    state.errorActive = false;

    const elapsedSeconds = Math.min(durationSeconds, state.elapsed);
    const accuracy = formatAccuracy(state.correctChars, state.totalTyped);
    const score = state.scoringSession.finalise({ totalSeconds: durationSeconds });
    const { highScore } = recordScore({
      modeId: 'core',
      score: score.total,
      packId: pack.packId,
      completed: true
    });

    resultScoreEl.textContent = formatNumber(score.total);
    resultCommandsEl.textContent = formatNumber(state.completedCommands);
    resultAccEl.textContent = `${accuracy}%`;
    resultHighscoreEl.textContent = formatNumber(highScore);
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
    state.queue = shuffle(commandsPool);
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
    resetRunState();
    audio?.unlock();
    showScreen('play');
    prepareNextCommand();
    inputEl.disabled = false;
    inputEl.focus();
    hintEl.textContent = 'Blijf typen tot het commando compleet is.';
    announce?.('Run gestart. Volle focus.');
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
    const highScore = getHighScore('core');
    startHighscoreEl.textContent = formatNumber(highScore);
    packTitleEl.textContent = pack.title ?? 'HackType pack';
    packSummaryEl.textContent = pack.summary ?? '';
    showScreen('start');
    announce?.(`Pack geladen: ${pack.title}. Klaar om te starten.`);
  }

  function handleRestart() {
    startRun();
  }

  function handleBackToStart() {
    showStartScreen();
  }

  startButton.addEventListener('click', startRun);
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
