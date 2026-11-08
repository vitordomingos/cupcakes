/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import Vitrine from '../src/components/Vitrine';
import Header from '../src/components/Header';
import { CartProvider, useCart } from '../src/context/CartContext';

jest.mock('next/link', () => ({ children, href, ...rest }) => <a href={href} {...rest}>{children}</a>);

const produtos = [
  { id_produto: 1, nome: 'Red Velvet', descricao: 'Delícia', preco: 12.9, quantidade_estoque: 5 },
  { id_produto: 2, nome: 'Pistache', descricao: 'Crocante', preco: 15.9, quantidade_estoque: 0 },
];

function VitrineComCarrinho() {
  const { adicionar, total } = useCart();
  return (
    <>
      <Header />
      <Vitrine produtos={produtos} onAdicionar={adicionar} />
      <span data-testid="total">{total.toFixed(2)}</span>
    </>
  );
}

beforeEach(() => localStorage.clear());

describe('View: Vitrine', () => {
  it('exibe produtos com foto e preço', () => {
    render(<Vitrine produtos={produtos} onAdicionar={() => {}} />);
    expect(screen.getByAltText('Foto do cupcake Red Velvet')).toBeInTheDocument();
    expect(screen.getByText(/12,90/)).toBeInTheDocument();
  });

  it('marca produto sem estoque como Esgotado e desativa o botão', () => {
    render(<Vitrine produtos={produtos} onAdicionar={() => {}} />);
    expect(screen.getByText('Esgotado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indisponível' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeEnabled();
  });

  it('atualiza o ícone do carrinho em tempo real e soma a taxa de entrega', () => {
    render(<CartProvider><VitrineComCarrinho /></CartProvider>);
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');

    const botao = screen.getByRole('button', { name: 'Adicionar ao carrinho' });
    fireEvent.click(botao);
    fireEvent.click(botao);

    expect(screen.getByTestId('cart-count')).toHaveTextContent('2');
    expect(screen.getByTestId('total')).toHaveTextContent('33.80'); // 2 x 12,90 + 8,00
  });
});

