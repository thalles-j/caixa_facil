import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MagnifyingGlass, Package, Plus, WarningCircle, Wrench } from '@phosphor-icons/react';
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
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">Catálogo</h2>
          <p className="truncate text-sm text-ink-soft">Gerencie produtos e serviços com o mesmo visual do app.</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-ledger/10 px-3 py-1.5 text-sm font-medium text-ledger-strong transition hover:bg-ledger/20 dark:text-ledger"
        >
          <Plus size={16} /> Novo
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por nome..."
            className="w-full rounded-2xl border border-line bg-paper-raised px-10 py-3 text-sm text-ink shadow-sm focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
          />
        </div>
        <div className="flex gap-2">
          {(['todos', 'product', 'service'] as TipoFiltro[]).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setTipoFiltro(tipo)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                tipoFiltro === tipo ? 'bg-ledger text-paper' : 'border border-line bg-paper-raised text-ink-soft'
              }`}
            >
              {tipo === 'todos' ? 'Todos' : tipo === 'product' ? 'Produtos' : 'Serviços'}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-hide mb-4 -mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
        <button
          onClick={() => setFiltro('todos')}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
            filtro === 'todos' ? 'bg-ledger text-paper' : 'border border-line bg-paper-raised text-ink-soft'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setFiltro('baixo')}
          className={`flex items-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
            filtro === 'baixo' ? 'bg-stamp text-paper' : 'border border-line bg-paper-raised text-ink-soft'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-current" /> Estoque baixo
        </button>
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltro(cat)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filtro === cat ? 'bg-ledger text-paper' : 'border border-line bg-paper-raised text-ink-soft'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {itensFiltrados.length === 0 ? (
        data.produtos.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-paper-raised p-8 text-center shadow-sm">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ledger/10 text-ledger-strong dark:text-ledger">
              <Package size={24} />
            </div>
            <p className="mb-1 text-sm font-medium text-ink">Nenhum item cadastrado ainda.</p>
            <p className="mb-4 text-xs text-ink-soft">Cadastre produtos ou serviços para começar.</p>
            <button
              onClick={abrirNovo}
              className="flex items-center gap-2 rounded-lg bg-ledger px-4 py-2 text-sm font-medium text-paper transition hover:bg-ledger-strong"
            >
              <Plus size={16} /> Cadastrar item
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-paper-raised p-8 text-center text-ink-soft shadow-sm">
            <p className="text-sm font-medium">Nenhum item encontrado.</p>
            <p className="text-xs">Tente outro filtro ou palavra-chave.</p>
          </div>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {itensFiltrados.map((item) => {
            const baixo = quantidadeBaixa(item);
            return (
              <div
                key={item.id}
                className={`flex min-w-0 flex-col justify-between gap-4 rounded-2xl border bg-paper-raised p-4 shadow-sm ${
                  baixo ? 'border-stamp/40' : 'border-line'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-line/40 text-ledger-strong dark:text-ledger">
                    {item.type === 'product' ? <Package size={22} /> : <Wrench size={22} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{item.nome}</h3>
                      {item.categoria && (
                        <span className="shrink-0 rounded-full bg-line/50 px-2 py-0.5 text-[11px] font-semibold uppercase text-ink-soft">
                          {item.categoria}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate font-ledger text-sm text-ink-soft">
                      {formatCurrency(item.precoVenda)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {item.type === 'product' ? (
                    <span className={`stamp ${baixo ? 'text-stamp' : 'text-ink-soft'}`}>
                      {item.quantidade ?? 0} em estoque
                    </span>
                  ) : (
                    <span className="stamp stamp-tilt-right text-ledger-strong dark:text-ledger">
                      {item.duracao ?? '—'}
                    </span>
                  )}
                  {baixo && (
                    <span className="stamp text-stamp">
                      <WarningCircle size={12} weight="fill" /> baixo
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => abrirEdicao(item)}
                    className="flex-1 rounded-full border border-ledger/30 bg-ledger/10 px-4 py-2 text-xs font-semibold text-ledger-strong transition hover:bg-ledger/20 dark:text-ledger"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => abrirConfirmarRemocao(item)}
                    className="flex-1 rounded-full border border-stamp/30 bg-stamp/10 px-4 py-2 text-xs font-semibold text-stamp transition hover:bg-stamp/20"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={produtoEditando ? 'Editar item' : 'Novo item'}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!permiteTrocarTipo || tipoPadrao === 'service'}
                onClick={() => setItemType('product')}
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  itemType === 'product'
                    ? 'border-ledger bg-ledger/10 text-ledger-strong dark:text-ledger'
                    : 'border-line bg-paper text-ink-soft hover:border-ink-soft'
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
                    ? 'border-ledger bg-ledger/10 text-ledger-strong dark:text-ledger'
                    : 'border-line bg-paper text-ink-soft hover:border-ink-soft'
                } ${!permiteTrocarTipo && tipoPadrao !== 'service' ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Serviço
              </button>
            </div>
            {!permiteTrocarTipo && (
              <p className="mt-2 text-xs text-ink-soft">O tipo está bloqueado pela configuração do negócio.</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Nome</label>
            <input
              name="nome"
              type="text"
              defaultValue={produtoEditando?.nome}
              placeholder="Ex: Refrigerante / Corte de Cabelo"
              className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Categoria (opcional)</label>
              <input
                name="categoria"
                type="text"
                defaultValue={produtoEditando?.categoria}
                placeholder="Ex: Bebidas"
                className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Preço de Venda</label>
              <input
                name="precoVenda"
                type="text"
                inputMode="decimal"
                defaultValue={produtoEditando?.precoVenda}
                placeholder="Ex: 25,00"
                className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Custo (opcional)</label>
            <input
              name="custo"
              type="text"
              inputMode="decimal"
              defaultValue={produtoEditando?.custo}
              placeholder="Ex: 12,00"
              className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>

          {itemType === 'product' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Quantidade</label>
                <input
                  name="quantidade"
                  type="number"
                  min="0"
                  defaultValue={produtoEditando?.quantidade ?? 0}
                  className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">Estoque mínimo</label>
                <input
                  name="quantidadeMinima"
                  type="number"
                  min="0"
                  defaultValue={produtoEditando?.quantidadeMinima ?? 0}
                  className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Duração estimada</label>
              <input
                name="duracao"
                type="text"
                defaultValue={produtoEditando?.duracao}
                placeholder="Ex: 30 min"
                className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
                required
              />
            </div>
          )}

          <button type="submit" className="w-full rounded-lg bg-ledger px-4 py-2 text-sm font-semibold text-paper transition hover:bg-ledger-strong">
            Salvar
          </button>
        </form>
      </Modal>

      <Modal open={confirmarRemocaoAberto} onClose={fecharConfirmarRemocao} title="Confirmar exclusão">
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Tem certeza que deseja remover <span className="font-semibold text-ink">{produtoParaRemover?.nome}</span> do
            catálogo? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={fecharConfirmarRemocao}
              className="flex-1 rounded-lg border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-line/30"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarRemocao}
              className="flex-1 rounded-lg bg-stamp px-4 py-2 text-sm font-semibold text-paper transition hover:bg-stamp/90"
            >
              Excluir
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
