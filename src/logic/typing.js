function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function prefixScore(candidate, typed) {
  const max = Math.min(candidate.length, typed.length);
  let score = 0;
  while (score < max && candidate[score] === typed[score]) {
    score += 1;
  }
  return score;
}

function resolveTarget(candidates, typed) {
  if (!candidates.length) {
    return '';
  }
  if (!typed) {
    return candidates[0];
  }
  let best = candidates[0];
  let bestScore = prefixScore(best, typed);
  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    const score = prefixScore(candidate, typed);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
      if (score === typed.length) {
        break;
      }
    }
  }
  return best;
}

function renderProgress(target, typed) {
  if (!target) {
    return '&nbsp;';
  }

  if (!typed) {
    return escapeHTML(target);
  }

  let prefixLength = 0;
  while (
    prefixLength < typed.length &&
    prefixLength < target.length &&
    typed[prefixLength] === target[prefixLength]
  ) {
    prefixLength += 1;
  }

  const hasMistake = typed.length > prefixLength;
  const nextChar = target[prefixLength] ?? '';
  const restStart = hasMistake && nextChar ? prefixLength + 1 : prefixLength;

  let html = '';

  if (prefixLength) {
    html += `<span class="ok">${escapeHTML(target.slice(0, prefixLength))}</span>`;
  }

  if (hasMistake) {
    const expected = nextChar || '_';
    html += `<span class="err">${escapeHTML(expected)}</span>`;
  }

  if (target.length > restStart) {
    html += escapeHTML(target.slice(restStart));
  }

  if (!html) {
    html = escapeHTML(target);
  }

  return html;
}

export function evaluateTyping(commandEntry, typed) {
  const candidates = [
    commandEntry.command,
    ...(commandEntry.accepted_variants ?? [])
  ].filter(Boolean);

  const resolvedTarget = resolveTarget(candidates, typed);
  const trimmed = typed.replace(/\s+$/, '');
  const isPrefix = resolvedTarget.startsWith(typed);
  const completedVariant = candidates.find((candidate) => trimmed === candidate) ?? null;
  const displayHtml = renderProgress(resolvedTarget, typed);

  return {
    target: resolvedTarget,
    displayHtml,
    isPrefix,
    isComplete: Boolean(completedVariant),
    completedValue: completedVariant
  };
}

export function countCommandErrors(totalTyped, correctChars) {
  return Math.max(0, Math.floor(totalTyped) - Math.floor(correctChars));
}

export function formatAccuracy(correctChars, totalTyped) {
  if (totalTyped <= 0) {
    return 100;
  }
  const ratio = correctChars / totalTyped;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function formatWpm(correctChars, elapsedSeconds) {
  if (elapsedSeconds <= 0) {
    return 0;
  }
  const words = correctChars / 5;
  const minutes = elapsedSeconds / 60;
  const wpm = words / minutes;
  return Number.isFinite(wpm) ? Math.max(0, Math.round(wpm)) : 0;
}

export function formatDisplay(html) {
  return html || '&nbsp;';
}
