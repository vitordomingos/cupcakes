import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AdminLogin() {
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    try {
      const r = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Falha no login.');
      router.push('/admin');
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <>
      <h1>Área do Administrador</h1>
      <form onSubmit={entrar}>
        <input type="password" placeholder="Senha do administrador" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        {erro && <p className="erro">{erro}</p>}
        <button type="submit">Entrar</button>
      </form>
    </>
  );
}

