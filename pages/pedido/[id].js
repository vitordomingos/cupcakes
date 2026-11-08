import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { STATUS, formatBRL } from '../../src/lib/config';

// US04 - status carregado passivamente a cada abertura/recarregamento da tela.
export default function Rastreamento() {
  const router = useRouter();
  const { id, novo } = router.query;
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/pedidos/${id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.erro || 'Erro ao consultar pedido.');
        setPedido(data);
      })
      .catch((e) => setErro(e.message));
  }, [id]);

  if (erro) return <p className="erro">{erro}</p>;
  if (!pedido) return <p>Carregando...</p>;

  const idx = STATUS.indexOf(pedido.status);
  return (
    <>
      {novo && <p className="ok">Pedido realizado com sucesso! Guarde o número: <strong>#{pedido.id_pedido}</strong></p>}
      <h1>Pedido #{pedido.id_pedido}</h1>
      <p>Status atual: <span className="status">{pedido.status}</span></p>
      <div className="steps">
        {STATUS.map((s, i) => <span key={s} className={i <= idx ? 'ativo' : ''}>{s}</span>)}
      </div>
      <p>Realizado em: {new Date(pedido.data_hora).toLocaleString('pt-BR')}</p>
      <p>Pagamento: <span className="pag">{pedido.forma_pagamento}</span></p>
      <p>Entrega em: {pedido.endereco}</p>
      <ul>
        {pedido.itens.map((i) => (
          <li key={i.id_item}>{i.quantidade}x {i.nome} — {formatBRL(i.subtotal)}</li>
        ))}
      </ul>
      <p>Taxa de entrega: {formatBRL(pedido.taxa_entrega)}</p>
      <p><strong>Total: {formatBRL(pedido.valor_total)}</strong></p>
      <button className="sec" onClick={() => router.reload()}>Atualizar status</button>
    </>
  );
}

