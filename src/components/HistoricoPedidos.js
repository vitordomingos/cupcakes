import { useState } from 'react';
import Link from 'next/link';
import { formatBRL } from '../lib/config';
import { useCart } from '../context/CartContext';

/**
 * Lista o histórico do cliente com o botão "Repetir Pedido".
 * A checagem de estoque é feita no servidor; aqui só exibimos o alerta ou adicionamos ao carrinho.
 */
export default function HistoricoPedidos({ pedidos, onRepetido }) {
  const { adicionarItens } = useCart();
  const [alerta, setAlerta] = useState(null); // { tipo: 'erro' | 'ok', texto, itens? }
  const [processando, setProcessando] = useState(null);

  async function repetir(id_pedido) {
    setAlerta(null);
    setProcessando(id_pedido);
    try {
      const r = await fetch(`/api/clientes/pedidos/${id_pedido}/repetir`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) {
        // 409 → bloqueado: NÃO adiciona nada ao carrinho e informa os itens esgotados
        setAlerta({ tipo: 'erro', texto: data.erro || 'Não foi possível repetir o pedido.', itens: data.esgotados });
        return;
      }
      adicionarItens(data.itens);
      const avisos = (data.ajustados || []).map(
        (a) => `${a.nome}: só ${a.disponivel} de ${a.solicitado} disponível(is)`
      );
      setAlerta({
        tipo: 'ok',
        texto: `Itens do pedido #${id_pedido} adicionados ao carrinho.`,
        itens: avisos.length ? avisos : undefined,
      });
      if (onRepetido) onRepetido(data);
    } catch {
      setAlerta({ tipo: 'erro', texto: 'Falha de conexão. Tente novamente.' });
    } finally {
      setProcessando(null);
    }
  }

  return (
    <section>
      {alerta && (
        <div role="alert" className={alerta.tipo === 'erro' ? 'erro' : 'ok'}>
          <p style={{ margin: 0 }}>{alerta.texto}</p>
          {alerta.itens?.length > 0 && (
            <ul data-testid="alerta-itens">
              {alerta.itens.map((i) => <li key={i}>{i}</li>)}
            </ul>
          )}
          {alerta.tipo === 'ok' && <Link href="/carrinho">Ir para o carrinho →</Link>}
        </div>
      )}

      {!pedidos.length ? (
        <p>Você ainda não fez nenhum pedido.</p>
      ) : (
        <table>
          <thead>
            <tr><th>#</th><th>Data</th><th>Itens</th><th>Total</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id_pedido}>
                <td><a href={`/pedido/${p.id_pedido}`}>{p.id_pedido}</a></td>
                <td>{new Date(p.data_hora).toLocaleString('pt-BR')}</td>
                <td>{p.itens.map((i) => <div key={i.id_item}>{i.quantidade}x {i.nome}</div>)}</td>
                <td>{formatBRL(p.valor_total)}</td>
                <td><span className="status">{p.status}</span></td>
                <td>
                  <button
                    onClick={() => repetir(p.id_pedido)}
                    disabled={processando === p.id_pedido}
                    aria-label={`Repetir Pedido ${p.id_pedido}`}
                  >
                    {processando === p.id_pedido ? 'Verificando...' : 'Repetir Pedido'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
