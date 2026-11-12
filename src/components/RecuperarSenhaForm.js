import { useState } from 'react';

const SENHA_MIN = 6;

/**
 * Fluxo "Esqueci minha senha" em 3 etapas:
 *  1) usuário  2) confirmação do telefone cadastrado (validado no servidor)  3) nova senha.
 * A etapa 3 só aparece se o servidor devolver um token (usuário + telefone conferem).
 */
export default function RecuperarSenhaForm({ onConcluido }) {
  const [etapa, setEtapa] = useState(1);
  const [usuario, setUsuario] = useState('');
  const [telefone, setTelefone] = useState('');
  const [token, setToken] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function post(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.erro || 'Não foi possível concluir a operação.');
    return data;
  }

  function avancarUsuario(e) {
    e.preventDefault();
    setErro('');
    if (!usuario.trim()) return setErro('Informe seu usuário.');
    setEtapa(2);
  }

  async function confirmarTelefone(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const data = await post('/api/clientes/recuperar-senha', { usuario: usuario.trim(), telefone });
      setToken(data.token);
      setEtapa(3);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function salvarSenha(e) {
    e.preventDefault();
    setErro('');
    if (senha.length < SENHA_MIN) return setErro(`A nova senha deve ter pelo menos ${SENHA_MIN} caracteres.`);
    if (senha !== confirmacao) return setErro('A confirmação não confere com a nova senha.');
    setEnviando(true);
    try {
      await post('/api/clientes/redefinir-senha', { token, nova_senha: senha, confirmacao });
      setToken('');
      if (onConcluido) onConcluido();
    } catch (err) {
      setErro(err.message);
      if (/inválido|expirado|utilizado/i.test(err.message)) {
        setToken('');
        setEtapa(1);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {etapa === 1 && (
        <form onSubmit={avancarUsuario}>
          <label htmlFor="rs-usuario">Usuário</label>
          <input id="rs-usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" />
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="submit">Continuar</button>
        </form>
      )}

      {etapa === 2 && (
        <form onSubmit={confirmarTelefone}>
          <p>Para sua segurança, confirme o número de celular cadastrado na conta <strong>{usuario}</strong>.</p>
          <label htmlFor="rs-telefone">Celular cadastrado</label>
          <input id="rs-telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} autoComplete="tel" />
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="submit" disabled={enviando || !telefone.trim()}>
            {enviando ? 'Verificando...' : 'Confirmar telefone'}
          </button>
          <button type="button" className="sec" onClick={() => { setErro(''); setTelefone(''); setEtapa(1); }}>
            Voltar
          </button>
        </form>
      )}

      {etapa === 3 && (
        <form onSubmit={salvarSenha}>
          <p className="ok">Identidade confirmada. Crie sua nova senha.</p>
          <label htmlFor="rs-senha">Nova senha</label>
          <input id="rs-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          <label htmlFor="rs-confirmacao">Confirmar nova senha</label>
          <input id="rs-confirmacao" type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" />
          {erro && <p className="erro" role="alert">{erro}</p>}
          <button type="submit" disabled={enviando}>{enviando ? 'Salvando...' : 'Salvar nova senha'}</button>
        </form>
      )}
    </>
  );
}

