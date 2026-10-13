const OWNER = 'lalakalak';
const REPO = 'Onmjson';
const BRANCH = 'main';
const FILE_PATH = 'onm.json';
const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_USERS = [
  { username: 'admin', role: 'admin', passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', active: true },
  { username: 'viewer', role: 'viewer', passwordHash: '65375049b9e4d7cad6c9ba286fdeb9394b28135a3e84136404cfccfdcc438894', active: true }
];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
function b64url(bytesOrString) {
  const bytes = typeof bytesOrString === 'string' ? new TextEncoder().encode(bytesOrString) : bytesOrString;
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromB64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function sha256Hex(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}
async function makeToken(username, secret) {
  const payload = { sub: username, role: 'admin', exp: Date.now() + TOKEN_TTL_MS };
  const part = b64url(JSON.stringify(payload));
  return { token: `${part}.${await sign(part, secret)}`, expiresAt: payload.exp };
}
async function verifyToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  if ((await sign(parts[0], secret)) !== parts[1]) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    if (payload.role !== 'admin' || !payload.sub || payload.exp <= Date.now()) return null;
    return payload;
  } catch { return null; }
}
async function githubRequest(env, method = 'GET', body) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${env.GH_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'OM-Shift-Manager'
  };
  if (body) headers['Content-Type'] = 'application/json';
  return fetch(API, { method, headers, body: body ? JSON.stringify(body) : undefined });
}
async function readRoster(env) {
  if (!env.GH_TOKEN) throw new Error('Cloudflare secret GH_TOKEN is not configured.');
  const response = await githubRequest(env);
  if (!response.ok) throw new Error(`GitHub read failed (${response.status}).`);
  const file = await response.json();
  const raw = Uint8Array.from(atob((file.content || '').replace(/\s/g, '')), c => c.charCodeAt(0));
  return { data: JSON.parse(new TextDecoder().decode(raw)), sha: file.sha };
}
async function writeRoster(env, data, sha) {
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const response = await githubRequest(env, 'PUT', {
    message: 'Update O&M Shift Manager roster',
    content: btoa(binary),
    sha,
    branch: BRANCH
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || `GitHub write failed (${response.status}).`);
  return result;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
    if (url.pathname === '/roster' && request.method === 'GET') {
      try {
        const { data } = await readRoster(env);
        return reply(data);
      } catch (e) { return reply({ success: false, error: e.message }, 502); }
    }
    if (url.pathname === '/auth/login' && request.method === 'POST') {
      try {
        if (!env.AUTH_SECRET) return reply({ success: false, error: 'Cloudflare secret AUTH_SECRET is not configured.' }, 500);
        const input = await request.json();
        const username = String(input.username || '').trim().toLowerCase();
        const password = String(input.password || '');
        if (!username || !password) return reply({ success: false, error: 'Username and password are required.' }, 400);
        const { data } = await readRoster(env);
        const user = (Array.isArray(data.users) && data.users.length ? data.users : DEFAULT_USERS).find(u => u.active !== false && String(u.username || '').toLowerCase() === username && u.role === 'admin');
        if (!user || !user.passwordHash || (await sha256Hex(password)) !== user.passwordHash) return reply({ success: false, error: 'Invalid admin username or password.' }, 401);
        const token = await makeToken(username, env.AUTH_SECRET);
        return reply({ success: true, ...token });
      } catch (e) { return reply({ success: false, error: e.message }, 500); }
    }
    if (url.pathname === '/roster' && request.method === 'PUT') {
      try {
        if (!env.AUTH_SECRET) return reply({ success: false, error: 'Cloudflare secret AUTH_SECRET is not configured.' }, 500);
        const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
        const auth = await verifyToken(token, env.AUTH_SECRET);
        if (!auth) return reply({ success: false, error: 'Admin session expired or invalid. Please sign in again.' }, 401);
        const { data: current, sha } = await readRoster(env);
        const user = (Array.isArray(current.users) && current.users.length ? current.users : DEFAULT_USERS).find(u => u.active !== false && String(u.username || '').toLowerCase() === auth.sub.toLowerCase() && u.role === 'admin');
        if (!user) return reply({ success: false, error: 'Admin account is no longer active.' }, 403);
        const incoming = await request.json();
        if (!incoming || !Array.isArray(incoming.employees) || !Array.isArray(incoming.roster) || !Array.isArray(incoming.leaves)) return reply({ success: false, error: 'Invalid O&M roster JSON.' }, 400);
        const result = await writeRoster(env, incoming, sha);
        return reply({ success: true, commit: result.commit?.sha || null });
      } catch (e) { return reply({ success: false, error: e.message }, 502); }
    }
    return reply({ success: false, error: 'Not found.' }, 404);
  }
};
