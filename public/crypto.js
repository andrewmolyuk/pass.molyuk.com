// Same crypto scheme as the secret-relay-family.html prototype: PBKDF2(fragmentKey + PIN) -> AES-256-GCM.
// Everything here runs client-side only; the server never sees plaintext, key material, or PIN.

export function randomBytes(len) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return a;
}

export function randomPin() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}

export function bufToB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function b64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function deriveKey(fragmentKeyB64, pin, saltBuf) {
  const material = fragmentKeyB64 + '|' + pin.trim();
  const enc = new TextEncoder().encode(material);
  const baseKey = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations: 210000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptSecret(plainText, fragmentKeyB64, pin) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(fragmentKeyB64, pin, salt);
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plainText)
  );
  return {
    ciphertext: bufToB64(ciphertextBuf),
    iv: bufToB64(iv),
    salt: bufToB64(salt),
  };
}

export async function decryptSecret({ ciphertext, iv, salt }, fragmentKeyB64, pin) {
  const key = await deriveKey(fragmentKeyB64, pin, b64ToBuf(salt));
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(iv) }, key, b64ToBuf(ciphertext));
  return new TextDecoder().decode(plainBuf);
}
