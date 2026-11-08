import { pool, query } from '../lib/db';

const num = (v) => Number(v);
const mapPedido = (r) => ({
  ...r,
  valor_total: num(r.valor_total),
  taxa_entrega: num(r.taxa_entrega),
});

/** Executa `fn` dentro de uma transação. */
export async function transacao(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function inserirPedido(client, { id_cliente, forma_pagamento, valor_total, taxa_entrega }) {
  const { rows } = await client.query(
    `INSERT INTO pedido (id_cliente, status, forma_pagamento, valor_total, taxa_entrega)
     VALUES ($1, 'Recebido', $2, $3, $4) RETURNING *`,
    [id_cliente, forma_pagamento, valor_total, taxa_entrega]
  );
  return mapPedido(rows[0]);
}

export async function inserirItem(client, { id_pedido, id_produto, quantidade, preco_unitario, subtotal }) {
  await client.query(
    `INSERT INTO item_pedido (id_pedido, id_produto, quantidade, preco_unitario, subtotal)
     VALUES ($1, $2, $3, $4, $5)`,
    [id_pedido, id_produto, quantidade, preco_unitario, subtotal]
  );
}

async function itensDoPedido(id_pedido) {
  const { rows } = await query(
    `SELECT i.*, p.nome FROM item_pedido i
     JOIN produto p ON p.id_produto = i.id_produto
     WHERE i.id_pedido = $1 ORDER BY i.id_item`,
    [id_pedido]
  );
  return rows.map((r) => ({
    ...r,
    preco_unitario: num(r.preco_unitario),
    subtotal: num(r.subtotal),
  }));
}

export async function buscarPedido(id_pedido) {
  const { rows } = await query(
    `SELECT p.*, c.nome AS cliente_nome, c.endereco, c.telefone
     FROM pedido p JOIN cliente c ON c.id_cliente = p.id_cliente
     WHERE p.id_pedido = $1`,
    [id_pedido]
  );
  if (!rows[0]) return null;
  return { ...mapPedido(rows[0]), itens: await itensDoPedido(id_pedido) };
}

/** Lista do mais antigo para o mais recente (US05). */
export async function listarPedidos() {
  const { rows } = await query(
    `SELECT p.*, c.nome AS cliente_nome, c.endereco, c.telefone
     FROM pedido p JOIN cliente c ON c.id_cliente = p.id_cliente
     ORDER BY p.data_hora ASC, p.id_pedido ASC`
  );
  return Promise.all(
    rows.map(async (r) => ({ ...mapPedido(r), itens: await itensDoPedido(r.id_pedido) }))
  );
}

export async function atualizarStatus(id_pedido, status) {
  const { rows } = await query(
    'UPDATE pedido SET status = $1 WHERE id_pedido = $2 RETURNING *',
    [status, id_pedido]
  );
  return rows[0] ? mapPedido(rows[0]) : null;
}

