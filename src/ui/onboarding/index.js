import {
  evaluateTyping,
  formatDisplay,
  formatAccuracy,
  formatWpm
} from '../../logic/typing.js';
import { markTutorialCompleted, getProgress } from '../../storage/local/index.js';

const numberFormatter = new Intl.NumberFormat('nl-NL');

const TUTORIAL_DURATION_SECONDS = 60;

const TUTORIAL_COMMANDS = [
  {
    id: 'tutorial-pwd',
    command: 'pwd',
    accepted_variants: ['pwd'],
    description: 'Stap 1 — altijd weten waar je bent. Voer `pwd` uit om het huidige pad te zien.',
    mock_output: '/home/analyst\n',
    hint: 'Typ: pwd'
  },
  {
    id: 'tutorial-ls',
    command: 'ls',
    accepted_variants: ['ls'],
    description: 'Stap 2 — verken de mapinhoud met `ls`. Handig na elke pivot.',
    mock_output: 'README.md\nnotes\nscripts\n',
    hint: 'Typ: ls'
  },
  {
    id: 'tutorial-ls-flags',
    command: 'ls -la',
    accepted_variants: ['ls -la'],
    description: 'Stap 3 — voeg flags toe om verborgen bestanden te zien. Gebruik hier `ls -la`.',
    mock_output: 'drwxr-xr-x  4 analyst analyst  128 .\ndrwxr-xr-x 14 root    root     512 ..\n-rw-r--r--  1 analyst analyst 1024 .bashrc\n',
    hint: 'Typ: ls -la'
  },
  {
    id: 'tutorial-cat',
    command: 'cat recon.txt',
    accepted_variants: ['cat recon.txt'],
    description: 'Stap 4 — bekijk notities met `cat`. Typ het commando exact over.',
    mock_output: '[Recon]\n- ping sweep\n- nmap -sC -sV\n- quick http enum\n',
    hint: 'Typ: cat recon.txt'
  }
];

function formatNumber(value) {
  return numberFormatter.format(Math.max(0, Math.floor(value)));
}

export function createOnboarding({ screens, announce, audio, animations, onFinish }) {
  const tutorialScreen = screens.tutorial;
  if (!tutorialScreen) {
    return {
      showIntro() {},
      startTutorial() {}
    };
  }

  const sessionSection = tutorialScreen.querySelector('#tutorial-session');
  const summarySection = tutorialScreen.querySelector('#tutorial-summary');
  const timeEl = tutorialScreen.querySelector('#tutorial-time');
  const progressEl = tutorialScreen.querySelector('#tutorial-progress');
  const capsEl = tutorialScreen.querySelector('#tutorial-caps');
  const commandTitleEl = tutorialScreen.querySelector('#tutorial-command');
  const commandDescriptionEl = tutorialScreen.querySelector('#tutorial-description');
  const commandOutputEl = tutorialScreen.querySelector('#tutorial-output');
  const displayEl = tutorialScreen.querySelector('#tutorial-display');
  const inputEl = tutorialScreen.querySelector('#tutorial-input');
  const hintEl = tutorialScreen.querySelector('#tutorial-hint');
  const startButton = tutorialScreen.querySelector('[data-action="tutorial-start"]');
  const skipButton = tutorialScreen.querySelector('[data-action="tutorial-skip"]');
  const finishButton = tutorialScreen.querySelector('[data-action="tutorial-finish"]');
  const retryButton = tutorialScreen.querySelector('[data-action="tutorial-retry"]');
  const summaryCommandsEl = tutorialScreen.querySelector('#tutorial-summary-commands');
  const summaryAccuracyEl = tutorialScreen.querySelector('#tutorial-summary-accuracy');
  const summaryWpmEl = tutorialScreen.querySelector('#tutorial-summary-wpm');

  const state = {
    active: false,
    queueIndex: 0,
    timerId: null,
    startedAt: null,
    elapsed: 0,
    remainingSeconds: TUTORIAL_DURATION_SECONDS,
    totalTyped: 0,
    correctChars: 0,
    lastInputLength: 0,
    completedCommands: 0,
    errorActive: false,
    currentCommand: null,
    wasCompleted: false
  };

  const totalSteps = TUTORIAL_COMMANDS.length;

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      if (el) {
        el.hidden = key !== name;
      }
    });
  }

  function updateCapsState(event) {
    if (!capsEl || typeof event.getModifierState !== 'function') {
      return;
    }
    capsEl.hidden = !event.getModifierState('CapsLock');
  }

  function resetCapsState() {
    if (capsEl) {
      capsEl.hidden = true;
    }
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

  function resetTimer() {
    stopTimer(false);
    state.elapsed = 0;
    state.remainingSeconds = TUTORIAL_DURATION_SECONDS;
    timeEl.textContent = `${TUTORIAL_DURATION_SECONDS}s`;
  }

  function timerStep() {
    if (!state.active || !state.startedAt) {
      return;
    }
    const now = performance.now();
    const elapsedSeconds = state.elapsed + (now - state.startedAt) / 1000;
    const remaining = Math.max(0, Math.floor(TUTORIAL_DURATION_SECONDS - elapsedSeconds));
    if (remaining !== state.remainingSeconds) {
      state.remainingSeconds = remaining;
      timeEl.textContent = `${remaining}s`;
    }
    if (elapsedSeconds >= TUTORIAL_DURATION_SECONDS) {
      completeTutorial();
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

  function updateProgressDisplay() {
    const current = state.active ? state.queueIndex + 1 : state.queueIndex;
    progressEl.textContent = `${Math.min(current, totalSteps)}/${totalSteps}`;
  }

  function setCommandCard(command) {
    state.currentCommand = command;
    commandTitleEl.textContent = command.command;
    commandDescriptionEl.textContent = command.description ?? '';
    if (command.mock_output && command.mock_output.trim().length) {
      commandOutputEl.textContent = command.mock_output;
      commandOutputEl.hidden = false;
    } else {
      commandOutputEl.textContent = '';
      commandOutputEl.hidden = true;
    }
    hintEl.textContent = command.hint ?? 'Typ het commando exact over.';
    displayEl.innerHTML = '&nbsp;';
    inputEl.value = '';
    inputEl.classList.remove('input-error');
    state.lastInputLength = 0;
    state.errorActive = false;
    updateProgressDisplay();
    announce?.(`Tutorial stap: ${command.command}`);
  }

  function prepareNextCommand() {
    if (state.queueIndex >= totalSteps) {
      completeTutorial();
      return;
    }
    const entry = TUTORIAL_COMMANDS[state.queueIndex];
    setCommandCard(entry);
  }

  function resetSessionState() {
    state.active = false;
    state.queueIndex = 0;
    state.totalTyped = 0;
    state.correctChars = 0;
    state.lastInputLength = 0;
    state.completedCommands = 0;
    state.errorActive = false;
    state.wasCompleted = false;
    resetTimer();
    displayEl.innerHTML = '&nbsp;';
    hintEl.textContent = 'Druk op Start tutorial om te beginnen.';
    updateProgressDisplay();
    resetCapsState();
  }

  function showSession() {
    sessionSection.hidden = false;
    summarySection.hidden = true;
    if (startButton) {
      startButton.disabled = false;
    }
    if (inputEl) {
      inputEl.disabled = true;
      inputEl.value = '';
    }
    displayEl.innerHTML = '&nbsp;';
  }

  function showSummary({ completed }) {
    sessionSection.hidden = true;
    summarySection.hidden = false;
    finishButton?.focus();
    state.wasCompleted = completed;
  }

  function startSession() {
    if (state.active) {
      return;
    }
    resetSessionState();
    state.active = true;
    state.queueIndex = 0;
    state.startedAt = performance.now();
    state.elapsed = 0;
    state.remainingSeconds = TUTORIAL_DURATION_SECONDS;
    if (startButton) {
      startButton.disabled = true;
    }
    if (inputEl) {
      inputEl.disabled = false;
      inputEl.focus();
    }
    audio?.unlock();
    prepareNextCommand();
    startTimer();
  }

  function renderProgress(value) {
    const evaluation = evaluateTyping(state.currentCommand, value);
    displayEl.innerHTML = formatDisplay(evaluation.displayHtml);
    const hasError = value.length > 0 && !evaluation.isPrefix;
    inputEl.classList.toggle('input-error', hasError);

    if (hasError && !state.errorActive) {
      state.errorActive = true;
      audio?.playError();
      animations?.playError(inputEl);
      hintEl.textContent = 'Controleer je invoer, exacte match nodig.';
    } else if (!hasError && state.errorActive) {
      state.errorActive = false;
      hintEl.textContent = state.currentCommand.hint ?? 'Ga door tot het commando compleet is.';
    }

    return evaluation;
  }

  function handleInput(event) {
    if (!state.active) {
      event.target.value = '';
      return;
    }

    const raw = event.target.value.replace(/^\s+/, '');
    if (raw !== event.target.value) {
      event.target.value = raw;
    }

    const diff = Math.max(raw.length - state.lastInputLength, 0);
    if (diff > 0) {
      state.totalTyped += diff;
    }
    state.lastInputLength = raw.length;

    const evaluation = renderProgress(raw);

    if (evaluation.isComplete) {
      const length = evaluation.completedValue.length;
      state.correctChars += length;
      state.completedCommands += 1;
      state.queueIndex += 1;
      state.errorActive = false;
      audio?.playCorrect();
      animations?.playSuccess(displayEl);
      hintEl.textContent = 'Netjes! Volgende stap volgt meteen.';
      prepareNextCommand();
    }
  }

  function completeTutorial() {
    if (!state.active) {
      return;
    }
    stopTimer(true);
    state.active = false;
    if (inputEl) {
      inputEl.disabled = true;
    }
    resetCapsState();

    const elapsedSeconds = Math.min(TUTORIAL_DURATION_SECONDS, state.elapsed);
    const accuracy = formatAccuracy(state.correctChars, state.totalTyped);
    const wpm = formatWpm(state.correctChars, Math.max(elapsedSeconds, 1));

    summaryCommandsEl.textContent = formatNumber(state.completedCommands);
    summaryAccuracyEl.textContent = `${accuracy}%`;
    summaryWpmEl.textContent = formatNumber(wpm);

    markTutorialCompleted();
    announce?.('Tutorial afgerond. Je bent klaar om te spelen.');
    audio?.playLevelUp();
    showSummary({ completed: true });
  }

  function exitToStart({ completed }) {
    stopTimer(false);
    state.active = false;
    resetSessionState();
    showSession();
    showScreen('start');
    onFinish?.({ completed });
  }

  function handleRetry() {
    showSession();
    startSession();
  }

  function handleSkip() {
    exitToStart({ completed: false });
  }

  function handleFinish() {
    exitToStart({ completed: state.wasCompleted });
  }

  function showIntro() {
    resetSessionState();
    showScreen('tutorial');
    showSession();
    const progress = getProgress();
    if (progress.tutorialCompleted) {
      hintEl.textContent = 'Je kunt de tutorial altijd opnieuw spelen via deze module.';
    }
  }

  startButton?.addEventListener('click', startSession);
  skipButton?.addEventListener('click', handleSkip);
  finishButton?.addEventListener('click', handleFinish);
  retryButton?.addEventListener('click', handleRetry);
  inputEl?.addEventListener('input', handleInput);

  document.addEventListener('keydown', updateCapsState);
  document.addEventListener('keyup', updateCapsState);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopTimer(true);
    } else if (document.visibilityState === 'visible' && state.active) {
      state.startedAt = performance.now();
      startTimer();
    }
  });

  return {
    showIntro,
    startTutorial: showIntro
  };
}

export default {
  createOnboarding
};
