import { handleAttemptFailed, handleBurnSecret, handleCreateSecret, handleGetSecret } from './api/secrets';
import { cleanupExpired, type Env } from './db';

export type { Env };

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

// No external scripts/fonts on the secret-viewing/creation pages: an XSS bug must not be able
// to exfiltrate fragmentKey from the URL fragment via a third-party request.
const PAGE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

const ID_PATTERN = '[A-Za-z0-9_-]{1,64}';
const SECRET_PAGE_RE = new RegExp(`^/s/(${ID_PATTERN})$`);
const API_GET_RE = new RegExp(`^/api/secrets/(${ID_PATTERN})$`);
const API_BURN_RE = new RegExp(`^/api/secrets/(${ID_PATTERN})/burn$`);
const API_ATTEMPT_RE = new RegExp(`^/api/secrets/(${ID_PATTERN})/attempt-failed$`);

function withSecurityHeaders(res: Response, extra?: Record<string, string>): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
  if (extra) for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function servePage(env: Env, req: Request, assetPath: string): Promise<Response> {
  const assetUrl = new URL(req.url);
  assetUrl.pathname = assetPath;
  const res = await env.ASSETS.fetch(new Request(assetUrl.toString(), req));
  return withSecurityHeaders(res, { 'Content-Security-Policy': PAGE_CSP });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const { pathname } = url;

    if (pathname === '/') {
      return Response.redirect(new URL('/create', url).toString(), 302);
    }

    if (pathname === '/create') {
      // Deliberately extensionless: requesting the .html path directly makes the Assets
      // binding redirect to the clean URL instead of serving content.
      return servePage(env, req, '/create');
    }

    const secretPageMatch = pathname.match(SECRET_PAGE_RE);
    if (secretPageMatch) {
      return servePage(env, req, '/s');
    }

    if (pathname === '/api/secrets' && req.method === 'POST') {
      return withSecurityHeaders(await handleCreateSecret(req, env));
    }

    const getMatch = pathname.match(API_GET_RE);
    if (getMatch && req.method === 'GET') {
      return withSecurityHeaders(await handleGetSecret(getMatch[1], env));
    }

    const burnMatch = pathname.match(API_BURN_RE);
    if (burnMatch && req.method === 'POST') {
      return withSecurityHeaders(await handleBurnSecret(burnMatch[1], env));
    }

    const attemptMatch = pathname.match(API_ATTEMPT_RE);
    if (attemptMatch && req.method === 'POST') {
      return withSecurityHeaders(await handleAttemptFailed(attemptMatch[1], req, env));
    }

    // Static assets (css/js) fall through here; anything unmatched becomes ASSETS' own 404.
    const assetRes = await env.ASSETS.fetch(req);
    return withSecurityHeaders(assetRes);
  },

  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    await cleanupExpired(env);
  },
};
