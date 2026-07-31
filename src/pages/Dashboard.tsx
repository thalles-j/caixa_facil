import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeSlash,
  TrendUp,
  TrendDown,
  Receipt,
  HandCoins,
  Package,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  ClockCountdown,
  WarningCircle,
  Info,
  ChartBar,
  Newspaper,
} from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import Modal from '../components/Modal';
import { getCategoryTheme } from '../lib/categoryThemes';
import { formatCurrency, parseMoney, todayISO } from '../lib/format';

const diaSemanaCurto = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    data,
    saldoCaixa,
    vendasHoje,
    resumoPeriodo,
    lucroEstimadoHoje,
    vendasUltimos7Dias,
    contasAPagarHoje,
    contasAReceberEmAberto,
    contasVencendoEmBreve,
    contasVencidas,
    contasQuitadasHoje,
    produtosEstoqueBaixo,
    addConta,
    addLancamentoManual,
  } = useAppData();

  const [saldoVisivel, setSaldoVisivel] = useState(true);
  const [lancamentoModalAberto, setLancamentoModalAberto] = useState(false);
  const [lancamentoTipo, setLancamentoTipo] = useState<'entrada' | 'saida'>('entrada');
  const [lancamentoDescricao, setLancamentoDescricao] = useState('');
  const [lancamentoValor, setLancamentoValor] = useState('');
  const [lancamentoItemType, setLancamentoItemType] = useState<'product' | 'service'>('product');
  const [lancamentoItemId, setLancamentoItemId] = useState('');
  const [lancamentoData, setLancamentoData] = useState(todayISO());
  const [lancamentoVencimento, setLancamentoVencimento] = useState(todayISO());
  const hoje = todayISO();
  const controlaEstoque = data.config?.controlaEstoque ?? true;
  const viewPeriod = data.config?.viewPeriod ?? 'day';
  const theme = getCategoryTheme(data.config?.categoria);
  const sufixoPeriodo = viewPeriod === 'day' ? 'Hoje' : '(7 dias)';

  const metaDiaria = data.config?.metaDiariaVendas ?? 0;
  const progressoMeta = metaDiaria > 0 ? Math.min(100, Math.round((vendasHoje / metaDiaria) * 100)) : 0;

  const totalAPagarHoje = contasAPagarHoje.reduce((sum, c) => sum + c.valor, 0);
  const totalAReceber = contasAReceberEmAberto.reduce((sum, c) => sum + c.valor, 0);
  const clientesEmAberto = useMemo(() => {
    const comCliente = new Set(contasAReceberEmAberto.filter((c) => c.clienteId).map((c) => c.clienteId));
    const semCliente = contasAReceberEmAberto.filter((c) => !c.clienteId).length;
    return comCliente.size + semCliente;
  }, [contasAReceberEmAberto]);

  const handleSalvarLancamento = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const valor = parseMoney(lancamentoValor);
    if (!lancamentoDescricao.trim() || valor <= 0) return;

    if (lancamentoTipo === 'entrada') {
      const itemSelecionado = data.produtos.find((item) => item.id === lancamentoItemId);
      addLancamentoManual({
        tipo: 'entrada',
        descricao: lancamentoDescricao.trim() || itemSelecionado?.nome || '',
        valor,
        data: lancamentoData,
      });
    } else {
      addConta({
        tipo: 'pagar',
        descricao: lancamentoDescricao.trim(),
        valor,
        vencimento: lancamentoVencimento,
      });
    }

    setLancamentoModalAberto(false);
    setLancamentoDescricao('');
    setLancamentoValor('');
    setLancamentoData(todayISO());
    setLancamentoVencimento(todayISO());
  };

  const emAltaHoje = useMemo(() => {
    const vendasHojeList = data.vendas.filter((v) => v.data === hoje);
    const porDescricao = new Map<string, number>();
    vendasHojeList.forEach((v) => {
      porDescricao.set(v.descricao, (porDescricao.get(v.descricao) ?? 0) + v.quantidade);
    });
    return Array.from(porDescricao.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [data.vendas, hoje]);

  const movimentacoesHoje = useMemo(() => {
    const vendas = data.vendas
      .filter((v) => v.data === hoje)
      .map((v) => ({
        id: v.id,
        descricao: `${v.descricao} (${formaPagamentoLabel(v.formaPagamento)})`,
        valor: v.quantidade * v.valorUnitario,
        tipo: 'entrada' as const,
      }));
    const manuais = data.lancamentosManuais
      .filter((l) => l.data === hoje)
      .map((l) => ({ id: l.id, descricao: l.descricao, valor: l.valor, tipo: l.tipo }));
    const contas = contasQuitadasHoje
      .filter((c) => !c.origemVendaId)
      .map((c) => ({
        id: c.id,
        descricao: c.descricao,
        valor: c.valor,
        tipo: c.tipo === 'pagar' ? ('saida' as const) : ('entrada' as const),
      }));
    return [...vendas, ...manuais, ...contas];
  }, [data.vendas, data.lancamentosManuais, contasQuitadasHoje, hoje]);

  const maxHistorico = Math.max(1, ...vendasUltimos7Dias.map((d) => d.total));

  return (
    <div className="fade-in">
      <div
        className={`relative z-0 mb-[-40px] -mx-4 -mt-4 rounded-b-[2rem] bg-gradient-to-br px-4 pb-16 pt-6 text-white shadow-md ${theme.gradient}`}
      >
        <div className="mb-2 flex items-start justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/80">
              Caixa Disponível
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight">
              {saldoVisivel ? formatCurrency(saldoCaixa) : 'R$ ••••••'}
            </h2>
          </div>
          <button
            onClick={() => setSaldoVisivel((v) => !v)}
            className="rounded-xl bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"
            aria-label={saldoVisivel ? 'Ocultar saldo' : 'Mostrar saldo'}
          >
            {saldoVisivel ? <EyeSlash size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <div className="mt-5 flex gap-3">
          <div className="flex-1 rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-md">
            <div className="mb-1 flex items-start justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/90">Vendas {sufixoPeriodo}</p>
              <TrendUp size={18} weight="fill" className="text-green-300" />
            </div>
            <p className="text-lg font-bold text-white">
              {saldoVisivel ? formatCurrency(resumoPeriodo.vendas) : '••••'}
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-md">
            <div className="mb-1 flex items-start justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/90">Despesas {sufixoPeriodo}</p>
              <TrendDown size={18} weight="fill" className="text-red-300" />
            </div>
            <p className="text-lg font-bold text-white">
              {saldoVisivel ? formatCurrency(resumoPeriodo.despesas) : '••••'}
            </p>
          </div>
        </div>
      </div>

      <div id="dashboard-action-buttons" className="relative z-10 mb-6 grid grid-cols-4 gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <QuickAction icon={Calculator} label="Caixa" onClick={() => navigate('/caixa')} />
        <QuickAction icon={ArrowUpRight} label="Entrada" onClick={() => {
          setLancamentoTipo('entrada');
          setLancamentoItemType('product');
          setLancamentoItemId('');
          setLancamentoModalAberto(true);
        }} />
        <QuickAction icon={ArrowDownRight} label="Despesa" onClick={() => {
          setLancamentoTipo('saida');
          setLancamentoModalAberto(true);
        }} />
        <QuickAction
          icon={ChartBar}
          label="Open"
          onClick={() => {
            // função futura
          }}
        />
      </div>
      <Modal open={lancamentoModalAberto} onClose={() => setLancamentoModalAberto(false)} title={lancamentoTipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}>
        <div className="flex items-center gap-3 mb-6">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              lancamentoTipo === 'entrada' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}
          >
            {lancamentoTipo === 'entrada' ? <ArrowUp size={24} /> : <ArrowDown size={24} />}
          </div>
          <div>
            <h3 className="font-black text-xl text-slate-800">{lancamentoTipo === 'entrada' ? 'Nova Entrada' : 'Nova Despesa'}</h3>
            <p className="text-xs text-slate-500">
              {lancamentoTipo === 'entrada' ? 'Registre um recebimento' : 'Registre um gasto'}
            </p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleSalvarLancamento}>
          <div>
            <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Valor</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">R$</span>
              <input
                id="lancamento-valor"
                value={lancamentoValor}
                onChange={(e) => setLancamentoValor(e.target.value)}
                type="text"
                inputMode="decimal"
                required
                className="w-full bg-slate-50 border rounded-2xl py-4 pl-12 pr-4 text-3xl font-black"
                placeholder="0,00"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Descrição</label>
            <input
              id="lancamento-descricao"
              value={lancamentoDescricao}
              onChange={(e) => setLancamentoDescricao(e.target.value)}
              type="text"
              required
              placeholder={lancamentoTipo === 'entrada' ? 'Ex: Venda de Produtos' : 'Ex: Compra de Mercadorias'}
              className="w-full bg-slate-50 border rounded-xl px-4 py-3"
            />
          </div>

          {lancamentoTipo === 'entrada' ? (
            <>
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Produto ou Serviço</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLancamentoItemType('product');
                      setLancamentoItemId('');
                    }}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      lancamentoItemType === 'product'
                        ? 'border-slate-800 bg-slate-100 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Produto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLancamentoItemType('service');
                      setLancamentoItemId('');
                    }}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      lancamentoItemType === 'service'
                        ? 'border-slate-800 bg-slate-100 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Serviço
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Item</label>
                <select
                  id="lancamento-item"
                  value={lancamentoItemId}
                  onChange={(e) => setLancamentoItemId(e.target.value)}
                  className="w-full bg-slate-50 border rounded-xl px-4 py-3"
                >
                  <option value="">{`Selecione um ${lancamentoItemType === 'product' ? 'produto' : 'serviço'}`}</option>
                  {data.produtos
                    .filter((item) => item.type === lancamentoItemType)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                </select>
                {data.produtos.filter((item) => item.type === lancamentoItemType).length === 0 && (
                  <p className="mt-2 text-xs text-slate-500">Nenhum {lancamentoItemType === 'product' ? 'produto' : 'serviço'} cadastrado.</p>
                )}
              </div>
            </>
          ) : (
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Categoria</label>
              <select
                id="lancamento-categoria"
                className="w-full bg-slate-50 border rounded-xl px-4 py-3"
              >
                <>
                  <option>Mercadoria</option>
                  <option>Fornecedor</option>
                  <option>Aluguel</option>
                  <option>Energia</option>
                  <option>Água</option>
                  <option>Internet</option>
                  <option>Funcionário</option>
                  <option>Combustível</option>
                  <option>Impostos</option>
                  <option>Outros</option>
                </>
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">
              {lancamentoTipo === 'entrada' ? 'Forma de Recebimento' : 'Forma de Pagamento'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="radio-card">
                <input type="radio" name="lancamento-pagamento" value="Dinheiro" defaultChecked hidden />
                <div>💵 Dinheiro</div>
              </label>
              <label className="radio-card">
                <input type="radio" name="lancamento-pagamento" value="Pix" hidden />
                <div>📱 Pix</div>
              </label>
              <label className="radio-card">
                <input type="radio" name="lancamento-pagamento" value="Cartão" hidden />
                <div>💳 Cartão</div>
              </label>
            </div>
          </div>

          <button
            id="btn-salvar-lancamento"
            type="submit"
            className={`w-full rounded-2xl py-4 font-bold text-white ${
              lancamentoTipo === 'entrada' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
            }`}
          >
            {lancamentoTipo === 'entrada' ? (
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowUpRight size={18} /> Salvar Entrada
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowDownRight size={18} /> Salvar Despesa
              </span>
            )}
          </button>
        </form>
      </Modal>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="flex flex-col justify-between rounded-2xl border border-red-100 bg-white p-3 shadow-sm dark:border-red-900/40 dark:bg-gray-800">
          <div className="mb-1 flex items-center text-gray-500 dark:text-gray-400">
            <div className="mr-2 rounded-lg bg-red-50 p-1.5 dark:bg-red-900/30">
              <Receipt size={16} className="text-red-600 dark:text-red-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              A Pagar Hoje
            </span>
          </div>
          <div className="mt-1 text-lg font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalAPagarHoje)}
          </div>
          <div className="mt-1 truncate text-[10px] text-gray-500 dark:text-gray-400">
            {contasAPagarHoje[0]?.descricao ?? 'Nenhuma conta hoje'}
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-orange-100 bg-white p-3 shadow-sm dark:border-orange-900/40 dark:bg-gray-800">
          <div className="mb-1 flex items-center text-gray-500 dark:text-gray-400">
            <div className="mr-2 rounded-lg bg-orange-50 p-1.5 dark:bg-orange-900/30">
              <HandCoins size={16} className="text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              A Receber
            </span>
          </div>
          <div className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-100">
            {formatCurrency(totalAReceber)}
          </div>
          <div className="mt-1 truncate text-[10px] text-gray-500 dark:text-gray-400">
            {clientesEmAberto} cliente(s) em aberto
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Lucro Estimado (parcial)
            </span>
            <Info size={13} className="text-gray-400" />
          </div>
        </div>
        <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(lucroEstimadoHoje)}</p>
        <p className="mt-1 text-[10px] text-gray-400">
          Considera só vendas de produtos com custo cadastrado.
        </p>
      </div>

      {metaDiaria > 0 && (
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Meta Diária (Vendas)
              </span>
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100">
                {formatCurrency(vendasHoje)}{' '}
                <span className="font-normal text-gray-400">/ {formatCurrency(metaDiaria)}</span>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{progressoMeta}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-1000 ease-out"
              style={{ width: `${progressoMeta}%` }}
            />
          </div>
        </div>
      )}

      {(produtosEstoqueBaixo.length > 0 || contasVencendoEmBreve.length > 0 || contasVencidas.length > 0) && (
        <>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Atenção Necessária
          </h2>
          <div className="mb-6 space-y-3">
            {contasVencidas.length > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <div className="rounded-lg bg-red-100 p-2 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                  <WarningCircle size={20} weight="fill" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200">Contas Atrasadas</p>
                  <p className="text-xs text-red-700 dark:text-red-400">
                    {contasVencidas.length} conta(s) vencida(s) —{' '}
                    {formatCurrency(contasVencidas.reduce((sum, c) => sum + c.valor, 0))}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/financas?tab=pagar')}
                  className="text-sm font-medium text-red-600 dark:text-red-400"
                >
                  Ver
                </button>
              </div>
            )}
            {produtosEstoqueBaixo.length > 0 && controlaEstoque && (
              <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900/50 dark:bg-yellow-900/20">
                <div className="rounded-lg bg-yellow-100 p-2 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-400">
                  <Package size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">Estoque Baixo</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    {produtosEstoqueBaixo.length} produto(s) precisam de reposição.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/catalogo')}
                  className="text-sm font-medium text-yellow-600 dark:text-yellow-400"
                >
                  Ver
                </button>
              </div>
            )}
            {contasVencendoEmBreve.map((conta) => {
              const dias = Math.round(
                (new Date(`${conta.vencimento}T00:00:00`).getTime() - new Date(`${hoje}T00:00:00`).getTime()) /
                  86_400_000,
              );
              return (
                <div
                  key={conta.id}
                  className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20"
                >
                  <div className="rounded-lg bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                    <ClockCountdown size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{conta.descricao}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Vence em {dias} dia{dias > 1 ? 's' : ''} — {formatCurrency(conta.valor)}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/financas?tab=pagar')}
                    className="text-sm font-medium text-amber-600 dark:text-amber-400"
                  >
                    Ver
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="mb-3 flex items-center gap-2">
        <ChartBar size={16} className="text-gray-500 dark:text-gray-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          Últimos 7 Dias
        </h2>
      </div>
      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex h-28 items-end justify-between gap-2">
          {vendasUltimos7Dias.map((dia) => {
            const altura = Math.max(4, Math.round((dia.total / maxHistorico) * 100));
            const isHoje = dia.data === hoje;
            return (
              <div key={dia.data} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${isHoje ? 'bg-blue-600' : 'bg-blue-200 dark:bg-blue-900/50'}`}
                    style={{ height: `${altura}%` }}
                    title={formatCurrency(dia.total)}
                  />
                </div>
                <span className="text-[9px] font-medium capitalize text-gray-400">
                  {diaSemanaCurto.format(new Date(`${dia.data}T00:00:00`)).replace('.', '')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {emAltaHoje.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Em Alta Hoje
            </h2>
          </div>
          <div className="scrollbar-hide mb-6 -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {emAltaHoje.map(([descricao, quantidade]) => (
              <div
                key={descricao}
                className="flex min-w-[110px] flex-col items-center rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                  <Package size={20} />
                </div>
                <p className="w-full truncate text-xs font-medium text-gray-800 dark:text-gray-100">{descricao}</p>
                <p className="mt-1 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  {quantidade} un vendidas
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mb-3 mt-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          Movimentações Hoje
        </h2>
        <button onClick={() => navigate('/financas')} className="text-xs font-medium text-blue-600 dark:text-blue-400">
          Ver Finanças
        </button>
      </div>
      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {movimentacoesHoje.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700">
              <Newspaper size={20} />
            </div>
            <p className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">Nenhuma movimentação hoje</p>
            <p className="mb-3 text-xs text-gray-400">Vendas e contas pagas hoje aparecem aqui.</p>
            <button
              onClick={() => navigate('/caixa')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400"
            >
              Registrar uma venda
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {movimentacoesHoje.map((mov) => {
              const isSaida = mov.tipo === 'saida';
              return (
                <li key={mov.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 dark:bg-gray-700">
                      {isSaida ? (
                        <ArrowDown size={18} className="text-red-500" />
                      ) : (
                        <ArrowUp size={18} className="text-green-500" />
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{mov.descricao}</div>
                  </div>
                  <div className={`text-sm font-bold ${isSaida ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {isSaida ? '-' : '+'} {formatCurrency(mov.valor)}
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

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Calculator;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 rounded-xl py-2 text-gray-600 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
        <Icon size={18} />
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function formaPagamentoLabel(forma: string) {
  switch (forma) {
    case 'dinheiro':
      return 'Dinheiro';
    case 'pix':
      return 'Pix';
    case 'cartao_credito':
      return 'Cartão Crédito';
    case 'cartao_debito':
      return 'Cartão Débito';
    case 'fiado':
      return 'Fiado';
    default:
      return forma;
  }
}
