import { useMemo, useState, type FormEvent } from 'react';
import { Package, Plus, WarningCircle } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, parseMoney } from '../lib/format';
import Modal from '../components/Modal';
import type { Produto } from '../types';

type Filtro = 'todos' | 'baixo' | string;

export default function Estoque() {
  const { data, addProduto, atualizarProduto } = useAppData();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    data.produtos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set);
  }, [data.produtos]);

  const produtosFiltrados = useMemo(() => {
    if (filtro === 'todos') return data.produtos;
    if (filtro === 'baixo') return data.produtos.filter((p) => p.quantidade <= p.quantidadeMinima);
    return data.produtos.filter((p) => p.categoria === filtro);
  }, [data.produtos, filtro]);

  const abrirNovo = () => {
    setProdutoEditando(null);
    setModalAberto(true);
  };

  const abrirEdicao = (produto: Produto) => {
    setProdutoEditando(produto);
    setModalAberto(true);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nome = String(form.get('nome') ?? '').trim();
    const precoVenda = parseMoney(String(form.get('precoVenda') ?? '0'));
    const custoRaw = String(form.get('custo') ?? '').trim();
    const custo = custoRaw ? parseMoney(custoRaw) : undefined;
    const quantidade = Math.max(0, Number(form.get('quantidade') ?? 0));
    const quantidadeMinima = Math.max(0, Number(form.get('quantidadeMinima') ?? 0));
    const categoriaRaw = String(form.get('categoria') ?? '').trim();
    const categoria = categoriaRaw || undefined;

    if (!nome || precoVenda <= 0) return;

    if (produtoEditando) {
      atualizarProduto(produtoEditando.id, { nome, precoVenda, custo, quantidade, quantidadeMinima, categoria });
    } else {
      addProduto({ nome, precoVenda, custo, quantidade, quantidadeMinima, categoria });
    }

    setModalAberto(false);
    setProdutoEditando(null);
  };

  return (
    <div className="fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Estoque</h2>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="scrollbar-hide mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <button
          onClick={() => setFiltro('todos')}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
            filtro === 'todos'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFiltro('baixo')}
          className={`flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
            filtro === 'baixo'
              ? 'bg-blue-600 text-white'
              : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          <div className="h-2 w-2 rounded-full bg-red-500" /> Baixo
        </button>
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltro(cat)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
              filtro === cat
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {produtosFiltrados.length === 0 &&
          (data.produtos.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 py-10 text-center dark:border-gray-700">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400">
                <Package size={24} />
              </div>
              <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-300">
                Nenhum produto cadastrado ainda
              </p>
              <p className="mb-4 text-xs text-gray-400">Cadastre seu primeiro produto para controlar o estoque.</p>
              <button
                onClick={abrirNovo}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} /> Cadastrar Produto
              </button>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum produto encontrado com esse filtro.</p>
          ))}
        {produtosFiltrados.map((produto) => {
          const baixo = produto.quantidade <= produto.quantidadeMinima;
          return (
            <div
              key={produto.id}
              className={`flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-800 ${
                baixo ? 'border-red-200 dark:border-red-900/50' : 'border-gray-100 dark:border-gray-700'
              }`}
            >
              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-100">{produto.nome}</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Preço: {formatCurrency(produto.precoVenda)}
                </p>
              </div>
              <div className="flex flex-col items-end text-right">
                <div
                  className={`mb-1 flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold ${
                    baixo
                      ? 'border-red-200 bg-red-100 text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400'
                      : 'border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {baixo && <WarningCircle size={14} weight="fill" />}
                  {produto.quantidade} un
                </div>
                <button
                  onClick={() => abrirEdicao(produto)}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Atualizar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={produtoEditando ? 'Atualizar Produto' : 'Novo Produto'}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Nome do Produto</label>
            <input
              name="nome"
              type="text"
              required
              defaultValue={produtoEditando?.nome}
              placeholder="Ex: Coca-Cola 2L"
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Categoria (opcional)</label>
            <input
              name="categoria"
              type="text"
              defaultValue={produtoEditando?.categoria}
              placeholder="Ex: Bebidas"
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Preço Venda</label>
              <input
                name="precoVenda"
                type="text"
                inputMode="decimal"
                required
                defaultValue={produtoEditando?.precoVenda}
                placeholder="Ex: 9,90"
                className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Custo (Opcional)</label>
              <input
                name="custo"
                type="text"
                inputMode="decimal"
                defaultValue={produtoEditando?.custo}
                placeholder="Ex: 5,00"
                className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Qtd Atual</label>
              <input
                name="quantidade"
                type="number"
                defaultValue={produtoEditando?.quantidade ?? 0}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Estoque Mín.</label>
              <input
                name="quantidadeMinima"
                type="number"
                defaultValue={produtoEditando?.quantidadeMinima ?? 0}
                placeholder="Avisar em..."
                className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button type="submit" className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 font-bold text-white">
            Salvar Produto
          </button>
        </form>
      </Modal>
    </div>
  );
}
