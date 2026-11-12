import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { isAdmin } from '../../src/lib/auth';
import { proximoStatus, formatBRL } from '../../src/lib/config';
import AdminProdutos from '../../src/components/AdminProdutos';

// Proteção da rota no servidor: sem cookie de admin → redireciona para o login.
export async function getServerSideProps({ req }) {
  if (!isAdmin(req)) return { redirect: { destination: '/admin/login', permanent: false } };
  return { props: {} };
}

export default function PainelAdmin() {
  const router = useRouter();
  const [aba, setAba] = useState('pedidos');
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/pedidos');
      const data = await r.json();
      if (r.status === 401) return router.push('/admin/login');
      if (!r.ok) throw new Error(data.erro);
      setPedidos(data);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar pedidos.');
    }
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function avancar(p) {
    setErro('');
    try {
      const r = await fetch(`/api/pedidos/${p.id_pedido}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: proximoStatus(p.status) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro);
      carregar();
    } catch (e) {
      setErro(e.message || 'Erro ao atualizar status.');
    }
  }

  async function sair() {
    await fetch('/api/admin/login', { method: 'DELETE' });
    router.push('/admin/login');
  }

  return (
    <>
      <h1>Painel Administrativo <button className="sec" onClick={sair}>Sair</button></h1>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          className={aba === 'pedidos' ? '' : 'sec'}
          onClick={() => setAba('pedidos')}
        >
          Gestão de Pedidos
        </button>
        <button
          type="button"
          className={aba === 'produtos' ? '' : 'sec'}
          onClick={() => setAba('produtos')}
        >
          Gestão de Produtos
        </button>
      </div>

      {aba === 'produtos' ? (
        <AdminProdutos />
      ) : (
        <section>
          <h2>Gestão de Pedidos</h2>
          {erro && <p className="erro">{erro}</p>}
          {!pedidos.length ? <p>Nenhum pedido ainda.</p> : (
            <table>
              <thead>
                <tr><th>#</th><th>Data/Hora</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Pagamento</th><th>Status</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const prox = proximoStatus(p.status);
                  return (
                    <tr key={p.id_pedido}>
                      <td>{p.id_pedido}</td>
                      <td>{new Date(p.data_hora).toLocaleString('pt-BR')}</td>
                      <td>{p.cliente_nome}<br /><small>{p.telefone}<br />{p.endereco}</small></td>
                      <td>{p.itens.map((i) => <div key={i.id_item}>{i.quantidade}x {i.nome}</div>)}</td>
                      <td>{formatBRL(p.valor_total)}</td>
                      <td className="pag">{p.forma_pagamento === 'Cartão na entrega' ? '💳 ' : '📱 '}{p.forma_pagamento}</td>
                      <td><span className="status">{p.status}</span></td>
                      <td>{prox ? <button onClick={() => avancar(p)}>→ {prox}</button> : '✔'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
