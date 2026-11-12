import crypto from 'crypto';

export const ADMIN_COOKIE = 'admin_token';
export const CLIENTE_COOKIE = 'cliente_token';
const SESSAO_CLIENTE_SEGUNDOS = 60 * 60 * 8; // 8h
const TOKEN_RECUPERACAO_MS = 10 * 60 * 1000; // 10 min

const segredo = () => process.env.SESSION_SECRET || 'cupcakes-dev-secret-troque-em-producao';
const hmac = (valor) => crypto.createHmac('sha256', segredo()).update(String(valor)).digest('hex');

/** Comparação em tempo constante que não lança erro para tamanhos diferentes. */
export function igualSeguro(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/* ---------------------------- Admin ---------------------------- */

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

/* --------------------------- Cliente --------------------------- */

/** Token de sessão assinado: "<id_cliente>.<hmac>". */
export function clienteToken(id_cliente) {
  return `${id_cliente}.${hmac(`cliente:${id_cliente}`)}`;
}

/** Retorna o id_cliente da sessão (cookie assinado) ou null. */
export function getClienteId(req) {
  const token = parseCookies(req.headers?.cookie)[CLIENTE_COOKIE];
  if (!token) return null;
  const [id, assinatura] = token.split('.');
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0 || !assinatura) return null;
  return igualSeguro(assinatura, hmac(`cliente:${idNum}`)) ? idNum : null;
}

export const cookieSessaoCliente = (id_cliente) =>
  `${CLIENTE_COOKIE}=${clienteToken(id_cliente)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSAO_CLIENTE_SEGUNDOS}`;

export const cookieLogoutCliente = () => `${CLIENTE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/* --------------------------- Senhas ---------------------------- */

export function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(String(senha), salt, 32).toString('hex')}`;
}

export function verificarSenha(senha, hash) {
  const [salt, key] = String(hash || '').split(':');
  if (!salt || !key) return false;
  const calc = crypto.scryptSync(String(senha), salt, 32).toString('hex');
  return igualSeguro(calc, key);
}

/* ------------------ Recuperação de senha ----------------------- */

/** Mantém só os dígitos, para comparar "(11) 99999-0000" com "11999990000". */
export const normalizarTelefone = (tel) => String(tel || '').replace(/\D/g, '');

// Impressão digital do hash atual: muda quando a senha muda → token de uso único.
const digitalSenha = (hashAtual) => hmac(`senha:${hashAtual}`).slice(0, 16);

/** Gera token de redefinição assinado, com expiração e vínculo ao hash atual da senha. */
export function gerarTokenRecuperacao(id_cliente, hashAtual, agora = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ id: id_cliente, exp: agora + TOKEN_RECUPERACAO_MS, d: digitalSenha(hashAtual) })
  ).toString('base64url');
  return `${payload}.${hmac(`reset:${payload}`)}`;
}

/** Lê o token sem consultar o banco. Retorna { id, exp, d } ou null se inválido/expirado. */
export function lerTokenRecuperacao(token, agora = Date.now()) {
  const [payload, assinatura] = String(token || '').split('.');
  if (!payload || !assinatura || !igualSeguro(assinatura, hmac(`reset:${payload}`))) return null;
  try {
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(dados.id) || typeof dados.exp !== 'number' || dados.exp < agora) return null;
    return dados;
  } catch {
    return null;
  }
}

/** Confere se o token ainda corresponde à senha atual (falha se a senha já foi trocada). */
export const tokenCorrespondeSenha = (dados, hashAtual) => igualSeguro(dados.d, digitalSenha(hashAtual));
