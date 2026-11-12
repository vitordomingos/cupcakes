import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Valor padrão permite usar componentes (ex.: Header) fora do provider, como em testes.
const SessionContext = createContext({
  cliente: null,
  carregando: false,
  setCliente: () => {},
  recarregar: async () => {},
  sair: async () => {},
});

export function SessionProvider({ children }) {
  const [cliente, setCliente] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const r = await fetch('/api/clientes/me');
      const data = await r.json();
      setCliente(r.ok ? data.cliente : null);
    } catch {
      setCliente(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  const sair = useCallback(async () => {
    try {
      await fetch('/api/clientes/login', { method: 'DELETE' });
    } finally {
      setCliente(null);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const value = useMemo(
    () => ({ cliente, carregando, setCliente, recarregar, sair }),
    [cliente, carregando, recarregar, sair]
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);

