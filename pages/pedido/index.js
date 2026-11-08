import { useState } from 'react';
import { useRouter } from 'next/router';

export default function BuscarPedido() {
  const router = useRouter();
  const [numero, setNumero] = useState('');
  return (
    <>
      <h1>Rastrear pedido</h1>
      <form onSubmit={(e) => { e.preventDefault(); if (numero) router.push(`/pedido/${numero}`); }}>
        <input type="number" min="1" placeholder="Número do pedido" value={numero} onChange={(e) => setNumero(e.target.value)} required />
        <button type="submit">Consultar</button>
      </form>
    </>
  );
}

