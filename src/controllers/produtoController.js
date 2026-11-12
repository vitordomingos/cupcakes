import * as Produto from '../models/produtoModel';
import { HttpError, handleError, methodNotAllowed } from '../lib/http';
import { isAdmin } from '../lib/auth';

function exigirAdmin(req) {
  if (!isAdmin(req)) throw new HttpError(401, 'Acesso restrito ao administrador.');
}

function validarNovoProduto(body) {
  const nome = String(body?.nome || '').trim();
  const descricao = String(body?.descricao || '').trim();
  const preco = Number(body?.preco);
  const quantidade_estoque = Number(body?.quantidade_estoque ?? 0);

  if (!nome) throw new HttpError(400, 'Informe o nome do sabor.');
  if (!Number.isFinite(preco) || preco < 0) throw new HttpError(400, 'Informe um preço válido.');
  if (!Number.isInteger(quantidade_estoque) || quantidade_estoque < 0) {
    throw new HttpError(400, 'A quantidade em estoque deve ser um inteiro maior ou igual a zero.');
  }
  return { nome, descricao, preco: Math.round(preco * 100) / 100, quantidade_estoque };
}

// GET /api/produtos (vitrine: apenas ativo = true; ?todos=1 para admin) | POST /api/produtos (admin: novo sabor)
export async function produtosHandler(req, res) {
  try {
    if (req.method === 'GET') {
      if (req.query?.todos === '1') {
        exigirAdmin(req);
        return res.status(200).json(await Produto.listarTodosProdutos());
      }
      return res.status(200).json(await Produto.listarProdutos());
    }

    if (req.method === 'POST') {
      exigirAdmin(req);
      const dados = validarNovoProduto(req.body);
      const criado = await Produto.criarProduto(dados);
      return res.status(201).json(criado);
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err) {
    return handleError(res, err);
  }
}

// PATCH /api/produtos/:id (admin: atualiza quantidade_estoque ou ativo via Soft Delete; NUNCA DELETE)
export async function produtoAdminHandler(req, res) {
  try {
    if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);
    exigirAdmin(req);

    const id = Number(req.query?.id);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'ID de produto inválido.');

    const body = req.body || {};
    const temEstoque = body.quantidade_estoque !== undefined;
    const temAtivo = body.ativo !== undefined;

    if (!temEstoque && !temAtivo) {
      throw new HttpError(400, 'Informe quantidade_estoque ou ativo para atualizar.');
    }

    let atualizado = null;

    if (temEstoque) {
      const qtd = Number(body.quantidade_estoque);
      if (!Number.isInteger(qtd) || qtd < 0) {
        throw new HttpError(400, 'A quantidade em estoque deve ser um inteiro maior ou igual a zero.');
      }
      atualizado = await Produto.atualizarEstoque(id, qtd);
      if (!atualizado) throw new HttpError(404, 'Produto não encontrado.');
    }

    if (temAtivo) {
      if (typeof body.ativo !== 'boolean') {
        throw new HttpError(400, 'O campo ativo deve ser booleano (true ou false).');
      }
      atualizado = await Produto.definirAtivo(id, body.ativo);
      if (!atualizado) throw new HttpError(404, 'Produto não encontrado.');
    }

    return res.status(200).json(atualizado);
  } catch (err) {
    return handleError(res, err);
  }
}
