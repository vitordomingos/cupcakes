import crypto from 'crypto';

export const ADMIN_COOKIE = 'admin_token';

export function adminToken() {
  const senha = process.env.ADMIN_PASSWORD || 'admin123';
  return crypto.createHmac('sha256', senha).update('cupcakes-admin').digest('hex');
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((c) => c.trim().split('='))
      .filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])
  );
}

export function isAdmin(req) {
  return parseCookies(req.headers?.cookie)[ADMIN_COOKIE] === adminToken();
}

export function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(senha, salt, 32).toString('hex')}`;
}

export function verificarSenha(senha, hash) {
  const [salt, key] = String(hash).split(':');
  if (!salt || !key) return false;
  const calc = crypto.scryptSync(senha, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(key));
}

