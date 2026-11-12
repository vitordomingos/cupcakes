/**
 * Testes de API (Controller) com Jest + Supertest. Os Models são mockados (sem BD real).
 */
import request from 'supertest';
import { createServer } from './helpers/server';
import { pedidosHandler, pedidoHandler } from '../src/controllers/pedidoController';
import { produtosHandler, produtoAdminHandler } from '../src/controllers/produtoController';
import * as Pedido from '../src/models/pedidoModel';
import * as Produto from '../src/models/produtoModel';
import * as Cliente from '../src/models/clienteModel';
import { adminToken } from '../src/lib/auth';

jest.mock('../src/lib/db', () => ({ query: jest.fn(), pool: {} }));
jest.mock('../src/models/pedidoModel');
jest.mock('../src/models/produtoModel');
jest.mock('../src/models/clienteModel');

const fakeClient = {};
const adminCookie = () => `admin_token=${adminToken()}`;

const body = {
  cliente: { nome: 'Ana', telefone: '1199999', usuario: 'ana', senha: '123', endereco: 'Rua A, 1' },
  forma_pagamento: 'Pix na entrega',
  itens: [{ id_produto: 1, quantidade: 2 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  Pedido.transacao.mockImplementation((fn) => fn(fakeClient));
  Cliente.buscarPorUsuario.mockResolvedValue(null);
  Cliente.criarCliente.mockResolvedValue({ id_cliente: 7 });
  Produto.buscarProdutosPorIds.mockResolvedValue([
    { id_produto: 1, nome: 'Red Velvet', preco: 10, quantidade_estoque: 5 },
  ]);
  Pedido.inserirPedido.mockImplementation(async (_c, d) => ({ id_pedido: 1, status: 'Recebido', ...d }));
});

describe('GET /api/produtos', () => {
  it('retorna a lista de produtos', async () => {
    Produto.listarProdutos.mockResolvedValue([{ id_produto: 1, nome: 'X' }]);
    const res = await request(createServer(produtosHandler)).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('retorna 500 amigável quando o banco falha', async () => {
    Produto.listarProdutos.mockRejectedValue(new Error('conexão recusada'));
    const res = await request(createServer(produtosHandler)).get('/');
    expect(res.status).toBe(500);
    expect(res.body.erro).toMatch(/erro interno/i);
  });
});

describe('POST /api/pedidos', () => {
  it('cria pedido com status Recebido e total = itens + taxa', async () => {
    const res = await request(createServer(pedidosHandler)).post('/').send(body);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Recebido');
    expect(res.body.valor_total).toBe(28); // 2 x 10 + 8 de entrega
    expect(Produto.baixarEstoque).toHaveBeenCalledWith(fakeClient, 1, 2);
    expect(Pedido.inserirItem).toHaveBeenCalledWith(fakeClient, expect.objectContaining({ subtotal: 20 }));
  });

  it('rejeita forma de pagamento inválida', async () => {
    const res = await request(createServer(pedidosHandler)).post('/').send({ ...body, forma_pagamento: 'Boleto' });
    expect(res.status).toBe(400);
  });

  it('rejeita carrinho vazio', async () => {
    const res = await request(createServer(pedidosHandler)).post('/').send({ ...body, itens: [] });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/vazio/);
  });

  it('retorna 409 quando não há estoque', async () => {
    Produto.buscarProdutosPorIds.mockResolvedValue([{ id_produto: 1, nome: 'Red Velvet', preco: 10, quantidade_estoque: 0 }]);
    const res = await request(createServer(pedidosHandler)).post('/').send(body);
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/Estoque insuficiente/);
  });
});

describe('Admin', () => {
  it('GET /api/pedidos sem login retorna 401', async () => {
    const res = await request(createServer(pedidosHandler)).get('/');
    expect(res.status).toBe(401);
  });

  it('GET /api/pedidos com login lista pedidos', async () => {
    Pedido.listarPedidos.mockResolvedValue([{ id_pedido: 1 }, { id_pedido: 2 }]);
    const res = await request(createServer(pedidosHandler)).get('/').set('Cookie', adminCookie());
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.id_pedido)).toEqual([1, 2]);
  });

  it('PATCH avança Recebido → Em Preparo', async () => {
    Pedido.buscarPedido.mockResolvedValue({ id_pedido: 1, status: 'Recebido' });
    Pedido.atualizarStatus.mockResolvedValue({ id_pedido: 1, status: 'Em Preparo' });
    const res = await request(createServer(pedidoHandler, { id: '1' }))
      .patch('/').set('Cookie', adminCookie()).send({ status: 'Em Preparo' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Em Preparo');
  });

  it('PATCH bloqueia pulo de etapa', async () => {
    Pedido.buscarPedido.mockResolvedValue({ id_pedido: 1, status: 'Recebido' });
    const res = await request(createServer(pedidoHandler, { id: '1' }))
      .patch('/').set('Cookie', adminCookie()).send({ status: 'Finalizado' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/pedidos/:id (Rastreamento Seguro)', () => {
  const MSG_GENERICA = 'Não foi possível localizar o pedido com os dados informados.';

  it('bloqueia consulta sem informar o telefone (400)', async () => {
    const res = await request(createServer(pedidoHandler, { id: '1' })).get('/');
    expect(res.status).toBe(400);
    expect(Pedido.buscarPedido).not.toHaveBeenCalled();
  });

  it('libera acesso quando id_pedido e telefone do cliente conferem', async () => {
    Pedido.buscarPedido.mockResolvedValue({
      id_pedido: 1,
      status: 'Em Preparo',
      telefone: '(11) 98765-4321',
      itens: [],
    });
    const res = await request(createServer(pedidoHandler, { id: '1' })).get('/?telefone=11987654321');
    expect(res.status).toBe(200);
    expect(res.body.id_pedido).toBe(1);
    expect(res.body.status).toBe('Em Preparo');
  });

  it('bloqueia acesso e retorna erro genérico quando o telefone não bate', async () => {
    Pedido.buscarPedido.mockResolvedValue({
      id_pedido: 1,
      status: 'Em Preparo',
      telefone: '(11) 98765-4321',
      itens: [],
    });
    const res = await request(createServer(pedidoHandler, { id: '1' })).get('/?telefone=11000000000');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: MSG_GENERICA });
  });

  it('retorna o mesmo 404 genérico para pedido inexistente', async () => {
    Pedido.buscarPedido.mockResolvedValue(null);
    const res = await request(createServer(pedidoHandler, { id: '99' })).get('/?telefone=11987654321');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ erro: MSG_GENERICA });
  });
});

describe('Gestão de Produtos (Admin CRUD + Soft Delete)', () => {
  it('POST /api/produtos adiciona novo sabor (apenas admin)', async () => {
    Produto.criarProduto.mockResolvedValue({
      id_produto: 7,
      nome: 'Baunilha',
      descricao: 'Clássico',
      preco: 11.5,
      quantidade_estoque: 12,
      ativo: true,
    });
    const semLogin = await request(createServer(produtosHandler))
      .post('/')
      .send({ nome: 'Baunilha', preco: 11.5, quantidade_estoque: 12 });
    expect(semLogin.status).toBe(401);

    const res = await request(createServer(produtosHandler))
      .post('/')
      .set('Cookie', adminCookie())
      .send({ nome: 'Baunilha', descricao: 'Clássico', preco: 11.5, quantidade_estoque: 12 });
    expect(res.status).toBe(201);
    expect(res.body.ativo).toBe(true);
    expect(Produto.criarProduto).toHaveBeenCalledWith({
      nome: 'Baunilha',
      descricao: 'Clássico',
      preco: 11.5,
      quantidade_estoque: 12,
    });
  });

  it('PATCH /api/produtos/:id atualiza quantidade_estoque', async () => {
    Produto.atualizarEstoque.mockResolvedValue({ id_produto: 1, nome: 'Red Velvet', quantidade_estoque: 25, ativo: true });
    const res = await request(createServer(produtoAdminHandler, { id: '1' }))
      .patch('/')
      .set('Cookie', adminCookie())
      .send({ quantidade_estoque: 25 });
    expect(res.status).toBe(200);
    expect(Produto.atualizarEstoque).toHaveBeenCalledWith(1, 25);
    expect(res.body.quantidade_estoque).toBe(25);
  });

  it('PATCH /api/produtos/:id desativa sabor via Soft Delete (ativo = false) e proíbe DELETE', async () => {
    Produto.definirAtivo.mockResolvedValue({ id_produto: 1, nome: 'Red Velvet', ativo: false });
    const patchRes = await request(createServer(produtoAdminHandler, { id: '1' }))
      .patch('/')
      .set('Cookie', adminCookie())
      .send({ ativo: false });
    expect(patchRes.status).toBe(200);
    expect(Produto.definirAtivo).toHaveBeenCalledWith(1, false);
    expect(patchRes.body.ativo).toBe(false);

    const deleteRes = await request(createServer(produtoAdminHandler, { id: '1' }))
      .delete('/')
      .set('Cookie', adminCookie());
    expect(deleteRes.status).toBe(405);
  });
});


