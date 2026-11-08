import * as Pedido from '../models/pedidoModel';
import * as Produto from '../models/produtoModel';
import * as Cliente from '../models/clienteModel';
import { HttpError, handleError, methodNotAllowed } from '../lib/http';
import { TAXA_ENTREGA, FORMAS_PAGAMENTO, proximoStatus, STATUS } from '../lib/config';
import { hashSenha, verificarSenha, isAdmin } from '../lib/auth';

const round2 = (n) => Math.round(n * 100) / 100;

function validarCheckout(body) {
  const { cliente, itens, forma_pagamento } = body || {};
  const campos = ['nome', 'telefone', 'usuario', 'senha', 'endereco'];
  if (!cliente || campos.some((c) => !String(cliente[c] || '').trim())) {
    throw new HttpError(400, 'Preencha todos os dados do cliente: nome, telefone, usuário, senha e endereço.');
  }
  if (!FORMAS_PAGAMENTO.some((f) => f.valor === forma_pagamento)) {
    throw new HttpError(400, 'Forma de pagamento inválida. Escolha Cartão ou PIX na entrega.');
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new HttpError(400, 'O carrinho está vazio.');
  }
  for (const i of itens) {
    if (!Number.isInteger(Number(i.id_produto)) || !Number.isInteger(Number(i.quantidade)) || Number(i.quantidade) <= 0) {
      throw new HttpError(400, 'Itens do carrinho inválidos.');
    }
  }
  return { cliente, itens, forma_pagamento };
}

/** Regra de negócio de criação de pedido (US03). Preços são sempre recalculados no servidor. */
export async function criarPedido(body) {
  const { cliente, itens, forma_pagamento } = validarCheckout(body);

  // Agrupa quantidades do mesmo produto
  const qtd = new Map();
  for (const i of itens) {
    const id = Number(i.id_produto);
    qtd.set(id, (qtd.get(id) || 0) + Number(i.quantidade));
  }

  return Pedido.transacao(async (client) => {
    // Cliente: reutiliza pelo usuário (com senha) ou cria um novo
    let cli = await Cliente.buscarPorUsuario(cliente.usuario.trim(), client);
    if (cli) {
      if (!verificarSenha(cliente.senha, cli.senha)) {
        throw new HttpError(401, 'Usuário já existe e a senha informada não confere.');
      }
      await Cliente.atualizarContato(client, cli.id_cliente, cliente);
    } else {
      cli = await Cliente.criarCliente(client, {
        ...cliente,
        usuario: cliente.usuario.trim(),
        senha: hashSenha(cliente.senha),
      });
    }

    const produtos = await Produto.buscarProdutosPorIds([...qtd.keys()], client);
    let soma = 0;
    const linhas = [];
    for (const [id, quantidade] of qtd) {
      const p = produtos.find((x) => x.id_produto === id);
      if (!p) throw new HttpError(404, `Produto ${id} não encontrado.`);
      if (p.quantidade_estoque < quantidade) {
        throw new HttpError(409, `Estoque insuficiente para "${p.nome}" (disponível: ${Math.max(p.quantidade_estoque, 0)}).`);
      }
      const subtotal = round2(p.preco * quantidade);
      soma += subtotal;
      linhas.push({ id_produto: id, quantidade, preco_unitario: p.preco, subtotal });
    }

    const pedido = await Pedido.inserirPedido(client, {
      id_cliente: cli.id_cliente,
      forma_pagamento,
      taxa_entrega: TAXA_ENTREGA,
      valor_total: round2(soma + TAXA_ENTREGA),
    });
    for (const l of linhas) {
      await Pedido.inserirItem(client, { ...l, id_pedido: pedido.id_pedido });
      await Produto.baixarEstoque(client, l.id_produto, l.quantidade);
    }
    return pedido;
  });
}

// POST /api/pedidos  (cliente) | GET /api/pedidos (admin)
export async function pedidosHandler(req, res) {
  try {
    if (req.method === 'POST') {
      const pedido = await criarPedido(req.body);
      return res.status(201).json(pedido);
    }
    if (req.method === 'GET') {
      if (!isAdmin(req)) throw new HttpError(401, 'Acesso restrito ao administrador.');
      return res.status(200).json(await Pedido.listarPedidos());
    }
    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /api/pedidos/:id (rastreamento) | PATCH /api/pedidos/:id (admin avança status)
export async function pedidoHandler(req, res) {
  try {
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Número de pedido inválido.');

    if (req.method === 'GET') {
      const pedido = await Pedido.buscarPedido(id);
      if (!pedido) throw new HttpError(404, 'Pedido não encontrado.');
      return res.status(200).json(pedido);
    }

    if (req.method === 'PATCH') {
      if (!isAdmin(req)) throw new HttpError(401, 'Acesso restrito ao administrador.');
      const { status } = req.body || {};
      if (!STATUS.includes(status)) throw new HttpError(400, 'Status inválido.');
      const atual = await Pedido.buscarPedido(id);
      if (!atual) throw new HttpError(404, 'Pedido não encontrado.');
      if (proximoStatus(atual.status) !== status) {
        throw new HttpError(409, `Transição inválida: "${atual.status}" → "${status}".`);
      }
      return res.status(200).json(await Pedido.atualizarStatus(id, status));
    }

    return methodNotAllowed(res, ['GET', 'PATCH']);
  } catch (err) {
    return handleError(res, err);
  }
}

