export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface SecretRecord {
  id: string;
  ciphertext: string;
  iv: string;
  salt: string;
  created_at: number;
  expires_at: number;
  attempts: number;
  max_attempts: number;
}

const ALLOWED_TTL_SECONDS = new Set([300, 3600, 86400]);
export const MAX_CIPHERTEXT_B64_LENGTH = 200_000; // ~150KB decoded — generous for a text secret
export const MAX_IV_SALT_B64_LENGTH = 64;

export function isAllowedTtl(ttl: unknown): ttl is number {
  return typeof ttl === 'number' && ALLOWED_TTL_SECONDS.has(ttl);
}

export function isReasonableB64(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function generateId(): string {
  const bytes = new Uint8Array(16); // 128 bits of entropy, per spec
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function createSecret(
  env: Env,
  data: { ciphertext: string; iv: string; salt: string; ttl_seconds: number }
): Promise<string> {
  const id = generateId();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + data.ttl_seconds;
  await env.DB.prepare(
    `INSERT INTO secrets (id, ciphertext, iv, salt, created_at, expires_at, attempts, max_attempts)
     VALUES (?, ?, ?, ?, ?, ?, 0, 5)`
  )
    .bind(id, data.ciphertext, data.iv, data.salt, now, expiresAt)
    .run();
  return id;
}

export async function getSecret(env: Env, id: string): Promise<SecretRecord | null> {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT id, ciphertext, iv, salt, created_at, expires_at, attempts, max_attempts
     FROM secrets WHERE id = ? AND expires_at > ?`
  )
    .bind(id, now)
    .first<SecretRecord>();
  return row ?? null;
}

export async function deleteSecret(env: Env, id: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM secrets WHERE id = ?`).bind(id).run();
}

export async function registerFailedAttempt(
  env: Env,
  id: string
): Promise<{ deleted: boolean; attempts: number; maxAttempts: number } | null> {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT attempts, max_attempts FROM secrets WHERE id = ? AND expires_at > ?`
  )
    .bind(id, now)
    .first<{ attempts: number; max_attempts: number }>();
  if (!row) return null;

  const attempts = row.attempts + 1;
  if (attempts >= row.max_attempts) {
    await env.DB.prepare(`DELETE FROM secrets WHERE id = ?`).bind(id).run();
    return { deleted: true, attempts, maxAttempts: row.max_attempts };
  }
  await env.DB.prepare(`UPDATE secrets SET attempts = ? WHERE id = ?`).bind(attempts, id).run();
  return { deleted: false, attempts, maxAttempts: row.max_attempts };
}

export async function cleanupExpired(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(`DELETE FROM secrets WHERE expires_at <= ?`).bind(now).run();
  await env.DB.prepare(`DELETE FROM attempt_failed_log WHERE ts <= ?`).bind(now - 3600).run();
}
