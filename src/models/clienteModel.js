import { query } from '../lib/db';

const CAMPOS_PUBLICOS = 'id_cliente, nome, telefone, usuario, endereco';

/** Retorna o registro completo (inclui hash da senha) — uso interno dos controllers. */
export async function buscarPorUsuario(usuario, client) {
  const runner = client || { query };
  const { rows } = await runner.query('SELECT * FROM cliente WHERE usuario = $1', [usuario]);
  return rows[0] || null;
}

/** Retorna o registro completo por id (inclui hash da senha) — uso interno. */
export async function buscarPorId(id_cliente) {
  const { rows } = await query('SELECT * FROM cliente WHERE id_cliente = $1', [id_cliente]);
  return rows[0] || null;
}

/** Dados seguros para enviar ao navegador (sem senha). */
export async function buscarPerfil(id_cliente) {
  const { rows } = await query(`SELECT ${CAMPOS_PUBLICOS} FROM cliente WHERE id_cliente = $1`, [id_cliente]);
  return rows[0] || null;
}

export async function criarCliente(client, { nome, telefone, usuario, senha, endereco }) {
  const { rows } = await client.query(
    `INSERT INTO cliente (nome, telefone, usuario, senha, endereco)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${CAMPOS_PUBLICOS}`,
    [nome, telefone, usuario, senha, endereco]
  );
  return rows[0];
}

/** Retorna true se o cliente existia. */
export async function atualizarContato(client, id_cliente, { nome, telefone, endereco }) {
  const { rowCount } = await client.query(
    'UPDATE cliente SET nome = $1, telefone = $2, endereco = $3 WHERE id_cliente = $4',
    [nome, telefone, endereco, id_cliente]
  );
  return rowCount > 0;
}

/** Grava um novo hash de senha. Retorna true se o cliente existia. */
export async function atualizarSenha(id_cliente, senhaHash) {
  const { rowCount } = await query('UPDATE cliente SET senha = $1 WHERE id_cliente = $2', [senhaHash, id_cliente]);
  return rowCount > 0;
}
