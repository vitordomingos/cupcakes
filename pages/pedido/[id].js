import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { STATUS, formatBRL } from '../../src/lib/config';

// US04 + Rastreamento Seguro: exige id_pedido E telefone do cliente.
export default function Rastreamento() {
  const router = useRouter();
  const { id, telefone: telQuery, novo } = router.query;
  const [telefoneInput, setTelefoneInput] = useState('');
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const buscar = useCallback(async (idPedido, tel) => {
    setErro('');
    setCarregando(true);
    try {
      const r = await fetch(`/api/pedidos/${idPedido}?telefone=${encodeURIComponent(tel)}`);
      const data = await r.json();
      if (!r.ok) {
        setPedido(null);
        throw new Error(data.erro || 'Não foi possível localizar o pedido com os dados informados.');
      }
      setPedido(data);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!id || !telQuery) return;
    setTelefoneInput(String(telQuery));
    buscar(id, String(telQuery));
  }, [id, telQuery, buscar]);

  function validarFormulario(e) {
    e.preventDefault();
    if (!id || !telefoneInput.trim()) {
      setErro('Informe o número do pedido e o telefone cadastrado.');
      return;
    }
    buscar(id, telefoneInput.trim());
  }

  // Bloqueia visualização enquanto os dados (id_pedido + telefone) não forem validados pelo servidor
  if (!pedido) {
    return (
      <>
        <h1>Rastrear pedido {id ? `#${id}` : ''}</h1>
        {carregando ? (
          <p>Verificando dados do pedido...</p>
        ) : (
          <form onSubmit={validarFormulario}>
            <p>Confirme o telefone utilizado no pedido para visualizar o status de entrega.</p>
            <label htmlFor="confirma-telefone">Telefone do cliente</label>
            <input
              id="confirma-telefone"
              type="tel"
              placeholder="Ex.: (11) 99999-0000"
              value={telefoneInput}
              onChange={(e) => setTelefoneInput(e.target.value)}
              required
            />
            {erro && <p className="erro" role="alert">{erro}</p>}
            <button type="submit">Validar e consultar</button>
          </form>
        )}
      </>
    );
  }

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
      <button className="sec" onClick={() => buscar(pedido.id_pedido, telefoneInput || telQuery)}>
        Atualizar status
      </button>
    </>
  );
}
