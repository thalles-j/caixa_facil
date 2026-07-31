import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Lightning, House, Receipt, Users, HandCoins, WarningCircle } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, formatDate, parseMoney, todayISO } from '../lib/format';
import Modal from '../components/Modal';
import type { TipoConta } from '../types';

export default function Financas() {
  const { data, addConta, marcarContaQuitada, addLancamentoManual } = useAppData();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabInicial = searchParams.get('tab') === 'receber' ? 'receber' : searchParams.get('tab') === 'pagar' ? 'pagar' : null;
  const [aba, setAba] = useState<TipoConta>(tabInicial ?? 'pagar');
  const [modalAberto, setModalAberto] = useState(false);
  const [entradaModalAberto, setEntradaModalAberto] = useState(false);
  const [entradaDescricao, setEntradaDescricao] = useState('');
  const [entradaValor, setEntradaValor] = useState('');
  const [entradaData, setEntradaData] = useState(todayISO());

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

  const hoje = todayISO();

  return (
    <div className="fade-in">
      <h2 className="mb-4 text-xl font-bold text-gray-800 dark:text-gray-100">Financeiro</h2>

      <div className="mb-6 flex rounded-xl bg-gray-200 p-1 dark:bg-gray-700">
        <button
          onClick={() => setAba('pagar')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            aba === 'pagar' ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          A Pagar
        </button>
        <button
          onClick={() => setAba('receber')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
            aba === 'receber' ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          A Receber (Fiado)
        </button>
      </div>

      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Total {aba === 'pagar' ? 'a Pagar' : 'a Receber'} (Mês)
          </p>
          <p className={`text-2xl font-bold ${aba === 'pagar' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {formatCurrency(totalMes)}
          </p>
        </div>
        {aba === 'pagar' ? (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400"
          >
            <Plus size={16} /> Despesa
          </button>
        ) : (
          <button
            onClick={() => setEntradaModalAberto(true)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400"
          >
            <Plus size={16} /> Entrada
          </button>
        )}
      </div>

      {aba === 'receber' && saldoPorCliente.length > 0 && (
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 flex items-center gap-2">
            <Users size={16} className="text-gray-500 dark:text-gray-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Por Cliente
            </h3>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {saldoPorCliente.map((c) => (
              <li key={c.nome} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-gray-700 dark:text-gray-200">{c.nome}</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(c.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {contasDaAba.length === 0 && lancamentosDaAba.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div
              className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${
                aba === 'pagar'
                  ? 'bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-orange-50 text-orange-500 dark:bg-orange-900/30 dark:text-orange-400'
              }`}
            >
              {aba === 'pagar' ? <Receipt size={24} /> : <HandCoins size={24} />}
            </div>
            <p className="mb-1 text-sm font-medium text-gray-600 dark:text-gray-300">
              {aba === 'pagar' ? 'Nenhuma conta a pagar cadastrada' : 'Nenhuma entrada registrada para hoje'}
            </p>
            <p className="mb-4 text-xs text-gray-400">
              {aba === 'pagar'
                ? 'Cadastre uma despesa para acompanhar seus pagamentos.'
                : 'Registre entradas manuais ou use o Caixa para vendas fiado.'}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={() => (aba === 'pagar' ? setModalAberto(true) : setEntradaModalAberto(true))}
                className="flex items-center justify-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                <Plus size={16} /> {aba === 'pagar' ? 'Nova Despesa' : 'Nova Entrada'}
              </button>
              {aba === 'receber' && (
                <button
                  onClick={() => navigate('/caixa')}
                  className="flex items-center justify-center gap-1 rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-medium text-blue-600"
                >
                  <HandCoins size={16} /> Ir para o Caixa
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {contasDaAba.map((conta) => {
              const venceHoje = conta.vencimento === hoje && !conta.quitado;
              const atrasada = !conta.quitado && conta.vencimento < hoje;
              const nomeCliente = conta.clienteId ? clientesPorId.get(conta.clienteId) : undefined;
              return (
                <li
                  key={conta.id}
                  className={`flex items-center justify-between p-4 ${conta.quitado ? 'opacity-60' : ''} ${
                    atrasada ? 'bg-red-50/60 dark:bg-red-900/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        conta.quitado
                          ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          : atrasada
                          ? 'bg-red-200 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
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
                    <div>
                      <p className={`font-medium text-gray-800 dark:text-gray-100 ${conta.quitado ? 'line-through' : ''}`}>
                        {nomeCliente ?? conta.descricao}
                      </p>
                      {nomeCliente && (
                        <p className="text-[11px] text-gray-400">{conta.descricao}</p>
                      )}
                      <p
                        className={`text-xs font-bold ${
                          conta.quitado
                            ? 'font-medium text-green-600 dark:text-green-400'
                            : atrasada
                            ? 'text-red-700 dark:text-red-400'
                            : venceHoje
                            ? 'font-medium text-red-600 dark:text-red-400'
                            : 'font-medium text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {conta.quitado
                          ? `Pago em ${formatDate(conta.dataQuitacao ?? conta.vencimento)}`
                          : atrasada
                          ? `Atrasada desde ${formatDate(conta.vencimento)}`
                          : venceHoje
                          ? 'Vence Hoje'
                          : `Vence em ${formatDate(conta.vencimento)}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-gray-900 dark:text-gray-100 ${conta.quitado ? 'text-gray-500 line-through dark:text-gray-500' : ''}`}>
                      {formatCurrency(conta.valor)}
                    </p>
                    {!conta.quitado && (
                      <button
                        onClick={() => marcarContaQuitada(conta.id)}
                        className="mt-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      >
                        Dar Baixa
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {lancamentosDaAba.map((lanc) => (
              <li key={lanc.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{lanc.descricao}</p>
                  <p className="text-[11px] text-gray-400">{formatDate(lanc.data)}</p>
                </div>
                <p className={`text-sm font-bold ${lanc.tipo === 'saida' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {lanc.tipo === 'saida' ? '-' : '+'} {formatCurrency(lanc.valor)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Nova Despesa">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Descrição</label>
            <input
              name="descricao"
              type="text"
              required
              placeholder="Ex: Conta de Luz"
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Valor</label>
            <input
              name="valor"
              type="text"
              inputMode="decimal"
              required
              placeholder="Ex: 130,00"
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Vencimento</label>
            <input
              name="vencimento"
              type="date"
              required
              defaultValue={todayISO()}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 font-bold text-white">
            Salvar Despesa
          </button>
        </form>
      </Modal>

      <Modal open={entradaModalAberto} onClose={() => setEntradaModalAberto(false)} title="Nova Entrada">
        <form className="space-y-4" onSubmit={handleEntradaSubmit}>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Descrição</label>
            <input
              value={entradaDescricao}
              onChange={(e) => setEntradaDescricao(e.target.value)}
              type="text"
              required
              placeholder="Ex: Venda avulsa"
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Valor</label>
            <input
              value={entradaValor}
              onChange={(e) => setEntradaValor(e.target.value)}
              type="text"
              inputMode="decimal"
              required
              placeholder="Ex: 130,00"
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Data</label>
            <input
              value={entradaData}
              onChange={(e) => setEntradaData(e.target.value)}
              type="date"
              required
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 font-bold text-white">
            Salvar Entrada
          </button>
        </form>
      </Modal>
    </div>
  );
}
