/**
 * @jest-environment jsdom
 *
 * Testes de View: Rastreamento Seguro e Gestão de Produtos (Admin / Soft Delete).
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Rastreamento from '../pages/pedido/[id]';
import AdminProdutos from '../src/components/AdminProdutos';

const mockRouter = { query: { id: '15' }, push: jest.fn(), reload: jest.fn() };
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));

const resposta = (status, body) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  mockRouter.query = { id: '15' };
  global.fetch = jest.fn();
});

describe('View: Rastreamento Seguro', () => {
  it('bloqueia acesso aos dados do pedido até que id_pedido e telefone batam', async () => {
    fetch.mockReturnValueOnce(
      resposta(404, { erro: 'Não foi possível localizar o pedido com os dados informados.' })
    );
    render(<Rastreamento />);

    // Sem telefone na URL, exibe formulário de verificação e não mostra status do pedido
    expect(screen.queryByText(/Status atual/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Telefone do cliente'), { target: { value: '11000000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar e consultar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível localizar o pedido com os dados informados.'
    );
    expect(screen.queryByText(/Status atual/i)).not.toBeInTheDocument();

    // Agora com o telefone correto
    fetch.mockReturnValueOnce(
      resposta(200, {
        id_pedido: 15,
        status: 'Saiu para Entrega',
        data_hora: '2026-11-10T18:00:00Z',
        forma_pagamento: 'Pix na entrega',
        endereco: 'Rua das Flores, 10',
        taxa_entrega: 8,
        valor_total: 20.9,
        itens: [{ id_item: 1, nome: 'Red Velvet', quantidade: 1, subtotal: 12.9 }],
      })
    );
    fireEvent.change(screen.getByLabelText('Telefone do cliente'), { target: { value: '11987654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validar e consultar' }));

    expect(await screen.findByText(/Status atual/i)).toBeInTheDocument();
    expect(screen.getByText(/Rua das Flores, 10/)).toBeInTheDocument();
  });
});

describe('View: Gestão de Produtos (Admin)', () => {
  const produtosIniciais = [
    { id_produto: 1, nome: 'Red Velvet', descricao: 'Clássico', preco: 12.9, quantidade_estoque: 10, ativo: true },
  ];

  it('atualiza estoque, adiciona sabor e desativa via Soft Delete (PATCH ativo: false)', async () => {
    render(<AdminProdutos produtosIniciais={produtosIniciais} />);

    // 1. Atualizar quantidade_estoque
    fetch.mockReturnValueOnce(
      resposta(200, { ...produtosIniciais[0], quantidade_estoque: 30 })
    );
    fireEvent.change(screen.getByLabelText('Estoque de Red Velvet'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar estoque de Red Velvet' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/produtos/1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ quantidade_estoque: 30 }) })
      )
    );

    // 2. Soft Delete (Desativar sabor)
    fetch.mockReturnValueOnce(
      resposta(200, { ...produtosIniciais[0], quantidade_estoque: 30, ativo: false })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Desativar' }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/produtos/1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ ativo: false }) })
      )
    );
    expect(await screen.findByRole('button', { name: 'Reativar' })).toBeInTheDocument();

    // 3. Adicionar novo sabor
    fetch.mockReturnValueOnce(
      resposta(201, { id_produto: 2, nome: 'Maracujá', descricao: 'Mousse', preco: 13.5, quantidade_estoque: 15, ativo: true })
    );
    fireEvent.change(screen.getByLabelText('Nome do sabor'), { target: { value: 'Maracujá' } });
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Mousse' } });
    fireEvent.change(screen.getByLabelText('Preço (R$)'), { target: { value: '13.5' } });
    fireEvent.change(screen.getByLabelText('Estoque inicial'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar sabor' }));

    expect(await screen.findByText('Maracujá')).toBeInTheDocument();
  });
});
