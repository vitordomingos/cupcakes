import * as Cliente from '../models/clienteModel';
import * as Pedido from '../models/pedidoModel';
import * as Produto from '../models/produtoModel';
import { HttpError, handleError, methodNotAllowed } from '../lib/http';
import {
  getClienteId,
  cookieSessaoCliente,
  cookieLogoutCliente,
  verificarSenha,
  hashSenha,
  igualSeguro,
  normalizarTelefone,
  gerarTokenRecuperacao,
  lerTokenRecuperacao,
  tokenCorrespondeSenha,
} from '../lib/auth';

export const SENHA_MIN = 6;

const exigirLogin = (req) => {
  const id = getClienteId(req);
  if (!id) throw new HttpError(401, 'Faça login para continuar.');
  return id;
};

/* ======================= Sessão (login/logout/me) ======================= */

// POST /api/clientes/login { usuario, senha } | DELETE /api/clientes/login
export async function loginClienteHandler(req, res) {
  try {
    if (req.method === 'POST') {
      const usuario = String(req.body?.usuario || '').trim();
      const senha = String(req.body?.senha || '');
      if (!usuario || !senha) throw new HttpError(400, 'Informe usuário e senha.');

      const cliente = await Cliente.buscarPorUsuario(usuario);
      // Mensagem genérica: não revela se o usuário existe.
      if (!cliente || !verificarSenha(senha, cliente.senha)) {
        throw new HttpError(401, 'Usuário ou senha inválidos.');
      }
      const { senha: _omitida, ...perfil } = cliente;
      res.setHeader('Set-Cookie', cookieSessaoCliente(cliente.id_cliente));
      return res.status(200).json({ cliente: perfil });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', cookieLogoutCliente());
      return res.status(200).json({ ok: true });
    }
    return methodNotAllowed(res, ['POST', 'DELETE']);
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /api/clientes/me → { cliente } (null quando não logado)
export async function meHandler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const id = getClienteId(req);
    if (!id) return res.status(200).json({ cliente: null });
    const cliente = await Cliente.buscarPerfil(id);
    if (!cliente) res.setHeader('Set-Cookie', cookieLogoutCliente());
    return res.status(200).json({ cliente: cliente || null });
  } catch (err) {
    return handleError(res, err);
  }
}

/* ===================== Histórico e repetição ===================== */

// GET /api/clientes/pedidos → pedidos do cliente logado
export async function historicoHandler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const id = exigirLogin(req);
    return res.status(200).json(await Pedido.listarPedidosDoCliente(id));
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * Regra de negócio da repetição: todos os produtos precisam ter quantidade_estoque > 0.
 * Se algum estiver esgotado, bloqueia tudo e informa exatamente quais itens.
 * Quantidades maiores que o estoque atual são limitadas ao disponível (e informadas em `ajustados`).
 */
export async function repetirPedido(id_pedido, id_cliente) {
  const pedido = await Pedido.buscarPedidoDoCliente(id_pedido, id_cliente);
  if (!pedido) throw new HttpError(404, 'Pedido não encontrado no seu histórico.');
  if (!pedido.itens?.length) throw new HttpError(422, 'Este pedido não possui itens para repetir.');

  // Agrupa por produto (defensivo)
  const porProduto = new Map();
  for (const i of pedido.itens) {
    const atual = porProduto.get(i.id_produto);
    porProduto.set(i.id_produto, { nome: i.nome, quantidade: (atual?.quantidade || 0) + Number(i.quantidade) });
  }

  const produtos = await Produto.listarProdutosPorIds([...porProduto.keys()]);
  const esgotados = [];
  const ajustados = [];
  const itens = [];

  for (const [id_produto, { nome, quantidade }] of porProduto) {
    const p = produtos.find((x) => x.id_produto === id_produto);
    if (!p || p.quantidade_estoque <= 0) {
      esgotados.push(p?.nome || nome);
      continue;
    }
    const qtd = Math.min(quantidade, p.quantidade_estoque);
    if (qtd < quantidade) ajustados.push({ nome: p.nome, solicitado: quantidade, disponivel: qtd });
    itens.push({
      id_produto,
      nome: p.nome,
      preco: p.preco, // preço ATUAL do catálogo
      quantidade_estoque: p.quantidade_estoque,
      quantidade: qtd,
    });
  }

  if (esgotados.length) {
    throw new HttpError(
      409,
      `Não foi possível repetir o pedido. Itens esgotados: ${esgotados.join(', ')}.`,
      { esgotados }
    );
  }
  return { itens, ajustados };
}

// POST /api/clientes/pedidos/:id/repetir
export async function repetirPedidoHandler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const id_cliente = exigirLogin(req);
    const id_pedido = Number(req.query.id);
    if (!Number.isInteger(id_pedido) || id_pedido <= 0) throw new HttpError(400, 'Número de pedido inválido.');
    return res.status(200).json(await repetirPedido(id_pedido, id_cliente));
  } catch (err) {
    return handleError(res, err);
  }
}

/* ===================== Recuperação de senha ===================== */

// Limite simples de tentativas (memória do processo) contra força bruta no telefone.
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map();

const chaveTentativa = (usuario) => usuario.toLowerCase();

function bloqueado(usuario, agora = Date.now()) {
  const t = tentativas.get(chaveTentativa(usuario));
  if (!t) return false;
  if (agora - t.inicio > JANELA_MS) {
    tentativas.delete(chaveTentativa(usuario));
    return false;
  }
  return t.falhas >= MAX_TENTATIVAS;
}

function registrarFalha(usuario, agora = Date.now()) {
  const k = chaveTentativa(usuario);
  const t = tentativas.get(k);
  if (!t || agora - t.inicio > JANELA_MS) tentativas.set(k, { falhas: 1, inicio: agora });
  else t.falhas += 1;
}

/** Uso exclusivo em testes. */
export const _resetTentativas = () => tentativas.clear();

/**
 * Etapa 1+2: valida usuário + telefone EXATO cadastrado (comparando apenas dígitos).
 * Só devolve o token de redefinição se ambos baterem.
 */
export async function verificarIdentidade({ usuario, telefone }) {
  const u = String(usuario || '').trim();
  const tel = normalizarTelefone(telefone);
  if (!u || !tel) throw new HttpError(400, 'Informe o usuário e o telefone cadastrado.');
  if (bloqueado(u)) {
    throw new HttpError(429, 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  }

  const cliente = await Cliente.buscarPorUsuario(u);
  const telCadastrado = normalizarTelefone(cliente?.telefone);
  // Mesma resposta para "usuário inexistente" e "telefone errado" (não revela contas).
  if (!cliente || !telCadastrado || !igualSeguro(tel, telCadastrado)) {
    registrarFalha(u);
    throw new HttpError(401, 'Os dados informados não conferem com nenhuma conta.');
  }

  tentativas.delete(chaveTentativa(u));
  return { token: gerarTokenRecuperacao(cliente.id_cliente, cliente.senha) };
}

/** Etapa 3: grava a nova senha, desde que o token seja válido, não expirado e não usado. */
export async function redefinirSenha({ token, nova_senha, confirmacao }) {
  const dados = lerTokenRecuperacao(token);
  if (!dados) throw new HttpError(401, 'Link de redefinição inválido ou expirado. Recomece o processo.');

  const senha = String(nova_senha || '');
  if (senha.length < SENHA_MIN) throw new HttpError(400, `A nova senha deve ter pelo menos ${SENHA_MIN} caracteres.`);
  if (senha !== String(confirmacao || '')) throw new HttpError(400, 'A confirmação não confere com a nova senha.');

  const cliente = await Cliente.buscarPorId(dados.id);
  if (!cliente || !tokenCorrespondeSenha(dados, cliente.senha)) {
    throw new HttpError(401, 'Link de redefinição inválido ou já utilizado. Recomece o processo.');
  }
  if (verificarSenha(senha, cliente.senha)) {
    throw new HttpError(400, 'A nova senha deve ser diferente da senha atual.');
  }

  await Cliente.atualizarSenha(cliente.id_cliente, hashSenha(senha));
  return { ok: true };
}

// POST /api/clientes/recuperar-senha { usuario, telefone } → { token }
export async function recuperarSenhaHandler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    return res.status(200).json(await verificarIdentidade(req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
}

// POST /api/clientes/redefinir-senha { token, nova_senha, confirmacao }
export async function redefinirSenhaHandler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    return res.status(200).json(await redefinirSenha(req.body || {}));
  } catch (err) {
    return handleError(res, err);
  }
}

