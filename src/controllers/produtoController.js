import * as Produto from '../models/produtoModel';
import { handleError, methodNotAllowed } from '../lib/http';

export async function produtosHandler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const produtos = await Produto.listarProdutos();
    return res.status(200).json(produtos);
  } catch (err) {
    return handleError(res, err);
  }
}

