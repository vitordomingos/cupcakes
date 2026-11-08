import Link from 'next/link';
import { useCart } from '../context/CartContext';

export default function Header() {
  const { totalItens } = useCart();
  return (
    <header className="header">
      <Link href="/" className="logo">🧁 Cupcakes Gourmet</Link>
      <nav>
        <Link href="/pedido">Rastrear pedido</Link>
        <Link href="/carrinho" className="cart" aria-label="Carrinho">
          🛒 <span className="badge" data-testid="cart-count">{totalItens}</span>
        </Link>
      </nav>
    </header>
  );
}

