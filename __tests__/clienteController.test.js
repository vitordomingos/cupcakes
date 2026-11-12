/**
 * Testes de API (Controller) – Jest + Supertest.
 * Foco: validação de estoque na repetição de pedido e segurança da recuperação de senha.
 * Os Models são mockados (sem banco real); a criptografia/assinatura é REAL.
 */
import request from 'supertest';
import { createServer } from './helpers/server';
import {
  repetirPedidoHandler,
  recuperarSenhaHandler,
  redefinirSenhaHandler,
  _resetTentativas,
} from '../src/controllers/clienteController';
import * as Pedido from '../src/models/pedidoModel';
import * as Produto from '../src/models/produtoModel';
import * as Cliente from '../src/models/clienteModel';
import { clienteToken, hashSenha, verificarSenha, gerarTokenRecuperacao } from '../src/lib/auth';

jest.mock('../src/lib/db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('../src/models/pedidoModel');
jest.mock('../src/models/produtoModel');
jest.mock('../src/models/clienteModel');

const cookie = (id = 7) => `cliente_token=${clienteToken(id)}`;
const repetir = (id = '10') => request(createServer(repetirPedidoHandler, { id }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  _resetTentativas();
});

/* ====================== Repetir Pedido: estoque ====================== */

describe('POST /api/clientes/pedidos/:id/repetir', () => {
  const pedidoAntigo = {
    id_pedido: 10,
    id_cliente: 7,
    itens: [
      { id_item: 1, id_produto: 1, nome: 'Red Velvet', quantidade: 2 },
      { id_item: 2, id_produto: 4, nome: 'Doce de Leite', quantidade: 1 },
      { id_item: 3, id_produto: 6, nome: 'Pistache', quantidade: 3 },
    ],
  };

  beforeEach(() => {
    Pedido.buscarPedidoDoCliente.mockResolvedValue(pedidoAntigo);
  });

  it('exige login (401) e não consulta o banco', async () => {
    const res = await repetir().post('/');
    expect(res.status).toBe(401);
    expect(Pedido.buscarPedidoDoCliente).not.toHaveBeenCalled();
  });

  it('rejeita cookie de sessão forjado', async () => {
    const forjado = `cliente_token=7.${clienteToken(8).split('.')[1]}`;
    const res = await repetir().post('/').set('Cookie', forjado);
    expect(res.status).toBe(401);
  });

  it('retorna 404 para pedido que não pertence ao cliente logado', async () => {
    Pedido.buscarPedidoDoCliente.mockResolvedValue(null);
    const res = await repetir().post('/').set('Cookie', cookie(7));
    expect(res.status).toBe(404);
    expect(Pedido.buscarPedidoDoCliente).toHaveBeenCalledWith(10, 7);
  });

  it('com estoque > 0 em todos: devolve itens com preço atual', async () => {
    Produto.listarProdutosPorIds.mockResolvedValue([
      { id_produto: 1, nome: 'Red Velvet', preco: 13.5, quantidade_estoque: 20 },
      { id_produto: 4, nome: 'Doce de Leite', preco: 12.5, quantidade_estoque: 5 },
      { id_produto: 6, nome: 'Pistache', preco: 15.9, quantidade_estoque: 9 },
    ]);
    const res = await repetir().post('/').set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.itens).toEqual([
      { id_produto: 1, nome: 'Red Velvet', preco: 13.5, quantidade_estoque: 20, quantidade: 2 },
      { id_produto: 4, nome: 'Doce de Leite', preco: 12.5, quantidade_estoque: 5, quantidade: 1 },
      { id_produto: 6, nome: 'Pistache', preco: 15.9, quantidade_estoque: 9, quantidade: 3 },
    ]);
    expect(res.body.ajustados).toEqual([]);
  });

  it('limita a quantidade ao estoque disponível e informa o ajuste', async () => {
    Produto.listarProdutosPorIds.mockResolvedValue([
      { id_produto: 1, nome: 'Red Velvet', preco: 12.9, quantidade_estoque: 1 },
      { id_produto: 4, nome: 'Doce de Leite', preco: 12.5, quantidade_estoque: 5 },
      { id_produto: 6, nome: 'Pistache', preco: 15.9, quantidade_estoque: 9 },
    ]);
    const res = await repetir().post('/').set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(res.body.itens[0].quantidade).toBe(1);
    expect(res.body.ajustados).toEqual([{ nome: 'Red Velvet', solicitado: 2, disponivel: 1 }]);
  });

  it('bloqueia (409) e lista EXATAMENTE os itens esgotados (estoque 0 ou negativo)', async () => {
    Produto.listarProdutosPorIds.mockResolvedValue([
      { id_produto: 1, nome: 'Red Velvet', preco: 12.9, quantidade_estoque: 10 },
      { id_produto: 4, nome: 'Doce de Leite', preco: 12.5, quantidade_estoque: 0 },
      { id_produto: 6, nome: 'Pistache', preco: 15.9, quantidade_estoque: -2 },
    ]);
    const res = await repetir().post('/').set('Cookie', cookie());
    expect(res.status).toBe(409);
    expect(res.body.esgotados).toEqual(['Doce de Leite', 'Pistache']);
    expect(res.body.erro).toBe('Não foi possível repetir o pedido. Itens esgotados: Doce de Leite, Pistache.');
    expect(res.body.itens).toBeUndefined(); // nada é liberado para o carrinho
  });

  it('trata produto ausente do catálogo como esgotado', async () => {
    Produto.listarProdutosPorIds.mockResolvedValue([
      { id_produto: 1, nome: 'Red Velvet', preco: 12.9, quantidade_estoque: 10 },
      { id_produto: 4, nome: 'Doce de Leite', preco: 12.5, quantidade_estoque: 3 },
    ]);
    const res = await repetir().post('/').set('Cookie', cookie());
    expect(res.status).toBe(409);
    expect(res.body.esgotados).toEqual(['Pistache']);
  });

  it('retorna 500 amigável se o banco falhar', async () => {
    Produto.listarProdutosPorIds.mockRejectedValue(new Error('timeout'));
    const res = await repetir().post('/').set('Cookie', cookie());
    expect(res.status).toBe(500);
    expect(res.body.erro).toMatch(/erro interno/i);
  });
});

/* ================= Recuperação de senha: segurança ================= */

describe('Recuperação de senha', () => {
  const SENHA_ATUAL = 'senhaAntiga1';
  let cliente;

  const recuperar = (body) => request(createServer(recuperarSenhaHandler)).post('/').send(body);
  const redefinir = (body) => request(createServer(redefinirSenhaHandler)).post('/').send(body);
  const MSG_GENERICA = 'Os dados informados não conferem com nenhuma conta.';

  beforeEach(() => {
    cliente = { id_cliente: 7, usuario: 'ana', telefone: '(11) 98765-4321', senha: hashSenha(SENHA_ATUAL) };
    Cliente.buscarPorUsuario.mockImplementation(async (u) => (u === 'ana' ? cliente : null));
    Cliente.buscarPorId.mockImplementation(async (id) => (id === 7 ? cliente : null));
    Cliente.atualizarSenha.mockResolvedValue(true);
  });

  it('libera token quando usuário e telefone conferem (formatação ignorada)', async () => {
    const res = await recuperar({ usuario: 'ana', telefone: '11987654321' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('nega telefone incorreto sem liberar token', async () => {
    const res = await recuperar({ usuario: 'ana', telefone: '11987654320' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: MSG_GENERICA });
  });

  it('nega telefone parcial (apenas os últimos dígitos)', async () => {
    const res = await recuperar({ usuario: 'ana', telefone: '987654321' });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('usuário inexistente recebe a MESMA resposta (não revela contas)', async () => {
    const res = await recuperar({ usuario: 'naoexiste', telefone: '11987654321' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: MSG_GENERICA });
  });

  it('exige usuário e telefone (400)', async () => {
    expect((await recuperar({ usuario: 'ana' })).status).toBe(400);
    expect((await recuperar({ telefone: '11987654321' })).status).toBe(400);
  });

  it('bloqueia (429) após 5 tentativas erradas, mesmo com o telefone correto', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await recuperar({ usuario: 'ana', telefone: '000' })).status).toBe(401);
    }
    const res = await recuperar({ usuario: 'ana', telefone: '11987654321' });
    expect(res.status).toBe(429);
    expect(res.body.token).toBeUndefined();
  });

  it('fluxo completo: grava a nova senha com hash', async () => {
    const { body } = await recuperar({ usuario: 'ana', telefone: '(11) 98765-4321' });
    const res = await redefinir({ token: body.token, nova_senha: 'novaSenha9', confirmacao: 'novaSenha9' });
    expect(res.status).toBe(200);
    expect(Cliente.atualizarSenha).toHaveBeenCalledTimes(1);
    const [id, hashGravado] = Cliente.atualizarSenha.mock.calls[0];
    expect(id).toBe(7);
    expect(hashGravado).not.toContain('novaSenha9');
    expect(verificarSenha('novaSenha9', hashGravado)).toBe(true);
  });

  it('rejeita redefinição sem passar pela verificação do telefone (sem token)', async () => {
    const res = await redefinir({ nova_senha: 'novaSenha9', confirmacao: 'novaSenha9' });
    expect(res.status).toBe(401);
    expect(Cliente.atualizarSenha).not.toHaveBeenCalled();
  });

  it('rejeita token adulterado (ex.: trocar o id do cliente)', async () => {
    const { body } = await recuperar({ usuario: 'ana', telefone: '11987654321' });
    const [payload, assinatura] = body.token.split('.');
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString());
    const payloadFalso = Buffer.from(JSON.stringify({ ...dados, id: 8 })).toString('base64url');
    const res = await redefinir({ token: `${payloadFalso}.${assinatura}`, nova_senha: 'novaSenha9', confirmacao: 'novaSenha9' });
    expect(res.status).toBe(401);
    expect(Cliente.atualizarSenha).not.toHaveBeenCalled();
  });

  it('rejeita token expirado (mais de 10 minutos)', async () => {
    const token = gerarTokenRecuperacao(7, cliente.senha, Date.now() - 11 * 60 * 1000);
    const res = await redefinir({ token, nova_senha: 'novaSenha9', confirmacao: 'novaSenha9' });
    expect(res.status).toBe(401);
    expect(Cliente.atualizarSenha).not.toHaveBeenCalled();
  });

  it('token é de uso único: falha depois que a senha já foi trocada', async () => {
    const { body } = await recuperar({ usuario: 'ana', telefone: '11987654321' });
    expect((await redefinir({ token: body.token, nova_senha: 'novaSenha9', confirmacao: 'novaSenha9' })).status).toBe(200);
    cliente.senha = Cliente.atualizarSenha.mock.calls[0][1]; // simula o banco atualizado
    const res = await redefinir({ token: body.token, nova_senha: 'outraSenha7', confirmacao: 'outraSenha7' });
    expect(res.status).toBe(401);
    expect(Cliente.atualizarSenha).toHaveBeenCalledTimes(1);
  });

  it('valida tamanho mínimo e confirmação da nova senha', async () => {
    const { body } = await recuperar({ usuario: 'ana', telefone: '11987654321' });
    expect((await redefinir({ token: body.token, nova_senha: '123', confirmacao: '123' })).status).toBe(400);
    expect((await redefinir({ token: body.token, nova_senha: 'novaSenha9', confirmacao: 'diferente9' })).status).toBe(400);
    expect(Cliente.atualizarSenha).not.toHaveBeenCalled();
  });
});

