import { encryptSecret, randomBytes, randomPin } from '/crypto.js';
import { initLangSwitcher } from '/i18n.js';
import { STRINGS } from '/strings.js';
import { wireCopyButton } from '/copy.js';

const getLang = initLangSwitcher(STRINGS);

const createBtn = document.getElementById('createBtn');
const secretInput = document.getElementById('secretInput');
const ttlInput = document.getElementById('ttlInput');
const linkOut = document.getElementById('linkOut');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const pinOut = document.getElementById('pinOut');
const copyPinBtn = document.getElementById('copyPinBtn');
const pinHint = document.getElementById('pinHint');
const note = document.getElementById('createNote');

wireCopyButton(copyLinkBtn, () => linkOut.textContent);
wireCopyButton(copyPinBtn, () => pinOut.textContent);

createBtn.addEventListener('click', async () => {
  const secret = secretInput.value;
  const ttl = parseInt(ttlInput.value, 10);
  const t = STRINGS[getLang()];

  if (!secret.trim()) {
    note.textContent = t.errEmptySecret;
    note.className = 'note err';
    return;
  }

  createBtn.disabled = true;
  try {
    const fragmentKeyBytes = randomBytes(24);
    let fragmentKey = '';
    for (const b of fragmentKeyBytes) fragmentKey += String.fromCharCode(b);
    fragmentKey = btoa(fragmentKey).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const pin = randomPin();
    const { ciphertext, iv, salt } = await encryptSecret(secret, fragmentKey, pin);

    const res = await fetch('/api/secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ciphertext, iv, salt, ttl_seconds: ttl }),
    });
    if (!res.ok) throw new Error('create_failed');
    const { id } = await res.json();

    const link = `${location.origin}/s/${id}#key=${fragmentKey}`;
    linkOut.textContent = link;
    copyLinkBtn.classList.remove('hidden');
    pinOut.textContent = pin;
    pinOut.classList.remove('hidden');
    copyPinBtn.classList.remove('hidden');
    pinHint.classList.remove('hidden');
    note.textContent = t.createSuccess;
    note.className = 'note warn';

    secretInput.value = '';
  } catch {
    note.textContent = t.errCreateFailed;
    note.className = 'note err';
  } finally {
    createBtn.disabled = false;
  }
});
