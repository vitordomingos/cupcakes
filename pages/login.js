import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from '../src/context/SessionContext';

// Evita "open redirect": só aceita caminhos internos.
const destinoSeguro = (next) =>
  typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/conta';

export default function Login() {
  const router = useRouter();
  const { setCliente } = useSession();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const r = await fetch('/api/clientes/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Falha no login.');
      setCliente(data.cliente);
      router.push(destinoSeguro(router.query.next));
    } catch (err) {
      setErro(err.message);
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Entrar</h1>
      {router.query.senha === 'redefinida' && (
        <p className="ok">Senha redefinida com sucesso! Entre com a nova senha.</p>
      )}
      <form onSubmit={entrar}>
        <label htmlFor="login-usuario">Usuário</label>
        <input id="login-usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required />
        <label htmlFor="login-senha">Senha</label>
        <input id="login-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Entrando...' : 'Entrar'}</button>
      </form>
      <p><Link href="/recuperar-senha">Esqueci minha senha</Link></p>
      <p>Ainda não tem conta? Sua conta é criada no seu primeiro pedido, no <Link href="/carrinho">checkout</Link>.</p>
    </>
  );
}

