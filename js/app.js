(() => {
  const DURATION = 60;
  const displayEl = document.getElementById('display');
  const inputEl = document.getElementById('input');
  const wpmEl = document.getElementById('wpm');
  const accEl = document.getElementById('acc');
  const timeEl = document.getElementById('time');
  const startBtn = document.getElementById('start');
  const resetBtn = document.getElementById('reset');
  const liveRegion = document.getElementById('live-region');

  const fallbackWords = [
    'root', 'sudo', 'proxy', 'packet', 'cipher', 'payload', 'kernel', 'buffer', 'encode',
    'decode', 'binary', 'token', 'hash', 'nonce', 'http', 'https', 'json', 'yaml', 'linux',
    'docker', 'nginx', 'auth', 'jwt', 'csrf', 'xss', 'sqli', 'rce', 'lfi', 'fuzz', 'nmap',
    'hydra', 'burp', 'wireshark', 'pcap', 'mitm', 'tcp', 'udp', 'dns', 'ssh', 'scp', 'git',
    'push', 'pull', 'branch', 'merge', 'diff', 'patch', 'commit', 'tag', 'gpg', 'aes', 'rsa',
    'ecc', 'salt', 'pepper', 'rainbow', 'sandbox', 'vm', 'hypervisor', 'checksum', 'sha256',
    'argon2', 'passphrase', 'regex', 'encrypt', 'decrypt', 'botnet', 'beacon', 'webhook',
    'api', 'shellcode', 'syscall', 'uptime', 'latency', 'mutex', 'thread', 'cron', 'systemd',
    'kube', 'pod', 'cluster', 'vault', 'consul', 'spectre', 'meltdown', 'entropy', 'prng',
    'ciphertext', 'plaintext', 'honeypot', 'phishing', 'debug', 'profile', 'benchmark',
    'bytecode', 'firewall', 'suricata', 'recon', 'telemetry', 'logstash', 'kibana', 'cloudtrail'
  ];

  const state = {
    words: [],
    queue: [],
    timerId: null,
    startedAt: null,
    elapsed: 0,
    remaining: DURATION,
    started: false,
    finished: false,
    totalTyped: 0,
    correctChars: 0,
    currentWord: '',
    lastInputLength: 0
  };

  // Schudt de lijst zodat woorden pas herhaald worden na een volledige ronde.
  function shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function announce(message) {
    liveRegion.textContent = '';
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 30);
  }

  function renderWord(typed = '') {
    if (!state.currentWord) {
      displayEl.innerHTML = '&nbsp;';
      return;
    }

    const word = state.currentWord;
    let prefixLength = 0;

    while (prefixLength < typed.length && prefixLength < word.length && typed[prefixLength] === word[prefixLength]) {
      prefixLength += 1;
    }

    const mistakePresent = typed.length > prefixLength;
    const nextChar = word[prefixLength] ?? '';
    const restStart = mistakePresent && nextChar ? prefixLength + 1 : prefixLength;

    let html = '';

    if (prefixLength) {
      html += `<span class="ok">${escapeHTML(word.slice(0, prefixLength))}</span>`;
    }

    if (mistakePresent && nextChar) {
      html += `<span class="err">${escapeHTML(nextChar)}</span>`;
    } else if (mistakePresent && !nextChar) {
      html += '<span class="err">_</span>';
    }

    if (word.length > restStart) {
      html += escapeHTML(word.slice(restStart));
    }

    displayEl.innerHTML = html || escapeHTML(word);
  }

  function computeElapsed() {
    if (!state.startedAt) {
      return state.elapsed;
    }
    return state.elapsed + (performance.now() - state.startedAt) / 1000;
  }

  function updateStats() {
    const elapsedSeconds = computeElapsed();
    const minutes = elapsedSeconds > 0 ? elapsedSeconds / 60 : 0;
    const rawWpm = minutes > 0 ? (state.correctChars / 5) / minutes : 0;
    const wpm = Number.isFinite(rawWpm) ? Math.round(rawWpm) : 0;
    const accuracy = state.totalTyped > 0 ? Math.round((state.correctChars / state.totalTyped) * 100) : 100;

    wpmEl.textContent = String(Math.max(0, wpm));
    accEl.textContent = `${Math.max(0, Math.min(accuracy, 100))}%`;
  }

  function updateTime() {
    timeEl.textContent = `${Math.max(0, state.remaining)}s`;
  }

  function startTimer() {
    if (state.timerId) {
      return;
    }

    if (!state.startedAt) {
      state.startedAt = performance.now();
    }

    const step = () => {
      if (!state.started) {
        return;
      }

      const elapsedSeconds = computeElapsed();
      const newRemaining = Math.max(DURATION - Math.floor(elapsedSeconds), 0);

      if (newRemaining !== state.remaining) {
        state.remaining = newRemaining;
        updateTime();
      }

      updateStats();

      if (newRemaining <= 0) {
        endGame();
        return;
      }

      state.timerId = window.requestAnimationFrame(step);
    };

    state.timerId = window.requestAnimationFrame(step);
  }

  function stopTimer(persistElapsed = true) {
    if (state.timerId) {
      window.cancelAnimationFrame(state.timerId);
      state.timerId = null;
    }

    if (persistElapsed && state.startedAt) {
      state.elapsed += (performance.now() - state.startedAt) / 1000;
    }

    state.startedAt = null;
  }

  function pauseTimer() {
    if (!state.started) {
      return;
    }
    stopTimer(true);
  }

  function resumeTimer() {
    if (!state.started || state.timerId) {
      return;
    }
    startTimer();
  }

  function refreshQueue() {
    state.queue = shuffle(state.words);
  }

  function nextWord() {
    if (!state.words.length) {
      return;
    }
    if (state.queue.length === 0) {
      refreshQueue();
    }
    state.currentWord = state.queue.shift();
    renderWord('');
    announce(`Nieuw woord: ${state.currentWord}`);
  }

  function startGame() {
    if (!state.words.length || state.started) {
      return;
    }

    state.started = true;
    state.finished = false;
    state.elapsed = 0;
    state.remaining = DURATION;
    state.totalTyped = 0;
    state.correctChars = 0;
    state.currentWord = '';
    state.lastInputLength = 0;
    refreshQueue();

    inputEl.value = '';
    inputEl.disabled = false;
    inputEl.classList.remove('input-error');
    inputEl.focus();

    startBtn.disabled = true;
    resetBtn.disabled = false;

    updateTime();
    updateStats();
    nextWord();
    startTimer();
  }

  function endGame() {
    if (!state.started) {
      return;
    }

    stopTimer(true);
    state.started = false;
    state.finished = true;
    state.remaining = 0;
    updateTime();
    updateStats();

    inputEl.disabled = true;
    inputEl.blur();
    inputEl.classList.remove('input-error');

    startBtn.disabled = false;
    announce(`Tijd is op. ${wpmEl.textContent} woorden per minuut, ${accEl.textContent} nauwkeurigheid.`);
  }

  function resetGame() {
    stopTimer(false);
    state.started = false;
    state.finished = false;
    state.elapsed = 0;
    state.remaining = DURATION;
    state.totalTyped = 0;
    state.correctChars = 0;
    state.currentWord = '';
    state.queue = [];
    state.lastInputLength = 0;

    inputEl.value = '';
    inputEl.disabled = true;
    inputEl.classList.remove('input-error');

    startBtn.disabled = false;
    resetBtn.disabled = true;

    displayEl.innerHTML = '&nbsp;';
    updateTime();
    updateStats();
    announce('Game gereset. Druk op start om te spelen.');
  }

  function handleInput(event) {
    if (!state.started) {
      event.target.value = '';
      return;
    }

    const raw = event.target.value;
    const value = raw.replace(/^\s+/, '');
    if (value !== raw) {
      event.target.value = value;
    }

    const diff = Math.max(value.length - state.lastInputLength, 0);
    if (diff > 0) {
      state.totalTyped += diff;
    }
    state.lastInputLength = value.length;

    const word = state.currentWord;
    const typed = value.replace(/\s+$/, '');
    const isCorrectPrefix = word.startsWith(typed);
    inputEl.classList.toggle('input-error', value.length > 0 && !isCorrectPrefix);

    renderWord(typed);
    updateStats();

    const completed = typed === word && value.length >= word.length;

    if (completed) {
      state.correctChars += word.length;
      state.lastInputLength = 0;
      event.target.value = '';
      inputEl.classList.remove('input-error');
      nextWord();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' && state.finished) {
      event.preventDefault();
      startGame();
    }
  }

  async function loadWords() {
    try {
      const res = await fetch('data/words.txt', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Kan woordenlijst niet laden');
      }
      const text = await res.text();
      const list = text
        .split(/\r?\n/)
        .map((word) => word.trim())
        .filter(Boolean);
      if (!list.length) {
        throw new Error('Woordenlijst leeg');
      }
      state.words = Array.from(new Set(list));
    } catch (error) {
      state.words = fallbackWords;
    }
  }

  startBtn.addEventListener('click', () => {
    if (!state.started) {
      startGame();
    }
  });

  resetBtn.addEventListener('click', () => {
    resetGame();
  });

  inputEl.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      pauseTimer();
    } else if (document.visibilityState === 'visible') {
      resumeTimer();
    }
  });

  loadWords().then(() => {
    if (!state.words.length) {
      state.words = fallbackWords;
    }
    resetGame();
  });
})();
