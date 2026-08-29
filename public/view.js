import { decryptSecret } from '/crypto.js';
import { initLangSwitcher } from '/i18n.js';
import { STRINGS } from '/strings.js';
import { createCopyButton, wireCopyButton } from '/copy.js';

const getLang = initLangSwitcher(STRINGS);

const openBtn = document.getElementById('openBtn');
const pinAttempt = document.getElementById('pinAttempt');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const revealBox = document.getElementById('revealBox');

function setStatus(state, key, suffix) {
  statusDot.className = 'dot ' + (state || '');
  statusText.textContent = STRINGS[getLang()][key] + (suffix || '');
}

function parseLocation() {
  const m = location.pathname.match(/^\/s\/([^/]+)$/);
  const id = m ? m[1] : null;
  const hashMatch = location.hash.match(/^#key=(.+)$/);
  const fragmentKey = hashMatch ? decodeURIComponent(hashMatch[1]) : null;
  return { id, fragmentKey };
}

const { id, fragmentKey } = parseLocation();
if (!id || !fragmentKey) {
  setStatus('off', 'statusBadLink');
  openBtn.disabled = true;
}

openBtn.addEventListener('click', async () => {
  revealBox.innerHTML = '';
  const pin = pinAttempt.value.trim();
  if (!pin) {
    setStatus('off', 'statusEnterPin');
    return;
  }

  openBtn.disabled = true;
  try {
    const res = await fetch(`/api/secrets/${encodeURIComponent(id)}`);
    if (!res.ok) {
      setStatus('off', 'statusNotFound');
      return;
    }
    const record = await res.json();

    let secret;
    try {
      secret = await decryptSecret(record, fragmentKey, pin);
    } catch {
      const attemptRes = await fetch(`/api/secrets/${encodeURIComponent(id)}/attempt-failed`, { method: 'POST' });
      if (attemptRes.status === 429) {
        setStatus('off', 'statusRateLimited');
        return;
      }
      if (!attemptRes.ok) {
        setStatus('off', 'statusNotFound');
        return;
      }
      const info = await attemptRes.json();
      if (info.deleted) {
        setStatus('off', 'statusAttemptsExhausted');
      } else {
        setStatus('off', 'statusWrongPin', ` (${info.attempts}/${info.max_attempts})`);
      }
      return;
    }

    await fetch(`/api/secrets/${encodeURIComponent(id)}/burn`, { method: 'POST' });
    setStatus('on', 'statusSuccess');

    const row = document.createElement('div');
    row.className = 'field-row';

    const reveal = document.createElement('div');
    reveal.className = 'reveal';
    reveal.textContent = secret;

    const copyBtn = createCopyButton(STRINGS[getLang()].copySecretAria);
    wireCopyButton(copyBtn, () => secret);

    row.appendChild(reveal);
    row.appendChild(copyBtn);
    revealBox.appendChild(row);
  } finally {
    openBtn.disabled = false;
  }
});
