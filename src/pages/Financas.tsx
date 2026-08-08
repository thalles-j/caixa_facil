import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Lightning,
  House,
  Receipt,
  Users,
  HandCoins,
  WarningCircle,
  PencilSimple,
  Trash,
} from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, formatDate, parseMoney, todayISO } from '../lib/format';
import Modal from '../components/Modal';
import type { Conta, LancamentoManual, TipoConta } from '../types';
import FinanceNav from '../components/FinanceNav';

type ItemParaExcluir = { tipo: 'conta' | 'lancamento'; id: string; label: string };

export default function Financas() {
  const { data, addConta, editarConta, removerConta, marcarContaQuitada, addLancamentoManual, editarLancamentoManual, removerLancamentoManual } =
    useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const aba: TipoConta = searchParams.get('tab') === 'receber' ? 'receber' : 'pagar';
  const [modalAberto, setModalAberto] = useState(false);
  const [entradaModalAberto, setEntradaModalAberto] = useState(false);
  const [entradaDescricao, setEntradaDescricao] = useState('');
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaData, setEntradaData] = useState(todayISO());
  const [contaEditando, setContaEditando] = useState<Conta | null>(null);
  const [lancamentoEditando, setLancamentoEditando] = useState<LancamentoManual | null>(null);
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemParaExcluir | null>(null);

  const mesAtual = todayISO().slice(0, 7);

  const clientesPorId = useMemo(() => {
    const map = new Map<string, string>();
    data.clientes.forEach((c) => map.set(c.id, c.nome));
    return map;
  }, [data.clientes]);

  const contasDaAba = useMemo(
    () => data.contas.filter((c) => c.tipo === aba).sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [data.contas, aba],
  );

  const lancamentosDaAba = useMemo(
    () =>
      data.lancamentosManuais
        .filter((l) => (aba === 'pagar' ? l.tipo === 'saida' : l.tipo === 'entrada'))
        .sort((a, b) => b.data.localeCompare(a.data)),
    [data.lancamentosManuais, aba],
  );

  const totalMes = useMemo(
    () =>
      contasDaAba
        .filter((c) => c.vencimento.slice(0, 7) === mesAtual)
        .reduce((sum, c) => sum + c.valor, 0),
    [contasDaAba, mesAtual],
  );

  const saldoPorCliente = useMemo(() => {
    if (aba !== 'receber') return [];
    const mapa = new Map<string, { nome: string; total: number }>();
    data.contas
      .filter((c) => c.tipo === 'receber' && !c.quitado && c.clienteId)
      .forEach((c) => {
        const nome = clientesPorId.get(c.clienteId!) ?? 'Cliente';
        const atual = mapa.get(c.clienteId!) ?? { nome, total: 0 };
        atual.total += c.valor;
        mapa.set(c.clienteId!, atual);
      });
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [aba, data.contas, clientesPorId]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const descricao = String(form.get('descricao') ?? '').trim();
    const valor = parseMoney(String(form.get('valor') ?? '0'));
    const vencimento = String(form.get('vencimento') ?? todayISO());

    if (!descricao || valor <= 0) return;

    addConta({ tipo: 'pagar', descricao, valor, vencimento });
    setModalAberto(false);
  };

  const handleEntradaSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valor = parseMoney(entradaValor);

    if (!entradaDescricao.trim() || valor <= 0) return;

    addLancamentoManual({
      tipo: 'entrada',
      descricao: entradaDescricao.trim(),
      valor,
      data: entradaData,
    });
    setEntradaModalAberto(false);
    setEntradaDescricao('');
    setEntradaValor('');
    setEntradaData(todayISO());
  };

  const handleEditarContaSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contaEditando) return;
    const form = new FormData(e.currentTarget);
    const descricao = String(form.get('descricao') ?? '').trim();
    const valor = parseMoney(String(form.get('valor') ?? '0'));
    const vencimento = String(form.get('vencimento') ?? contaEditando.vencimento);

    if (!descricao || valor <= 0) return;

    editarConta(contaEditando.id, { descricao, valor, vencimento });
    setContaEditando(null);
  };

  const handleEditarLancamentoSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!lancamentoEditando) return;
    const form = new FormData(e.currentTarget);
    const descricao = String(form.get('descricao') ?? '').trim();
    const valor = parseMoney(String(form.get('valor') ?? '0'));
    const data_ = String(form.get('data') ?? lancamentoEditando.data);

    if (!descricao || valor <= 0) return;

    editarLancamentoManual(lancamentoEditando.id, { descricao, valor, data: data_ });
    setLancamentoEditando(null);
  };

  const confirmarExclusao = () => {
    if (!itemParaExcluir) return;
    if (itemParaExcluir.tipo === 'conta') {
      removerConta(itemParaExcluir.id);
    } else {
      removerLancamentoManual(itemParaExcluir.id);
    }
    setItemParaExcluir(null);
  };

  const hoje = todayISO();
  const mostrarPainelClientes = aba === 'receber' && saldoPorCliente.length > 0;

  return (
    <div className="fade-in">
      <h2 className="mb-4 font-display text-xl font-bold">Financeiro</h2>

      <FinanceNav />

      <div className="mb-6 flex rounded-xl bg-line/40 p-1">
        <Link
          to="/financas?tab=pagar"
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            aba === 'pagar' ? 'bg-paper-raised text-ink shadow-sm' : 'text-ink-soft'
          } text-center`}
        >
          A Pagar
        </Link>
        <Link
          to="/financas?tab=receber"
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            aba === 'receber' ? 'bg-paper-raised text-ink shadow-sm' : 'text-ink-soft'
          } text-center`}
        >
          A Receber (Fiado)
        </Link>
      </div>

      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Total {aba === 'pagar' ? 'a Pagar' : 'a Receber'} (Mês)
          </p>
          <p className={`font-ledger text-2xl font-bold tabular-nums ${aba === 'pagar' ? 'text-stamp' : 'text-brass'}`}>
            {formatCurrency(totalMes)}
          </p>
        </div>
        {aba === 'pagar' ? (
          <button
            onClick={() => setModalAberto(true)}
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-ledger-strong dark:text-ledger"
          >
            <Plus size={16} /> Despesa
          </button>
        ) : (
          <button
            onClick={() => setEntradaModalAberto(true)}
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-ledger-strong dark:text-ledger"
          >
            <Plus size={16} /> Entrada
          </button>
        )}
      </div>

      <div className={mostrarPainelClientes ? 'lg:grid lg:grid-cols-3 lg:items-start lg:gap-6' : ''}>
        <div className={mostrarPainelClientes ? 'min-w-0 lg:col-span-2' : 'min-w-0'}>
          <div className="overflow-hidden rounded-2xl border border-line bg-paper-raised shadow-sm">
            {contasDaAba.length === 0 && lancamentosDaAba.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${aba === 'pagar' ? 'bg-stamp/10 text-stamp' : 'bg-brass/10 text-brass'}`}>
                  {aba === 'pagar' ? <Receipt size={24} /> : <HandCoins size={24} />}
                </div>
                <p className="mb-1 text-sm font-medium text-ink">
                  {aba === 'pagar' ? 'Nenhuma conta a pagar cadastrada' : 'Nenhuma entrada registrada para hoje'}
                </p>
                <p className="mb-4 text-xs text-ink-soft">
                  {aba === 'pagar'
                    ? 'Cadastre uma despesa para acompanhar seus pagamentos.'
                    : 'Registre entradas manuais ou use o Caixa para vendas fiado.'}
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => (aba === 'pagar' ? setModalAberto(true) : setEntradaModalAberto(true))}
                    className="flex items-center justify-center gap-1 rounded-lg bg-ledger px-4 py-2 text-sm font-medium text-paper"
                  >
                    <Plus size={16} /> {aba === 'pagar' ? 'Nova Despesa' : 'Nova Entrada'}
                  </button>
                  {aba === 'receber' && (
                    <button
                      onClick={() => navigate('/caixa')}
                      className="flex items-center justify-center gap-1 rounded-lg border border-ledger px-4 py-2 text-sm font-medium text-ledger-strong dark:text-ledger"
                    >
                      <HandCoins size={16} /> Ir para o Caixa
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {contasDaAba.map((conta) => {
                  const venceHoje = conta.vencimento === hoje && !conta.quitado;
                  const atrasada = !conta.quitado && conta.vencimento < hoje;
                  const nomeCliente = conta.clienteId ? clientesPorId.get(conta.clienteId) : undefined;
                  return (
                    <li
                      key={conta.id}
                      className={`flex items-center justify-between gap-3 p-4 ${conta.quitado ? 'opacity-60' : ''} ${
                        atrasada ? 'bg-stamp/5' : ''
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={`shrink-0 rounded-lg p-2 ${
                            conta.quitado
                              ? 'bg-line/40 text-ink-soft'
                              : atrasada
                              ? 'bg-stamp/15 text-stamp'
                              : 'bg-stamp/10 text-stamp'
                          }`}
                        >
                          {atrasada ? (
                            <WarningCircle size={20} weight="fill" />
                          ) : conta.origemVendaId ? (
                            <Receipt size={20} />
                          ) : conta.quitado ? (
                            <House size={20} />
                          ) : (
                            <Lightning size={20} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`truncate font-medium text-ink ${conta.quitado ? 'line-through' : ''}`}>
                            {nomeCliente ?? conta.descricao}
                          </p>
                          {nomeCliente && <p className="truncate text-[11px] text-ink-soft">{conta.descricao}</p>}
                          <div className="mt-1">
                            {conta.quitado ? (
                              <span className="stamp text-ledger-strong dark:text-ledger">
                                Pago {formatDate(conta.dataQuitacao ?? conta.vencimento)}
                              </span>
                            ) : atrasada ? (
                              <span className="stamp text-stamp">Atrasada</span>
                            ) : venceHoje ? (
                              <span className="stamp text-stamp">Vence hoje</span>
                            ) : (
                              <span className="text-xs font-medium text-ink-soft">Vence em {formatDate(conta.vencimento)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                        <p className={`font-ledger font-bold tabular-nums text-ink ${conta.quitado ? 'text-ink-soft line-through' : ''}`}>
                          {formatCurrency(conta.valor)}
                        </p>
                        <div className="flex items-center gap-1">
                          {!conta.quitado && (
                            <button
                              onClick={() => marcarContaQuitada(conta.id)}
                              className="rounded bg-ledger/10 px-2 py-1 text-xs font-medium text-ledger-strong dark:text-ledger"
                            >
                              Dar Baixa
                            </button>
                          )}
                          <button
                            onClick={() => setContaEditando(conta)}
                            aria-label="Editar conta"
                            className="rounded p-1.5 text-ink-soft transition hover:bg-line/40 hover:text-ink"
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button
                            onClick={() => setItemParaExcluir({ tipo: 'conta', id: conta.id, label: conta.descricao })}
                            aria-label="Excluir conta"
                            className="rounded p-1.5 text-ink-soft transition hover:bg-stamp/10 hover:text-stamp"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
                {lancamentosDaAba.map((lanc) => (
                  <li key={lanc.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{lanc.descricao}</p>
                      <p className="truncate text-[11px] text-ink-soft">{formatDate(lanc.data)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p
                        className={`font-ledger text-sm font-bold tabular-nums ${
                          lanc.tipo === 'saida' ? 'text-stamp' : 'text-ledger-strong dark:text-ledger'
                        }`}
                      >
                        {lanc.tipo === 'saida' ? '-' : '+'} {formatCurrency(lanc.valor)}
                      </p>
                      <button
                        onClick={() => setLancamentoEditando(lanc)}
                        aria-label="Editar lançamento"
                        className="rounded p-1.5 text-ink-soft transition hover:bg-line/40 hover:text-ink"
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        onClick={() => setItemParaExcluir({ tipo: 'lancamento', id: lanc.id, label: lanc.descricao })}
                        aria-label="Excluir lançamento"
                        className="rounded p-1.5 text-ink-soft transition hover:bg-stamp/10 hover:text-stamp"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {mostrarPainelClientes && (
          <div className="mt-4 min-w-0 lg:sticky lg:top-20 lg:mt-0">
            <div className="rounded-2xl border border-line bg-paper-raised p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <Users size={16} className="text-ink-soft" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-soft">Por Cliente</h3>
              </div>
              <ul className="divide-y divide-line">
                {saldoPorCliente.map((c) => (
                  <li key={c.nome} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-ink">{c.nome}</span>
                    <span className="shrink-0 font-ledger font-bold tabular-nums text-brass">{formatCurrency(c.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Nova Despesa">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Descrição</label>
            <input
              name="descricao"
              type="text"
              required
              placeholder="Ex: Conta de Luz"
              className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Valor</label>
            <input
              name="valor"
              type="text"
              inputMode="decimal"
              required
              placeholder="Ex: 130,00"
              className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Vencimento</label>
            <input
              name="vencimento"
              type="date"
              required
              defaultValue={todayISO()}
              className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
          <button type="submit" className="mt-2 w-full rounded-lg bg-ledger py-2.5 font-bold text-paper transition hover:bg-ledger-strong">
            Salvar Despesa
          </button>
        </form>
      </Modal>

      <Modal open={entradaModalAberto} onClose={() => setEntradaModalAberto(false)} title="Nova Entrada">
        <form className="space-y-4" onSubmit={handleEntradaSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Descrição</label>
            <input
              value={entradaDescricao}
              onChange={(e) => setEntradaDescricao(e.target.value)}
              type="text"
              required
              placeholder="Ex: Venda avulsa"
              className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Valor</label>
            <input
              value={entradaValor}
              onChange={(e) => setEntradaValor(e.target.value)}
              type="text"
              inputMode="decimal"
              required
              placeholder="Ex: 130,00"
              className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Data</label>
            <input
              value={entradaData}
              onChange={(e) => setEntradaData(e.target.value)}
              type="date"
              required
              className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
          <button type="submit" className="mt-2 w-full rounded-lg bg-ledger py-2.5 font-bold text-paper transition hover:bg-ledger-strong">
            Salvar Entrada
          </button>
        </form>
      </Modal>

      <Modal open={contaEditando !== null} onClose={() => setContaEditando(null)} title="Editar Conta">
        {contaEditando && (
          <form className="space-y-4" onSubmit={handleEditarContaSubmit} key={contaEditando.id}>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Descrição</label>
              <input
                name="descricao"
                type="text"
                required
                defaultValue={contaEditando.descricao}
                className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Valor</label>
              <input
                name="valor"
                type="text"
                inputMode="decimal"
                required
                defaultValue={contaEditando.valor.toString().replace('.', ',')}
                className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Vencimento</label>
              <input
                name="vencimento"
                type="date"
                required
                defaultValue={contaEditando.vencimento}
                className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </div>
            <button type="submit" className="mt-2 w-full rounded-lg bg-ledger py-2.5 font-bold text-paper transition hover:bg-ledger-strong">
              Salvar Alterações
            </button>
          </form>
        )}
      </Modal>

      <Modal open={lancamentoEditando !== null} onClose={() => setLancamentoEditando(null)} title="Editar Lançamento">
        {lancamentoEditando && (
          <form className="space-y-4" onSubmit={handleEditarLancamentoSubmit} key={lancamentoEditando.id}>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Descrição</label>
              <input
                name="descricao"
                type="text"
                required
                defaultValue={lancamentoEditando.descricao}
                className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Valor</label>
              <input
                name="valor"
                type="text"
                inputMode="decimal"
                required
                defaultValue={lancamentoEditando.valor.toString().replace('.', ',')}
                className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Data</label>
              <input
                name="data"
                type="date"
                required
                defaultValue={lancamentoEditando.data}
                className="w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              />
            </div>
            <button type="submit" className="mt-2 w-full rounded-lg bg-ledger py-2.5 font-bold text-paper transition hover:bg-ledger-strong">
              Salvar Alterações
            </button>
          </form>
        )}
      </Modal>

      <Modal open={itemParaExcluir !== null} onClose={() => setItemParaExcluir(null)} title="Confirmar exclusão">
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Tem certeza que deseja excluir <span className="font-semibold text-ink">{itemParaExcluir?.label}</span>? Esta
            ação não pode ser desfeita.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setItemParaExcluir(null)}
              className="flex-1 rounded-lg border border-line bg-paper px-4 py-2 text-sm font-medium text-ink transition hover:bg-line/30"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarExclusao}
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
