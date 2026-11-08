import Link from 'next/link';
import { useCart } from '../src/context/CartContext';
import { formatBRL } from '../src/lib/config';

export default function Carrinho() {
  const { itens, alterarQuantidade, remover, subtotal, taxa, total } = useCart();

  if (!itens.length) {
    return (
      <>
        <h1>Carrinho</h1>
        <p>Seu carrinho está vazio. <Link href="/">Ver vitrine</Link></p>
      </>
    );
  }

  return (
    <>
      <h1>Carrinho</h1>
      <table>
        <thead>
          <tr><th>Produto</th><th>Preço</th><th>Qtd</th><th>Subtotal</th><th></th></tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id_produto}>
              <td>{i.nome}</td>
              <td>{formatBRL(i.preco)}</td>
              <td>
                <button className="sec" onClick={() => alterarQuantidade(i.id_produto, i.quantidade - 1)}>−</button>{' '}
                {i.quantidade}{' '}
                <button className="sec" disabled={i.quantidade >= i.estoque} onClick={() => alterarQuantidade(i.id_produto, i.quantidade + 1)}>+</button>
              </td>
              <td>{formatBRL(i.preco * i.quantidade)}</td>
              <td><button className="sec" onClick={() => remover(i.id_produto)}>Remover</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="totais">
        <div>Subtotal: {formatBRL(subtotal)}</div>
        <div>Taxa de entrega: {formatBRL(taxa)}</div>
        <div><strong>Total: {formatBRL(total)}</strong></div>
        <Link href="/checkout"><button>Finalizar compra</button></Link>
      </div>
    </>
  );
}

