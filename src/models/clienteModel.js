import { query } from '../lib/db';

export async function buscarPorUsuario(usuario, client) {
  const runner = client || { query };
  const { rows } = await runner.query('SELECT * FROM cliente WHERE usuario = $1', [usuario]);
  return rows[0] || null;
}

export async function criarCliente(client, { nome, telefone, usuario, senha, endereco }) {
  const { rows } = await client.query(
    `INSERT INTO cliente (nome, telefone, usuario, senha, endereco)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_cliente, nome, telefone, usuario, endereco`,
    [nome, telefone, usuario, senha, endereco]
  );
  return rows[0];
}

export async function atualizarContato(client, id_cliente, { nome, telefone, endereco }) {
  await client.query(
    'UPDATE cliente SET nome = $1, telefone = $2, endereco = $3 WHERE id_cliente = $4',
    [nome, telefone, endereco, id_cliente]
  );
}

