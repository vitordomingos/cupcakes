import { query } from '../lib/db';

const mapProduto = (r) => ({
  ...r,
  preco: Number(r.preco),
  quantidade_estoque: Number(r.quantidade_estoque),
});

/** Vitrine: somente produtos ativos (soft delete). */
export async function listarProdutos() {
  const { rows } = await query('SELECT * FROM produto WHERE ativo = TRUE ORDER BY id_produto');
  return rows.map(mapProduto);
}

/** Admin: todos os produtos, ativos e desativados. */
export async function listarTodosProdutos() {
  const { rows } = await query('SELECT * FROM produto ORDER BY ativo DESC, id_produto');
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

export async function criarProduto({ nome, descricao, preco, quantidade_estoque }) {
  const { rows } = await query(
    `INSERT INTO produto (nome, descricao, preco, quantidade_estoque, ativo)
     VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
    [nome, descricao, preco, quantidade_estoque]
  );
  return mapProduto(rows[0]);
}

/** Define o estoque (valor absoluto). Retorna o produto ou null se não existir. */
export async function atualizarEstoque(id_produto, quantidade_estoque) {
  const { rows } = await query(
    'UPDATE produto SET quantidade_estoque = $1 WHERE id_produto = $2 RETURNING *',
    [quantidade_estoque, id_produto]
  );
  return rows[0] ? mapProduto(rows[0]) : null;
}

/** Soft delete / reativação: apenas altera a flag `ativo`. Nunca remove a linha. */
export async function definirAtivo(id_produto, ativo) {
  const { rows } = await query('UPDATE produto SET ativo = $1 WHERE id_produto = $2 RETURNING *', [
    ativo,
    id_produto,
  ]);
  return rows[0] ? mapProduto(rows[0]) : null;
}

