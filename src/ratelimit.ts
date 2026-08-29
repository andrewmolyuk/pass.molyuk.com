import type { Env } from './db';

const WINDOW_SECONDS = 60;
const MAX_ATTEMPTS_PER_WINDOW = 20;

/**
 * Global per-IP rate limit for POST /api/secrets/:id/attempt-failed, independent of the
 * 5-attempts-per-link limit. Protects against brute-forcing PINs across many links at once.
 */
export async function checkAndRecordRateLimit(env: Env, ip: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - WINDOW_SECONDS;

  await env.DB.prepare(`DELETE FROM attempt_failed_log WHERE ip = ? AND ts < ?`)
    .bind(ip, windowStart)
    .run();

  const row = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM attempt_failed_log WHERE ip = ? AND ts >= ?`
  )
    .bind(ip, windowStart)
    .first<{ cnt: number }>();

  if (row && row.cnt >= MAX_ATTEMPTS_PER_WINDOW) {
    return false;
  }

  await env.DB.prepare(`INSERT INTO attempt_failed_log (ip, ts) VALUES (?, ?)`).bind(ip, now).run();
  return true;
}
