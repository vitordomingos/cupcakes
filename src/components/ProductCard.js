import { formatBRL } from '../lib/config';

export default function ProductCard({ produto, onAdicionar }) {
  const esgotado = produto.quantidade_estoque <= 0;
  return (
    <article className={`card ${esgotado ? 'esgotado' : ''}`}>
      <img src="/cupcake.svg" alt={`Foto do cupcake ${produto.nome}`} />
      <h3>{produto.nome}</h3>
      <p className="desc">{produto.descricao}</p>
      <p className="preco">{formatBRL(produto.preco)}</p>
      {esgotado && <span className="tag">Esgotado</span>}
      <button disabled={esgotado} onClick={() => onAdicionar(produto)}>
        {esgotado ? 'Indisponível' : 'Adicionar ao carrinho'}
      </button>
    </article>
  );
}

