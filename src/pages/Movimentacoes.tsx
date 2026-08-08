import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  Receipt,
  X,
} from '@phosphor-icons/react';
import FinanceNav from '../components/FinanceNav';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, formatDate, parseMoney, todayISO } from '../lib/format';
import { formaPagamentoLabel, obterMovimentacoesFinanceiras, obterVendas } from '../lib/movements';
import type { FormaPagamento } from '../types';

export type ModoMovimentacoes = 'todas' | 'vendas' | 'entradas' | 'saidas';

const configuracao = {
  todas: {
    titulo: 'Movimentações',
    subtitulo: 'Todas as entradas e saídas efetivadas no caixa.',
    vazio: 'Nenhuma movimentação encontrada.',
  },
  vendas: {
    titulo: 'Vendas',
    subtitulo: 'Pesquise vendas e filtre por período ou forma de pagamento.',
    vazio: 'Nenhuma venda encontrada.',
  },
  entradas: {
    titulo: 'Entradas',
    subtitulo: 'Vendas recebidas, pagamentos de fiado e outras entradas.',
    vazio: 'Nenhuma entrada encontrada.',
  },
  saidas: {
    titulo: 'Saídas e despesas',
    subtitulo: 'Despesas pagas e demais valores que saíram do caixa.',
    vazio: 'Nenhuma saída encontrada.',
  },
} satisfies Record<ModoMovimentacoes, { titulo: string; subtitulo: string; vazio: string }>;

export default function Movimentacoes({ modo }: { modo: ModoMovimentacoes }) {
  const { data, addLancamentoManual } = useAppData();
  const [busca, setBusca] = useState('');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'todas' | FormaPagamento>('todas');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataLancamento, setDataLancamento] = useState(todayISO());
  const texto = configuracao[modo];

  const movimentacoes = useMemo(() => {
    const base = modo === 'vendas' ? obterVendas(data) : obterMovimentacoesFinanceiras(data);
    const porTipo =
      modo === 'entradas'
        ? base.filter((movimento) => movimento.tipo === 'entrada')
        : modo === 'saidas'
          ? base.filter((movimento) => movimento.tipo === 'saida')
          : base;
    const termo = busca.trim().toLocaleLowerCase('pt-BR');

    return porTipo.filter((movimento) => {
      const correspondeBusca =
        !termo || `${movimento.descricao} ${movimento.detalhe}`.toLocaleLowerCase('pt-BR').includes(termo);
      const correspondeInicio = !dataInicial || movimento.data >= dataInicial;
      const correspondeFim = !dataFinal || movimento.data <= dataFinal;
      const correspondePagamento =
        modo !== 'vendas' || formaPagamento === 'todas' || movimento.formaPagamento === formaPagamento;
      return correspondeBusca && correspondeInicio && correspondeFim && correspondePagamento;
    });
  }, [busca, data, dataFinal, dataInicial, formaPagamento, modo]);

  const total = movimentacoes.reduce(
    (soma, movimento) => soma + (modo === 'todas' && movimento.tipo === 'saida' ? -movimento.valor : movimento.valor),
    0,
  );

  const limparFiltros = () => {
    setBusca('');
    setDataInicial('');
    setDataFinal('');
    setFormaPagamento('todas');
  };

  const salvarLancamento = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (modo !== 'entradas' && modo !== 'saidas') return;
    const valorNumerico = parseMoney(valor);
    if (!descricao.trim() || valorNumerico <= 0) return;

    addLancamentoManual({
      tipo: modo === 'entradas' ? 'entrada' : 'saida',
      descricao: descricao.trim(),
      valor: valorNumerico,
      data: dataLancamento,
    });
    setDescricao('');
    setValor('');
    setDataLancamento(todayISO());
  };

  const filtrosAtivos = Boolean(busca || dataInicial || dataFinal || formaPagamento !== 'todas');

  return (
    <div className="fade-in">
      <div className="mb-4">
        <h2 className="font-display text-2xl font-bold text-ink">{texto.titulo}</h2>
        <p className="mt-1 text-sm text-ink-soft">{texto.subtitulo}</p>
      </div>

      <FinanceNav />

      {(modo === 'entradas' || modo === 'saidas') && (
        <form
          onSubmit={salvarLancamento}
          className="mb-6 rounded-2xl border border-line bg-paper-raised p-4 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full ${
                modo === 'entradas' ? 'bg-ledger/10 text-ledger-strong dark:text-ledger' : 'bg-stamp/10 text-stamp'
              }`}
            >
              <Plus size={18} weight="bold" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Registrar {modo === 'entradas' ? 'entrada' : 'saída'}</h3>
              <p className="text-xs text-ink-soft">O lançamento entra no histórico na data informada.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_140px_150px_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Descrição</span>
              <input
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
                required
                placeholder={modo === 'entradas' ? 'Ex: Serviço realizado' : 'Ex: Compra de material'}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Valor</span>
              <input
                value={valor}
                onChange={(event) => setValor(event.target.value)}
                required
                inputMode="decimal"
                placeholder="0,00"
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 font-ledger text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">Data</span>
              <input
                type="date"
                value={dataLancamento}
                onChange={(event) => setDataLancamento(event.target.value)}
                required
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </label>
            <button
              type="submit"
              className={`rounded-xl px-4 py-2.5 text-sm font-bold text-paper transition ${
                modo === 'entradas' ? 'bg-ledger hover:bg-ledger-strong' : 'bg-stamp hover:bg-stamp/90'
              }`}
            >
              Salvar
            </button>
          </div>
        </form>
      )}

      <section className="mb-4 rounded-2xl border border-line bg-paper-raised p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-ink-soft">
          <FunnelSimple size={17} />
          <h3 className="text-xs font-bold uppercase tracking-wide">Pesquisar e filtrar</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="relative block lg:col-span-2">
            <MagnifyingGlass size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar por nome ou descrição"
              className="w-full rounded-xl border border-line bg-paper py-2.5 pl-10 pr-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </label>
          <label className="block">
            <span className="sr-only">Data inicial</span>
            <input
              type="date"
              value={dataInicial}
              onChange={(event) => setDataInicial(event.target.value)}
              aria-label="Data inicial"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </label>
          <label className="block">
            <span className="sr-only">Data final</span>
            <input
              type="date"
              value={dataFinal}
              onChange={(event) => setDataFinal(event.target.value)}
              aria-label="Data final"
              className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </label>
          {modo === 'vendas' && (
            <select
              value={formaPagamento}
              onChange={(event) => setFormaPagamento(event.target.value as 'todas' | FormaPagamento)}
              aria-label="Forma de pagamento"
              className="rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30 md:col-span-2 lg:col-span-1"
            >
              <option value="todas">Todas as formas</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="cartao_debito">Cartão de débito</option>
              <option value="fiado">Fiado</option>
            </select>
          )}
        </div>
        {filtrosAtivos && (
          <button onClick={limparFiltros} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink">
            <X size={14} /> Limpar filtros
          </button>
        )}
      </section>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{movimentacoes.length} registro(s)</p>
          <p className="text-xs text-ink-soft">Mais recentes primeiro</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            {modo === 'todas' ? 'Saldo filtrado' : 'Total filtrado'}
          </p>
          <p className={`font-ledger text-xl font-bold tabular-nums ${modo === 'saidas' ? 'text-stamp' : 'text-ledger-strong dark:text-ledger'}`}>
            {formatCurrency(total)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-sm">
        {movimentacoes.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-line/40 text-ink-soft">
              <Receipt size={23} />
            </div>
            <p className="text-sm font-medium text-ink">{texto.vazio}</p>
            <p className="mt-1 text-xs text-ink-soft">Altere os filtros ou registre um novo lançamento.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {movimentacoes.map((movimento) => {
              const isSaida = movimento.tipo === 'saida';
              const fiadoPendente = Boolean(movimento.fiadoPendente);
              return (
                <li key={`${movimento.origem}-${movimento.id}`} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isSaida
                          ? 'bg-stamp/10 text-stamp'
                          : fiadoPendente
                            ? 'bg-brass/10 text-brass'
                            : 'bg-ledger/10 text-ledger-strong dark:text-ledger'
                      }`}
                    >
                      {isSaida ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{movimento.descricao}</p>
                      <p className={`truncate text-xs ${fiadoPendente ? 'text-brass' : 'text-ink-soft'}`}>
                        {movimento.detalhe}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-ledger text-sm font-bold tabular-nums ${
                        isSaida ? 'text-stamp' : fiadoPendente ? 'text-brass' : 'text-ledger-strong dark:text-ledger'
                      }`}
                    >
                      {isSaida ? '- ' : fiadoPendente ? '' : '+ '}
                      {formatCurrency(movimento.valor)}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-soft">{formatDate(movimento.data)}</p>
                    {modo === 'vendas' && movimento.formaPagamento && !fiadoPendente && (
                      <p className="mt-0.5 text-[10px] text-ink-soft">{formaPagamentoLabel(movimento.formaPagamento)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
