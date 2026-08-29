import {
  createSecret,
  deleteSecret,
  getSecret,
  isAllowedTtl,
  isReasonableB64,
  MAX_CIPHERTEXT_B64_LENGTH,
  MAX_IV_SALT_B64_LENGTH,
  registerFailedAttempt,
  type Env,
} from '../db';
import { checkAndRecordRateLimit } from '../ratelimit';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getClientIp(req: Request): string {
  return req.headers.get('CF-Connecting-IP') ?? 'unknown';
}

export async function handleCreateSecret(req: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { ciphertext, iv, salt, ttl_seconds } = (body ?? {}) as Record<string, unknown>;

  if (!isReasonableB64(ciphertext, MAX_CIPHERTEXT_B64_LENGTH)) return json({ error: 'invalid_ciphertext' }, 400);
  if (!isReasonableB64(iv, MAX_IV_SALT_B64_LENGTH)) return json({ error: 'invalid_iv' }, 400);
  if (!isReasonableB64(salt, MAX_IV_SALT_B64_LENGTH)) return json({ error: 'invalid_salt' }, 400);
  if (!isAllowedTtl(ttl_seconds)) return json({ error: 'invalid_ttl' }, 400);

  const id = await createSecret(env, { ciphertext, iv, salt, ttl_seconds });
  return json({ id }, 201);
}

export async function handleGetSecret(id: string, env: Env): Promise<Response> {
  const record = await getSecret(env, id);
  if (!record) return json({ error: 'not_found' }, 404);
  return json({ ciphertext: record.ciphertext, iv: record.iv, salt: record.salt });
}

export async function handleBurnSecret(id: string, env: Env): Promise<Response> {
  await deleteSecret(env, id);
  return new Response(null, { status: 204 });
}

export async function handleAttemptFailed(id: string, req: Request, env: Env): Promise<Response> {
  const ip = getClientIp(req);
  const allowed = await checkAndRecordRateLimit(env, ip);
  if (!allowed) return json({ error: 'rate_limited' }, 429);

  const result = await registerFailedAttempt(env, id);
  if (!result) return json({ error: 'not_found' }, 404);
  return json({ attempts: result.attempts, max_attempts: result.maxAttempts, deleted: result.deleted });
}
