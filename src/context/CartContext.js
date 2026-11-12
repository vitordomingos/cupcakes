import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TAXA_ENTREGA } from '../lib/config';

const CartContext = createContext(null);
const KEY = 'cupcakes_carrinho';

export function CartProvider({ children }) {
  const [itens, setItens] = useState([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (Array.isArray(salvo)) setItens(salvo);
    } catch {
      /* ignora carrinho corrompido */
    }
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (carregado) localStorage.setItem(KEY, JSON.stringify(itens));
  }, [itens, carregado]);

  const value = useMemo(() => {
    const adicionar = (produto) =>
      setItens((atual) => {
        const ex = atual.find((i) => i.id_produto === produto.id_produto);
        if (ex) {
          if (ex.quantidade >= produto.quantidade_estoque) return atual;
          return atual.map((i) =>
            i.id_produto === produto.id_produto ? { ...i, quantidade: i.quantidade + 1 } : i
          );
        }
        return [
          ...atual,
          {
            id_produto: produto.id_produto,
            nome: produto.nome,
            preco: produto.preco,
            estoque: produto.quantidade_estoque,
            quantidade: 1,
          },
        ];
      });

    const alterarQuantidade = (id, quantidade) =>
      setItens((atual) =>
        atual
          .map((i) => (i.id_produto === id ? { ...i, quantidade: Math.min(quantidade, i.estoque) } : i))
          .filter((i) => i.quantidade > 0)
      );

    const remover = (id) => setItens((atual) => atual.filter((i) => i.id_produto !== id));
    const limpar = () => setItens([]);

    /**
     * Adiciona vários itens de uma vez (Repetir Pedido).
     * Recebe [{ id_produto, nome, preco, quantidade_estoque, quantidade }] já validados pelo servidor;
     * soma com o que já está no carrinho, sem ultrapassar o estoque atual.
     */
    const adicionarItens = (novos) =>
      setItens((atual) => {
        const resultado = [...atual];
        for (const n of novos) {
          const idx = resultado.findIndex((i) => i.id_produto === n.id_produto);
          if (idx >= 0) {
            const ex = resultado[idx];
            resultado[idx] = {
              ...ex,
              preco: n.preco,
              estoque: n.quantidade_estoque,
              quantidade: Math.min(ex.quantidade + n.quantidade, n.quantidade_estoque),
            };
          } else {
            resultado.push({
              id_produto: n.id_produto,
              nome: n.nome,
              preco: n.preco,
              estoque: n.quantidade_estoque,
              quantidade: Math.min(n.quantidade, n.quantidade_estoque),
            });
          }
        }
        return resultado.filter((i) => i.quantidade > 0);
      });

    const totalItens = itens.reduce((s, i) => s + i.quantidade, 0);
    const subtotal = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
    const taxa = itens.length ? TAXA_ENTREGA : 0;

    return { itens, adicionar, adicionarItens, alterarQuantidade, remover, limpar, totalItens, subtotal, taxa, total: subtotal + taxa };
  }, [itens]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart deve ser usado dentro de <CartProvider>');
  return ctx;
}

