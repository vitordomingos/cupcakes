import { useState } from 'react';
import { useRouter } from 'next/router';

export default function BuscarPedido() {
  const router = useRouter();
  const [numero, setNumero] = useState('');
  const [telefone, setTelefone] = useState('');
  const [erro, setErro] = useState('');

  function consultar(e) {
    e.preventDefault();
    setErro('');
    const id = Number(numero);
    const tel = telefone.replace(/\D/g, '');
    if (!Number.isInteger(id) || id <= 0 || !tel) {
      return setErro('Informe o número do pedido e o telefone cadastrado.');
    }
    router.push(`/pedido/${id}?telefone=${encodeURIComponent(telefone.trim())}`);
  }

  return (
    <>
      <h1>Rastrear pedido</h1>
      <p>Informe o número do pedido e o telefone utilizado na compra para consultar o status.</p>
      <form onSubmit={consultar}>
        <label htmlFor="rastreio-id">Número do pedido</label>
        <input
          id="rastreio-id"
          type="number"
          min="1"
          placeholder="Ex.: 12"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          required
        />
        <label htmlFor="rastreio-telefone">Telefone do cliente</label>
        <input
          id="rastreio-telefone"
          type="tel"
          placeholder="Ex.: (11) 99999-0000"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          required
        />
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit">Consultar status</button>
      </form>
    </>
  );
}
