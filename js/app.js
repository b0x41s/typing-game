// Elementen
const display = document.getElementById('display');
const input = document.getElementById('input');
const startBtn = document.getElementById('start');
const resetBtn = document.getElementById('reset');
const wpmEl = document.getElementById('wpm');
const accEl = document.getElementById('acc');
const timeEl = document.getElementById('time');
const capsEl = document.getElementById('caps');

// Woordenlijsten per moeilijkheid
const EASY = [
  "ls", "pwd", "whoami", "id", "date", "uptime", "clear", "echo test", "cat README.md",
  "touch notes.txt", "mkdir tmp", "rmdir tmp", "cd ..", "cd /", "uname -a", "hostname",
  "df -h", "du -sh .", "free -h", "head -n 5 file.txt", "tail -n 5 file.txt", "cp a b",
  "mv a b", "rm a", "grep TODO file.txt", "ps aux", "kill -9 1", "top", "htop", "env",
  "history", "logout", "ssh user@host", "scp a b", "man ls", "less file.txt", "more file.txt",
  "chmod 644 file", "chown user file", "which python3", "whereis bash", "ln -s a b", "find .",
  "printf ok", "sed -n '1,5p' file.txt", "wc -l file.txt"
];

const MEDIUM = [
  "ls -l", "ls -la", "ls -ltr", "ls -ltra", "grep -i error syslog",
  "grep -R password .", "awk '{print $1}' file.txt", "cut -d: -f1 /etc/passwd",
  "sort file.txt", "sort -u file.txt", "uniq -c file.txt",
  "tar -czf backup.tgz dir/", "tar -xzf backup.tgz",
  "curl -I https://example.com", "curl -s https://example.com",
  "wget https://example.com/file", "ping -c 3 8.8.8.8",
  "tr -d '\\r' < in > out", "ps aux --forest", "journalctl -xe",
  "systemctl status ssh", "systemctl restart ssh", "service ssh status",
  "ip a", "ip r", "ip link", "ss -tulpn", "netstat -tulpen",
  "dig a example.com", "dig +short txt example.com", "host example.com",
  "nslookup example.com", "iptables -L", "ufw status",
  "docker ps", "docker images", "docker logs -f web",
  "git status", "git add -A", "git commit -m \"msg\"", "git push",
  "python3 -V", "python3 -m venv .venv", "source .venv/bin/activate",
  "pip install requests", "node -v", "npm -v", "npm init -y"
];

const HARD = [
  "python3 -m http.server 8000",
  "ssh -i ~/.ssh/id_rsa user@server",
  "rsync -avz src/ user@host:/var/www/",
  "find . -type f -name \"*.log\" -mtime -1",
  "grep -R --line-number --color=always \"token\" .",
  "awk -F: '{if($3==0) print $1}' /etc/passwd",
  "sed -E 's/(passw)[^ ]+/***REDACTED***/g' file.txt",
  "tar -czf backup-$(date +%F).tgz /etc /var/www",
  "journalctl -u nginx --since \"-1h\"",
  "systemctl list-unit-files | grep enabled",
  "curl -H \"Authorization: Bearer X\" https://api.example.com/v1",
  "curl -sSLo /tmp/app.tgz https://example.com/app.tgz",
  "openssl rand -hex 16",
  "openssl s_client -connect example.com:443 -servername example.com",
  "docker run --rm -p 8080:80 nginx",
  "docker compose up -d",
  "git log --oneline --graph --decorate --all",
  "git rebase -i HEAD~3",
  "kubectl get pods -A",
  "kubectl logs -f deploy/web",
  "ps aux | grep -i postgres | grep -v grep",
  "iptables -S",
  "ip route get 1.1.1.1",
  "nmap -sV -p 1-1024 127.0.0.1",
  "openssl dgst -sha256 file.bin",
  "head -c 32 /dev/urandom | xxd -p",
  "chmod -R 750 /var/www",
  "chown -R www-data:www-data /var/www",
  "printf '%s\\n' foo bar | tee out.txt",
  "jq '.items[] | .name' data.json"
];

// Interne staat
let current = '';
let correct = 0;
let totalTyped = 0;
let startTime = null;
let timer = null;
let timeLeft = 60;

// Utility: kies woord o.b.v. tijdssegment
function selectTierWord() {
  const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
  // 0–20s easy, 20–40s medium, 40–60s hard
  if (elapsed < 20) return pick(EASY);
  if (elapsed < 40) return pick(MEDIUM);
  return pick(HARD);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// HTML render met prefix highlighting
function renderWord(target, typed) {
  let prefixLen = 0;
  for (let i = 0; i < Math.min(typed.length, target.length); i++) {
    if (typed[i] === target[i]) prefixLen++;
    else break;
  }
  const ok = target.slice(0, prefixLen);
  const rest = target.slice(prefixLen);
  display.innerHTML = `<span class="ok">${escapeHtml(ok)}</span>${escapeHtml(rest)}`;
}

// Escaping
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function nextWord(){
  current = selectTierWord();
  renderWord(current, '');
  input.value = '';
}

function updateStats(){
  const elapsedMin = Math.max(1/60, ((Date.now()-startTime)/1000)/60);
  const wpm = Math.round((correct/5) / elapsedMin);
  const acc = totalTyped === 0 ? 100 : Math.round((correct/totalTyped)*100);
  wpmEl.textContent = `WPM: ${wpm}`;
  accEl.textContent = `Acc: ${acc}%`;
  timeEl.textContent = `Tijd: ${timeLeft}s`;
}

function tick(){
  timeLeft--;
  if(timeLeft <= 0){
    endGame();
    return;
  }
  updateStats();
}

function startGame(){
  correct = 0; totalTyped = 0; timeLeft = 60;
  startTime = Date.now();
  input.disabled = false;
  input.focus();
  nextWord();
  updateStats();
  if(timer) clearInterval(timer);
  timer = setInterval(tick, 1000);
}

function endGame(){
  clearInterval(timer);
  input.disabled = true;
  const elapsedMin = Math.max(1/60, ((Date.now()-startTime)/1000)/60);
  const wpm = Math.round((correct/5) / elapsedMin);
  const acc = totalTyped === 0 ? 100 : Math.round((correct/totalTyped)*100);
  display.textContent = `Einde, score WPM: ${wpm}, Acc: ${acc}%`;
}

function resetGame(){
  if(timer) clearInterval(timer);
  input.disabled = true;
  display.textContent = 'klaar? druk start';
  wpmEl.textContent = 'WPM: 0';
  accEl.textContent = 'Acc: 100%';
  timeEl.textContent = 'Tijd: 60s';
  input.value = '';
  capsEl.classList.add('hidden');
}

// Caps Lock detectie
function setCapsWarning(on) {
  if (on) capsEl.classList.remove('hidden');
  else capsEl.classList.add('hidden');
}

// Event handlers
input.addEventListener('input', (e) => {
  const val = e.target.value;
  totalTyped += 1; // telt toetsaanslag, inclusief spaties
  // Highlight live
  renderWord(current, val);

  // Eenvoudige foutindicatie via CSS klas op input
  if (!current.startsWith(val)) {
    input.classList.add('err');
  } else {
    input.classList.remove('err');
  }

  // Bij volledige match
  if (val === current) {
    correct += current.length;
    nextWord();
  }
  updateStats();
});

// Caps Lock bij key events en focus
['keydown','keyup'].forEach(evt => {
  input.addEventListener(evt, (e) => {
    // getModifierState is case-insensitive voor letters en werkt ook bij symbolen
    const on = e.getModifierState && e.getModifierState('CapsLock');
    setCapsWarning(on);
  });
});
input.addEventListener('focus', () => setCapsWarning(false));
input.addEventListener('blur', () => setCapsWarning(false));

startBtn.addEventListener('click', startGame);

resetBtn.addEventListener('click', resetGame);

// Enter herstart bij game-over
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && input.disabled) startGame();
});

// Init
resetGame();
