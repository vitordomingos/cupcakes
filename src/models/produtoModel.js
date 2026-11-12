import { query } from '../lib/db';

const mapProduto = (r) => ({
  ...r,
  preco: Number(r.preco),
  quantidade_estoque: Number(r.quantidade_estoque),
});

export async function listarProdutos() {
  const { rows } = await query('SELECT * FROM produto ORDER BY id_produto');
  return rows.map(mapProduto);
}

/** Consulta simples (sem lock) — usada para checar estoque na repetição de pedido. */
export async function listarProdutosPorIds(ids) {
  const { rows } = await query(
    'SELECT * FROM produto WHERE id_produto = ANY($1::int[]) ORDER BY id_produto',
    [ids]
  );
  return rows.map(mapProduto);
}

/** Consulta com lock (FOR UPDATE) — usar dentro de transação ao criar pedido. */
export async function buscarProdutosPorIds(ids, client) {
  const runner = client || { query };
  const { rows } = await runner.query(
    'SELECT * FROM produto WHERE id_produto = ANY($1::int[]) FOR UPDATE',
    [ids]
  );
  return rows.map(mapProduto);
}

export async function baixarEstoque(client, id_produto, quantidade) {
  await client.query(
    'UPDATE produto SET quantidade_estoque = quantidade_estoque - $1 WHERE id_produto = $2',
    [quantidade, id_produto]
  );
}

