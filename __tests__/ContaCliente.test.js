/**
 * @jest-environment jsdom
 *
 * Testes de View – foco na validação de estoque ao repetir pedido
 * e na segurança do fluxo de recuperação de senha.
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import HistoricoPedidos from '../src/components/HistoricoPedidos';
import RecuperarSenhaForm from '../src/components/RecuperarSenhaForm';
import Header from '../src/components/Header';
import { CartProvider, useCart } from '../src/context/CartContext';

jest.mock('next/link', () => ({ children, href, ...rest }) => <a href={href} {...rest}>{children}</a>);

const resposta = (status, body) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn();
});

/* ===================== Histórico / Repetir Pedido ===================== */

const pedidos = [
  {
    id_pedido: 10,
    data_hora: '2026-11-01T15:00:00Z',
    valor_total: 41.8,
    status: 'Finalizado',
    itens: [
      { id_item: 1, id_produto: 1, nome: 'Red Velvet', quantidade: 2 },
      { id_item: 2, id_produto: 6, nome: 'Pistache', quantidade: 1 },
    ],
  },
];

function ItensCarrinho() {
  const { itens } = useCart();
  return <div data-testid="carrinho">{itens.map((i) => `${i.nome}:${i.quantidade}`).join('|')}</div>;
}

const renderHistorico = () =>
  render(
    <CartProvider>
      <Header />
      <HistoricoPedidos pedidos={pedidos} />
      <ItensCarrinho />
    </CartProvider>
  );

describe('View: Histórico – Repetir Pedido', () => {
  it('lista o pedido com o botão "Repetir Pedido"', () => {
    renderHistorico();
    expect(screen.getByRole('button', { name: 'Repetir Pedido 10' })).toBeInTheDocument();
  });

  it('com item esgotado: exibe alerta com os itens exatos e NÃO altera o carrinho', async () => {
    fetch.mockReturnValue(
      resposta(409, {
        erro: 'Não foi possível repetir o pedido. Itens esgotados: Pistache.',
        esgotados: ['Pistache'],
      })
    );
    renderHistorico();
    fireEvent.click(screen.getByRole('button', { name: 'Repetir Pedido 10' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Itens esgotados: Pistache.');
    expect(within(screen.getByTestId('alerta-itens')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Pistache']);
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');
    expect(screen.getByTestId('carrinho')).toHaveTextContent('');
    expect(fetch).toHaveBeenCalledWith('/api/clientes/pedidos/10/repetir', { method: 'POST' });
  });

  it('com estoque: adiciona os itens ao carrinho e atualiza o ícone', async () => {
    fetch.mockReturnValue(
      resposta(200, {
        itens: [
          { id_produto: 1, nome: 'Red Velvet', preco: 12.9, quantidade_estoque: 20, quantidade: 2 },
          { id_produto: 6, nome: 'Pistache', preco: 15.9, quantidade_estoque: 5, quantidade: 1 },
        ],
        ajustados: [],
      })
    );
    renderHistorico();
    fireEvent.click(screen.getByRole('button', { name: 'Repetir Pedido 10' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('adicionados ao carrinho');
    expect(screen.getByTestId('cart-count')).toHaveTextContent('3');
    expect(screen.getByTestId('carrinho')).toHaveTextContent('Red Velvet:2|Pistache:1');
  });

  it('ao repetir, nunca ultrapassa o estoque atual mesmo somando ao que já está no carrinho', async () => {
    localStorage.setItem(
      'cupcakes_carrinho',
      JSON.stringify([{ id_produto: 1, nome: 'Red Velvet', preco: 12.9, estoque: 3, quantidade: 2 }])
    );
    fetch.mockReturnValue(
      resposta(200, {
        itens: [{ id_produto: 1, nome: 'Red Velvet', preco: 12.9, quantidade_estoque: 3, quantidade: 2 }],
        ajustados: [],
      })
    );
    renderHistorico();
    await waitFor(() => expect(screen.getByTestId('cart-count')).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Repetir Pedido 10' }));

    await screen.findByRole('alert');
    expect(screen.getByTestId('carrinho')).toHaveTextContent('Red Velvet:3');
  });
});

/* ===================== Recuperação de senha ===================== */

const digitar = (label, valor) => fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });

describe('View: Recuperação de senha', () => {
  it('pede o telefone após o usuário, sem chamar o servidor e sem exibir campo de nova senha', () => {
    render(<RecuperarSenhaForm />);
    digitar('Usuário', 'ana');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByLabelText('Celular cadastrado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('telefone que não confere: mostra erro e NÃO libera a criação de nova senha', async () => {
    fetch.mockReturnValue(resposta(401, { erro: 'Os dados informados não conferem com nenhuma conta.' }));
    render(<RecuperarSenhaForm />);
    digitar('Usuário', 'ana');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    digitar('Celular cadastrado', '11000000000');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar telefone' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('não conferem');
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ usuario: 'ana', telefone: '11000000000' });
  });

  it('telefone correto libera a nova senha, valida confirmação e envia o token ao servidor', async () => {
    const onConcluido = jest.fn();
    fetch
      .mockReturnValueOnce(resposta(200, { token: 'tok-123' }))
      .mockReturnValueOnce(resposta(200, { ok: true }));
    render(<RecuperarSenhaForm onConcluido={onConcluido} />);

    digitar('Usuário', 'ana');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    digitar('Celular cadastrado', '(11) 98765-4321');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar telefone' }));

    expect(await screen.findByLabelText('Nova senha')).toBeInTheDocument();

    // Confirmação divergente é barrada no cliente, sem chamar a API
    digitar('Nova senha', 'novaSenha9');
    digitar('Confirmar nova senha', 'outraSenha9');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(screen.getByRole('alert')).toHaveTextContent('confirmação não confere');
    expect(fetch).toHaveBeenCalledTimes(1);

    digitar('Confirmar nova senha', 'novaSenha9');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() => expect(onConcluido).toHaveBeenCalled());
    expect(fetch).toHaveBeenLastCalledWith('/api/clientes/redefinir-senha', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      token: 'tok-123',
      nova_senha: 'novaSenha9',
      confirmacao: 'novaSenha9',
    });
  });

  it('token expirado: volta ao início do fluxo', async () => {
    fetch
      .mockReturnValueOnce(resposta(200, { token: 'tok-velho' }))
      .mockReturnValueOnce(resposta(401, { erro: 'Link de redefinição inválido ou expirado. Recomece o processo.' }));
    render(<RecuperarSenhaForm />);
    digitar('Usuário', 'ana');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    digitar('Celular cadastrado', '11987654321');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar telefone' }));
    await screen.findByLabelText('Nova senha');
    digitar('Nova senha', 'novaSenha9');
    digitar('Confirmar nova senha', 'novaSenha9');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('expirado');
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });
});
