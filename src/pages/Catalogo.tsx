import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Package, Plus, WarningCircle, Wrench } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, parseMoney } from '../lib/format';
import Modal from '../components/Modal';
import type { Produto } from '../types';

type TipoFiltro = 'todos' | 'product' | 'service';
type Filtro = 'todos' | 'baixo' | string;

export default function Catalogo() {
  const { data, addProduto, atualizarProduto, removerProduto } = useAppData();
  const oferta = data.config?.oferta ?? 'ambos';
  const tipoPadrao = oferta === 'produtos' ? 'product' : oferta === 'servicos' ? 'service' : 'product';
  const permiteTrocarTipo = oferta === 'ambos';

  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [confirmarRemocaoAberto, setConfirmarRemocaoAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [itemType, setItemType] = useState<'product' | 'service'>(tipoPadrao);
  const [produtoParaRemover, setProdutoParaRemover] = useState<Produto | null>(null);

  useEffect(() => {
    setItemType(tipoPadrao);
  }, [tipoPadrao]);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    data.produtos.forEach((item) => {
      if (item.categoria) set.add(item.categoria);
    });
    return Array.from(set);
  }, [data.produtos]);

  const itensFiltrados = useMemo(() => {
    return data.produtos.filter((item) => {
      if (tipoFiltro === 'product' && item.type !== 'product') return false;
      if (tipoFiltro === 'service' && item.type !== 'service') return false;
      if (filtro === 'baixo') {
        return item.type === 'product' && (item.quantidade ?? 0) <= (item.quantidadeMinima ?? 0);
      }
      if (filtro !== 'todos' && item.categoria !== filtro) return false;
      if (!busca.trim()) return true;
      return item.nome.toLowerCase().includes(busca.trim().toLowerCase());
    });
  }, [data.produtos, tipoFiltro, filtro, busca]);

  const abrirNovo = () => {
    setProdutoEditando(null);
    setItemType(tipoPadrao);
    setModalAberto(true);
  };

  const abrirEdicao = (produto: Produto) => {
    setProdutoEditando(produto);
    setItemType(produto.type);
    setModalAberto(true);
  };

  const abrirConfirmarRemocao = (produto: Produto) => {
    setProdutoParaRemover(produto);
    setConfirmarRemocaoAberto(true);
  };

  const fecharConfirmarRemocao = () => {
    setProdutoParaRemover(null);
    setConfirmarRemocaoAberto(false);
  };

  const confirmarRemocao = () => {
    if (!produtoParaRemover) return;
    removerProduto(produtoParaRemover.id);
    fecharConfirmarRemocao();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nome = String(form.get('nome') ?? '').trim();
    const precoVenda = parseMoney(String(form.get('precoVenda') ?? '0'));
    const custoRaw = String(form.get('custo') ?? '').trim();
    const custo = custoRaw ? parseMoney(custoRaw) : undefined;
    const categoriaRaw = String(form.get('categoria') ?? '').trim();
    const categoria = categoriaRaw || undefined;

    if (!nome || precoVenda <= 0) return;

    if (itemType === 'product') {
      const quantidade = Math.max(0, Number(form.get('quantidade') ?? 0));
      const quantidadeMinima = Math.max(0, Number(form.get('quantidadeMinima') ?? 0));
      const payload: Omit<Produto, 'id'> = {
        type: 'product',
        nome,
        precoVenda,
        categoria,
        custo,
        quantidade,
        quantidadeMinima,
      };

      if (produtoEditando) {
        atualizarProduto(produtoEditando.id, payload);
      } else {
        addProduto(payload);
      }
    } else {
      const duracao = String(form.get('duracao') ?? '').trim();
      if (!duracao) return;
      const payload: Omit<Produto, 'id'> = {
        type: 'service',
        nome,
        precoVenda,
        categoria,
        custo,
        duracao,
      };

      if (produtoEditando) {
        atualizarProduto(produtoEditando.id, payload);
      } else {
        addProduto(payload);
      }
    }

    setModalAberto(false);
    setProdutoEditando(null);
  };

  const quantidadeBaixa = (item: Produto) => {
    return item.type === 'product' && (item.quantidade ?? 0) <= (item.quantidadeMinima ?? 0);
  };

  return (
    <div className="fade-in">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Catálogo</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie produtos e serviços com o mesmo visual do app.</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome..."
            className="w-full rounded-2xl border border-gray-200 bg-white px-10 py-3 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTipoFiltro('todos')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tipoFiltro === 'todos'
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setTipoFiltro('product')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tipoFiltro === 'product'
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            Produtos
          </button>
          <button
            onClick={() => setTipoFiltro('service')}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tipoFiltro === 'service'
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            Serviços
          </button>
        </div>
      </div>

      <div className="scrollbar-hide mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <button
          onClick={() => setFiltro('todos')}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
            filtro === 'todos'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFiltro('baixo')}
          className={`flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
            filtro === 'baixo'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-red-500" /> Estoque baixo
        </button>
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltro(cat)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${
              filtro === cat
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {itensFiltrados.length === 0 ? (
        data.produtos.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400">
              <Package size={24} />
            </div>
            <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-300">Nenhum item cadastrado ainda.</p>
            <p className="mb-4 text-xs text-gray-400">Cadastre produtos ou serviços para começar.</p>
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus size={16} /> Cadastrar item
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <p className="text-sm font-medium">Nenhum item encontrado.</p>
            <p className="text-xs">Tente outro filtro ou palavra-chave.</p>
          </div>
        )
      ) : (
        <div className="space-y-3">
          {itensFiltrados.map((item) => {
            const baixo = quantidadeBaixa(item);
            return (
              <div
                key={item.id}
                className={`flex flex-col gap-4 rounded-2xl border p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${
                  baixo ? 'border-red-200 bg-red-50/50 dark:border-red-900/50' : 'border-gray-100 bg-white'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-blue-700 dark:bg-gray-700 dark:text-blue-300">
                      {item.type === 'product' ? <Package size={24} /> : <Wrench size={24} />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{item.nome}</h3>
                        {item.categoria && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold uppercase text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                            {item.categoria}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Preço: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(item.precoVenda)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.type === 'product' ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${baixo ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {item.quantidade ?? 0} em estoque
                        </span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          Serviço • {item.duracao ?? '—'}
                        </span>
                      )}
                      {baixo && (
                        <span className="rounded-full bg-red-200 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/50 dark:text-red-300">
                          <WarningCircle size={12} /> Estoque baixo
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => abrirEdicao(item)}
                        className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => abrirConfirmarRemocao(item)}
                        className="rounded-full border border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={produtoEditando ? 'Editar item' : 'Novo item'}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!permiteTrocarTipo || tipoPadrao === 'service'}
                onClick={() => setItemType('product')}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  itemType === 'product'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                } ${!permiteTrocarTipo && tipoPadrao !== 'product' ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Produto
              </button>
              <button
                type="button"
                disabled={!permiteTrocarTipo || tipoPadrao === 'product'}
                onClick={() => setItemType('service')}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  itemType === 'service'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                } ${!permiteTrocarTipo && tipoPadrao !== 'service' ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Serviço
              </button>
            </div>
            {!permiteTrocarTipo && (
              <p className="mt-2 text-xs text-gray-500">O tipo está bloqueado pela configuração do negócio.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Nome</label>
            <input
              name="nome"
              type="text"
              defaultValue={produtoEditando?.nome}
              placeholder="Ex: Refrigerante / Corte de Cabelo"
              className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Categoria (opcional)</label>
              <input
                name="categoria"
                type="text"
                defaultValue={produtoEditando?.categoria}
                placeholder="Ex: Bebidas"
                className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Preço de Venda</label>
              <input
                name="precoVenda"
                type="text"
                inputMode="decimal"
                defaultValue={produtoEditando?.precoVenda}
                placeholder="Ex: 25,00"
                className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Custo (opcional)</label>
            <input
              name="custo"
              type="text"
              inputMode="decimal"
              defaultValue={produtoEditando?.custo}
              placeholder="Ex: 12,00"
              className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {itemType === 'product' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Quantidade</label>
                <input
                  name="quantidade"
                  type="number"
                  min="0"
                  defaultValue={produtoEditando?.quantidade ?? 0}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Estoque mínimo</label>
                <input
                  name="quantidadeMinima"
                  type="number"
                  min="0"
                  defaultValue={produtoEditando?.quantidadeMinima ?? 0}
                  className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Duração estimada</label>
              <input
                name="duracao"
                type="text"
                defaultValue={produtoEditando?.duracao}
                placeholder="Ex: 30 min"
                className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
            Salvar
          </button>
        </form>
      </Modal>

      <Modal open={confirmarRemocaoAberto} onClose={fecharConfirmarRemocao} title="Confirmar exclusão">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Tem certeza que deseja remover <span className="font-semibold text-gray-900 dark:text-white">{produtoParaRemover?.nome}</span> do catálogo? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={fecharConfirmarRemocao}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarRemocao}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
