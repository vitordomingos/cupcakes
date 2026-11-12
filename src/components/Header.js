import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { useSession } from '../context/SessionContext';

export default function Header() {
  const { totalItens } = useCart();
  const { cliente, sair } = useSession();

  async function logout() {
    await sair();
    window.location.assign('/'); // recarrega a vitrine sem a sessão
  }

  return (
    <header className="header">
      <Link href="/" className="logo">🧁 Cupcakes Gourmet</Link>
      <nav>
        <Link href="/pedido">Rastrear pedido</Link>
        {cliente ? (
          <>
            <Link href="/conta">Meus pedidos</Link>
            <span>Olá, {cliente.nome.split(' ')[0]}</span>
            <button className="sec" onClick={logout}>Sair</button>
          </>
        ) : (
          <Link href="/login">Entrar</Link>
        )}
        <Link href="/carrinho" className="cart" aria-label="Carrinho">
          🛒 <span className="badge" data-testid="cart-count">{totalItens}</span>
        </Link>
      </nav>
    </header>
  );
}
