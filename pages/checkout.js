import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useCart } from '../src/context/CartContext';
import { useSession } from '../src/context/SessionContext';
import { FORMAS_PAGAMENTO, formatBRL } from '../src/lib/config';

const vazio = { nome: '', telefone: '', endereco: '', usuario: '', senha: '' };

export default function Checkout() {
  const router = useRouter();
  const { itens, subtotal, taxa, total, limpar } = useCart();
  const { cliente: logado, recarregar } = useSession();
  const [cliente, setCliente] = useState(vazio);
  const [forma, setForma] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Cliente logado: preenche os dados de entrega do cadastro
  useEffect(() => {
    if (logado) {
      setCliente((c) => ({ ...c, nome: logado.nome, telefone: logado.telefone, endereco: logado.endereco }));
    }
  }, [logado]);

  if (!itens.length) {
    return <p>Seu carrinho está vazio. <Link href="/">Voltar à vitrine</Link></p>;
  }

  const set = (campo) => (e) => setCliente({ ...cliente, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (!forma) return setErro('Escolha uma forma de pagamento.');
    setEnviando(true);
    try {
      const dadosCliente = logado
        ? { nome: cliente.nome, telefone: cliente.telefone, endereco: cliente.endereco }
        : cliente;
      const r = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: dadosCliente,
          forma_pagamento: forma,
          itens: itens.map((i) => ({ id_produto: i.id_produto, quantidade: i.quantidade })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Não foi possível concluir o pedido.');
      limpar();
      if (!logado) recarregar(); // visitante passa a estar logado após o pedido
      router.push(`/pedido/${data.id_pedido}?novo=1`);
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Checkout</h1>
      {logado ? (
        <p>Comprando como <strong>{logado.usuario}</strong>.</p>
      ) : (
        <p>Já tem conta? <Link href="/login?next=/checkout">Entrar</Link></p>
      )}
      <form onSubmit={enviar}>
        <input placeholder="Nome" value={cliente.nome} onChange={set('nome')} required />
        <input placeholder="Telefone" value={cliente.telefone} onChange={set('telefone')} required />
        <input placeholder="Endereço de entrega" value={cliente.endereco} onChange={set('endereco')} required />
        {!logado && (
          <>
            <input placeholder="Usuário" value={cliente.usuario} onChange={set('usuario')} required />
            <input placeholder="Senha" type="password" value={cliente.senha} onChange={set('senha')} required />
          </>
        )}

        <fieldset>
          <legend>Forma de pagamento (pago na entrega)</legend>
          {FORMAS_PAGAMENTO.map((f) => (
            <label key={f.valor} style={{ display: 'block' }}>
              <input type="radio" name="pagamento" value={f.valor} checked={forma === f.valor} onChange={() => setForma(f.valor)} />{' '}
              {f.rotulo}
            </label>
          ))}
        </fieldset>

        <div>
          Subtotal: {formatBRL(subtotal)} · Entrega: {formatBRL(taxa)} · <strong>Total: {formatBRL(total)}</strong>
        </div>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Enviando...' : 'Confirmar pedido'}</button>
      </form>
    </>
  );
}
