import { useCallback, useEffect, useState } from 'react';
import { formatBRL } from '../lib/config';

const NOVO_VAZIO = { nome: '', descricao: '', preco: '', quantidade_estoque: '0' };

export default function AdminProdutos({ produtosIniciais }) {
  const [produtos, setProdutos] = useState(produtosIniciais || []);
  const [estoques, setEstoques] = useState({});
  const [novo, setNovo] = useState(NOVO_VAZIO);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const sincronizarEstoques = (lista) => {
    const mapa = {};
    for (const p of lista) mapa[p.id_produto] = String(p.quantidade_estoque);
    setEstoques(mapa);
  };

  const carregar = useCallback(async () => {
    try {
      const r = await fetch('/api/produtos?todos=1');
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Erro ao carregar produtos.');
      setProdutos(data);
      sincronizarEstoques(data);
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => {
    if (produtosIniciais) {
      sincronizarEstoques(produtosIniciais);
    } else {
      carregar();
    }
  }, [produtosIniciais, carregar]);

  async function adicionarSabor(e) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    try {
      const r = await fetch('/api/produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: novo.nome,
          descricao: novo.descricao,
          preco: Number(novo.preco),
          quantidade_estoque: Number(novo.quantidade_estoque),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Erro ao cadastrar sabor.');
      setNovo(NOVO_VAZIO);
      setMensagem(`Sabor "${data.nome}" adicionado com sucesso!`);
      setProdutos((atual) => [...atual, data]);
      setEstoques((atual) => ({ ...atual, [data.id_produto]: String(data.quantidade_estoque) }));
    } catch (err) {
      setErro(err.message);
    }
  }

  async function salvarEstoque(id_produto) {
    setErro('');
    setMensagem('');
    const qtd = Number(estoques[id_produto]);
    try {
      const r = await fetch(`/api/produtos/${id_produto}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantidade_estoque: qtd }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Erro ao atualizar estoque.');
      setProdutos((atual) => atual.map((p) => (p.id_produto === id_produto ? data : p)));
      setEstoques((atual) => ({ ...atual, [id_produto]: String(data.quantidade_estoque) }));
      setMensagem(`Estoque de "${data.nome}" atualizado para ${data.quantidade_estoque}.`);
    } catch (err) {
      setErro(err.message);
    }
  }

  // Soft Delete: altera apenas o booleano `ativo` (NUNCA executa DELETE)
  async function alternarAtivo(produto) {
    setErro('');
    setMensagem('');
    const novoAtivo = !produto.ativo;
    try {
      const r = await fetch(`/api/produtos/${produto.id_produto}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoAtivo }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Erro ao alterar status do sabor.');
      setProdutos((atual) => atual.map((p) => (p.id_produto === produto.id_produto ? data : p)));
      setMensagem(
        data.ativo
          ? `Sabor "${data.nome}" reativado na vitrine.`
          : `Sabor "${data.nome}" desativado da vitrine.`
      );
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <section>
      <h2>Gestão de Produtos (Cardápio e Estoque)</h2>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {mensagem && <p className="ok" role="status">{mensagem}</p>}

      <form onSubmit={adicionarSabor} style={{ marginBottom: 24 }}>
        <h3>Adicionar Novo Sabor</h3>
        <label htmlFor="novo-nome">Nome do sabor</label>
        <input
          id="novo-nome"
          placeholder="Ex.: Baunilha com Morango"
          value={novo.nome}
          onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          required
        />
        <label htmlFor="novo-descricao">Descrição</label>
        <input
          id="novo-descricao"
          placeholder="Descrição do cupcake"
          value={novo.descricao}
          onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
        />
        <label htmlFor="novo-preco">Preço (R$)</label>
        <input
          id="novo-preco"
          type="number"
          step="0.01"
          min="0"
          placeholder="Ex.: 14.50"
          value={novo.preco}
          onChange={(e) => setNovo({ ...novo, preco: e.target.value })}
          required
        />
        <label htmlFor="novo-estoque">Estoque inicial</label>
        <input
          id="novo-estoque"
          type="number"
          min="0"
          value={novo.quantidade_estoque}
          onChange={(e) => setNovo({ ...novo, quantidade_estoque: e.target.value })}
          required
        />
        <button type="submit">Adicionar sabor</button>
      </form>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Sabor</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Status Vitrine</th>
            <th>Soft Delete</th>
          </tr>
        </thead>
        <tbody>
          {produtos.map((p) => (
            <tr key={p.id_produto} style={{ opacity: p.ativo ? 1 : 0.6 }}>
              <td>{p.id_produto}</td>
              <td>
                <strong>{p.nome}</strong>
                {p.descricao && <><br /><small>{p.descricao}</small></>}
              </td>
              <td>{formatBRL(p.preco)}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  aria-label={`Estoque de ${p.nome}`}
                  value={estoques[p.id_produto] ?? p.quantidade_estoque}
                  onChange={(e) => setEstoques({ ...estoques, [p.id_produto]: e.target.value })}
                  style={{ width: 80, marginRight: 6 }}
                />
                <button
                  type="button"
                  className="sec"
                  onClick={() => salvarEstoque(p.id_produto)}
                  aria-label={`Salvar estoque de ${p.nome}`}
                >
                  Salvar estoque
                </button>
              </td>
              <td>
                <span className="status">{p.ativo ? 'Ativo' : 'Desativado'}</span>
              </td>
              <td>
                <button
                  type="button"
                  className={p.ativo ? 'sec' : ''}
                  onClick={() => alternarAtivo(p)}
                >
                  {p.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

