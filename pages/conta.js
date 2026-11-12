import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getClienteId } from '../src/lib/auth';
import HistoricoPedidos from '../src/components/HistoricoPedidos';

// Área restrita: sem sessão de cliente → redireciona para o login.
export async function getServerSideProps({ req }) {
  if (!getClienteId(req)) {
    return { redirect: { destination: '/login?next=/conta', permanent: false } };
  }
  return { props: {} };
}

export default function MinhaConta() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/clientes/pedidos')
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 401) return router.push('/login?next=/conta');
        if (!r.ok) throw new Error(data.erro || 'Erro ao carregar seus pedidos.');
        setPedidos(data);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [router]);

  return (
    <>
      <h1>Meus pedidos</h1>
      {erro && <p className="erro">{erro}</p>}
      {carregando ? <p>Carregando...</p> : !erro && <HistoricoPedidos pedidos={pedidos} />}
    </>
  );
}

