import ProductCard from './ProductCard';

export default function Vitrine({ produtos, onAdicionar }) {
  if (!produtos.length) return <p>Nenhum produto disponível no momento.</p>;
  return (
    <section className="grid">
      {produtos.map((p) => (
        <ProductCard key={p.id_produto} produto={p} onAdicionar={onAdicionar} />
      ))}
    </section>
  );
}

