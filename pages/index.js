import { useEffect, useState } from 'react';
import Vitrine from '../src/components/Vitrine';
import { useCart } from '../src/context/CartContext';

export default function Home() {
  const { adicionar } = useCart();
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/produtos')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.erro || 'Falha ao carregar produtos.');
        setProdutos(data);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <>
      <h1>Nossa Vitrine</h1>
      {erro && <p className="erro">{erro}</p>}
      {carregando ? <p>Carregando...</p> : !erro && <Vitrine produtos={produtos} onAdicionar={adicionar} />}
    </>
  );
}

