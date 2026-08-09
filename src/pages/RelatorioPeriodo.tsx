import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarBlank,
  ChartBar,
  Package,
  Printer,
  Receipt,
  TrendDown,
  TrendUp,
  UsersThree,
} from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, formatDate } from '../lib/format';
import {
  FORMAS_PAGAMENTO,
  agruparMovimentosPorDia,
  agruparPagamentos,
  agruparProdutos,
  dataLocalISO,
  formatarQuantidade,
  inicioDaSemana,
  somarDias,
  type MovimentoDiario,
  type ProdutoAgrupado,
} from '../lib/reporting';
import type { SessaoCaixa } from '../types';

type TipoRelatorio = 'mensal' | 'semanal';

function fimDoMes(inicio: string): string {
  const [ano, mes] = inicio.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
}

function dentroDoPeriodo(data: string, inicio: string, fim: string): boolean {
  return data >= inicio && data <= fim;
}

function somarFechamentos(sessoes: SessaoCaixa[], campo: keyof SessaoCaixa): number {
  return sessoes.reduce((total, sessao) => total + Number(sessao[campo] ?? 0), 0);
}

export default function RelatorioPeriodo({ tipo }: { tipo: TipoRelatorio }) {
  const { data } = useAppData();
  const { periodo = '' } = useParams();
  const periodoValido = tipo === 'mensal' ? /^\d{4}-\d{2}$/.test(periodo) : /^\d{4}-\d{2}-\d{2}$/.test(periodo);
  const inicio = periodoValido
    ? tipo === 'mensal'
      ? `${periodo}-01`
      : inicioDaSemana(periodo)
    : '';
  const fim = inicio ? (tipo === 'mensal' ? fimDoMes(inicio) : somarDias(inicio, 6)) : '';

  const vendas = useMemo(
    () => data.vendas.filter((venda) => dentroDoPeriodo(venda.data, inicio, fim)),
    [data.vendas, fim, inicio],
  );
  const transacoes = useMemo(
    () => data.transacoes.filter((transacao) => dentroDoPeriodo(dataLocalISO(transacao.ocorridoEm), inicio, fim)),
    [data.transacoes, fim, inicio],
  );
  const fechamentos = useMemo(
    () =>
      data.fechamentosCaixa
        .filter((sessao) => dentroDoPeriodo(dataLocalISO(sessao.fechadoEm), inicio, fim))
        .sort((a, b) => (a.fechadoEm ?? '').localeCompare(b.fechadoEm ?? '')),
    [data.fechamentosCaixa, fim, inicio],
  );

  const produtos = useMemo(
    () =>
      agruparProdutos(vendas).sort(
        (a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento || a.nome.localeCompare(b.nome),
      ),
    [vendas],
  );
  const pagamentos = useMemo(
    () => agruparPagamentos(transacoes.filter((transacao) => transacao.origem === 'pagamento_fiado')),
    [transacoes],
  );
  const movimentosDiarios = useMemo(() => agruparMovimentosPorDia(transacoes), [transacoes]);

  const produtoMais = produtos[0];
  const produtoMenos = [...produtos].sort(
    (a, b) => a.quantidade - b.quantidade || a.faturamento - b.faturamento || a.nome.localeCompare(b.nome),
  )[0];
  const diaMais = [...movimentosDiarios].sort((a, b) => b.volume - a.volume || a.dia.localeCompare(b.dia))[0];
  const diaMenos = [...movimentosDiarios].sort((a, b) => a.volume - b.volume || a.dia.localeCompare(b.dia))[0];

  const totalVendas = vendas.reduce((total, venda) => total + venda.quantidade * venda.valorUnitario, 0);
  const totalItens = vendas.reduce((total, venda) => total + venda.quantidade, 0);
  const totalEntradas = transacoes
    .filter((transacao) => transacao.tipo === 'entrada')
    .reduce((total, transacao) => total + transacao.valor, 0);
  const totalSaidas = transacoes
    .filter((transacao) => transacao.tipo === 'saida')
    .reduce((total, transacao) => total + transacao.valor, 0);
  const saldoPeriodo = totalEntradas - totalSaidas;
  const diferencaCaixas = somarFechamentos(fechamentos, 'diferenca');
  const dinheiroEsperado = somarFechamentos(fechamentos, 'dinheiroEsperado');
  const dinheiroContado = somarFechamentos(fechamentos, 'dinheiroContado');
  const formasVenda = vendas.reduce<Record<string, number>>((totais, venda) => {
    totais[venda.formaPagamento] = (totais[venda.formaPagamento] ?? 0) + venda.quantidade * venda.valorUnitario;
    return totais;
  }, {});
  const produtosExibidos = tipo === 'mensal' ? produtos : produtos.slice(0, 5);
  const possuiDados = vendas.length > 0 || transacoes.length > 0 || fechamentos.length > 0;

  const tituloPeriodo = inicio
    ? tipo === 'mensal'
      ? new Date(`${inicio}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      : `${formatDate(inicio)} a ${formatDate(fim)}`
    : 'Período inválido';

  return (
    <div className="fade-in print-report">
      <div className="no-print">
        <Link to="/relatorios" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft size={14} /> Voltar aos relatórios
        </Link>
        <h2 className="font-display text-2xl font-bold text-ink">Relatório {tipo}</h2>
        <p className="mb-5 mt-1 text-sm capitalize text-ink-soft">{tituloPeriodo}</p>
      </div>

      <section className="report-sheet rounded-2xl border border-line bg-paper-raised p-5 shadow-sm sm:p-7">
        <header className="mb-6 border-b-2 border-ink pb-4">
          <p className="font-ledger text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
            CaixaFacil · Relatório consolidado {tipo}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">{data.config?.nome ?? 'Meu Negócio'}</h1>
          <p className="mt-1 text-sm capitalize text-ink-soft">{tituloPeriodo}</p>
        </header>

        {!possuiDados ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Receipt size={30} className="mb-3 text-ink-soft" />
            <p className="font-semibold text-ink">Nenhum dado encontrado neste período.</p>
          </div>
        ) : (
          <>
            <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metrica label="Vendas realizadas" valor={formatCurrency(totalVendas)} />
              <Metrica label="Entradas recebidas" valor={formatCurrency(totalEntradas)} />
              <Metrica label="Saídas pagas" valor={formatCurrency(totalSaidas)} />
              <Metrica label="Saldo do período" valor={formatCurrency(saldoPeriodo)} destaque={saldoPeriodo < 0 ? 'negativo' : 'positivo'} />
              <Metrica label="Itens vendidos" valor={formatarQuantidade(totalItens)} />
              <Metrica label="Clientes que pagaram" valor={String(pagamentos.length)} />
              <Metrica label="Caixas fechados" valor={String(fechamentos.length)} />
              <Metrica label="Diferença dos caixas" valor={formatCurrency(diferencaCaixas)} destaque={diferencaCaixas < 0 ? 'negativo' : 'normal'} />
            </div>

            <section className="break-inside-avoid mb-7">
              <TituloSecao Icon={ChartBar} titulo={tipo === 'mensal' ? 'Destaques do mês' : 'Destaques da semana'} />
              <div className="grid gap-3 sm:grid-cols-2">
                <DestaqueProduto titulo="Maior saída" produto={produtoMais} Icon={TrendUp} classe="text-ledger-strong dark:text-ledger" />
                <DestaqueProduto titulo="Menor saída" produto={produtoMenos} Icon={TrendDown} classe="text-brass" />
                <DestaqueDia titulo="Dia com maior movimento" resumo={diaMais} Icon={TrendUp} classe="text-ledger-strong dark:text-ledger" />
                <DestaqueDia titulo="Dia com menor movimento" resumo={diaMenos} Icon={TrendDown} classe="text-brass" />
              </div>
            </section>

            <section className="break-inside-avoid mb-7 rounded-xl border border-line p-4">
              <TituloSecao Icon={CalendarBlank} titulo="Movimentação por dia" />
              <p className="mb-3 text-xs text-ink-soft">O volume soma entradas e saídas; dias sem movimento não entram no comparativo.</p>
              <div className="space-y-1.5">
                {movimentosDiarios.map((movimento) => (
                  <div key={movimento.dia} className="grid gap-1 rounded-lg bg-paper px-3 py-2.5 text-xs sm:grid-cols-[92px_repeat(4,minmax(0,1fr))] sm:items-center">
                    <span className="font-semibold text-ink">{formatDate(movimento.dia)}</span>
                    <ValorDia label="Entradas" valor={movimento.entradas} classe="text-ledger-strong dark:text-ledger" />
                    <ValorDia label="Saídas" valor={movimento.saidas} classe="text-stamp" />
                    <ValorDia label="Saldo" valor={movimento.saldo} classe={movimento.saldo < 0 ? 'text-stamp' : 'text-ink'} />
                    <ValorDia label="Volume" valor={movimento.volume} classe="text-ink" />
                  </div>
                ))}
              </div>
            </section>

            <section className="break-inside-avoid mb-7 rounded-xl border border-line p-4">
              <TituloSecao Icon={Package} titulo={tipo === 'mensal' ? 'Ranking completo de produtos e serviços' : 'Principais produtos e serviços da semana'} />
              <div className="mt-3 space-y-1.5">
                {produtosExibidos.map((produto, indice) => (
                  <div key={produto.chave} className="grid gap-1 rounded-lg bg-paper px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_90px_110px] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{indice + 1}. {produto.nome}</p>
                      <p className="truncate text-[10px] text-ink-soft">{produto.formas.join(', ')}</p>
                    </div>
                    <span className="font-ledger font-bold text-ink sm:text-right">{formatarQuantidade(produto.quantidade)} un.</span>
                    <span className="font-ledger font-bold text-ledger-strong dark:text-ledger sm:text-right">{formatCurrency(produto.faturamento)}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="mb-7 grid gap-5 sm:grid-cols-2">
              <section className="break-inside-avoid rounded-xl border border-line p-4">
                <TituloSecao Icon={UsersThree} titulo="Pessoas que pagaram fiado" />
                {pagamentos.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-soft">Nenhum recebimento de fiado no período.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {pagamentos.map((pagamento) => (
                      <li key={pagamento.chave} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{pagamento.nome}</p>
                          <p className="truncate text-[10px] text-ink-soft">{pagamento.quantidade} pagamento(s) · {pagamento.formas.join(', ')}</p>
                        </div>
                        <span className="shrink-0 font-ledger text-xs font-bold text-ledger-strong dark:text-ledger">{formatCurrency(pagamento.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="break-inside-avoid rounded-xl border border-line p-4">
                <TituloSecao Icon={Receipt} titulo="Vendas por forma de pagamento" />
                <div className="mt-3 space-y-2">
                  {Object.entries(formasVenda)
                    .sort((a, b) => b[1] - a[1])
                    .map(([forma, total]) => (
                      <div key={forma} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2 text-sm">
                        <span className="text-ink-soft">{FORMAS_PAGAMENTO[forma] ?? forma}</span>
                        <span className="font-ledger font-bold text-ink">{formatCurrency(total)}</span>
                      </div>
                    ))}
                </div>
              </section>
            </div>

            <section className="break-inside-avoid rounded-xl border border-line p-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <TituloSecao Icon={Receipt} titulo="Conferência dos fechamentos" />
                <p className="font-ledger text-xs font-bold text-ink">
                  Esperado {formatCurrency(dinheiroEsperado)} · Contado {formatCurrency(dinheiroContado)}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {fechamentos.map((sessao) => (
                  <div key={sessao.id} className="grid gap-1 rounded-lg bg-paper px-3 py-2.5 text-xs sm:grid-cols-[100px_repeat(3,minmax(0,1fr))] sm:items-center">
                    <span className="font-semibold text-ink">{formatDate(dataLocalISO(sessao.fechadoEm))}</span>
                    <ValorDia label="Esperado" valor={sessao.dinheiroEsperado} classe="text-ink" />
                    <ValorDia label="Contado" valor={sessao.dinheiroContado ?? 0} classe="text-ink" />
                    <ValorDia label="Diferença" valor={sessao.diferenca ?? 0} classe={(sessao.diferenca ?? 0) < 0 ? 'text-stamp' : 'text-ink'} />
                  </div>
                ))}
              </div>
            </section>
            <p className="mt-6 border-t border-line pt-3 text-center font-ledger text-[9px] uppercase tracking-widest text-ink-soft">
              Documento gerado pelo CaixaFacil
            </p>
          </>
        )}
      </section>

      <div className="no-print mt-5">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!possuiDados}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ledger px-4 py-3 font-bold text-paper shadow-sm transition hover:bg-ledger-strong disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Printer size={19} /> Imprimir ou salvar em PDF
        </button>
      </div>
    </div>
  );
}

function TituloSecao({ Icon, titulo }: { Icon: typeof Receipt; titulo: string }) {
  return <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Icon size={19} /> {titulo}</h2>;
}

function Metrica({ label, valor, destaque = 'normal' }: { label: string; valor: string; destaque?: 'normal' | 'positivo' | 'negativo' }) {
  const classe = destaque === 'positivo' ? 'text-ledger-strong dark:text-ledger' : destaque === 'negativo' ? 'text-stamp' : 'text-ink';
  return (
    <div className="rounded-xl bg-paper p-3">
      <p className="text-[9px] font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={`mt-1 font-ledger text-sm font-bold ${classe}`}>{valor}</p>
    </div>
  );
}

function ValorDia({ label, valor, classe }: { label: string; valor: number; classe: string }) {
  return (
    <span className={`font-ledger font-bold ${classe}`}>
      <span className="font-body text-[9px] font-medium uppercase text-ink-soft sm:block">{label}</span>
      {formatCurrency(valor)}
    </span>
  );
}

function DestaqueProduto({ titulo, produto, Icon, classe }: { titulo: string; produto?: ProdutoAgrupado; Icon: typeof TrendUp; classe: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${classe}`}><Icon size={15} weight="bold" /> {titulo}</p>
      {produto ? (
        <>
          <p className="mt-2 truncate font-display text-base font-bold text-ink">{produto.nome}</p>
          <p className="mt-1 font-ledger text-xs font-bold text-ink">{formatarQuantidade(produto.quantidade)} vendido(s) · {formatCurrency(produto.faturamento)}</p>
        </>
      ) : <p className="mt-2 text-sm text-ink-soft">Sem vendas no período.</p>}
    </div>
  );
}

function DestaqueDia({ titulo, resumo, Icon, classe }: { titulo: string; resumo?: MovimentoDiario; Icon: typeof TrendUp; classe: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${classe}`}><Icon size={15} weight="bold" /> {titulo}</p>
      {resumo ? (
        <>
          <p className="mt-2 font-display text-base font-bold text-ink">{formatDate(resumo.dia)}</p>
          <p className="mt-1 font-ledger text-xs font-bold text-ink">{formatCurrency(resumo.volume)} em {resumo.quantidade} movimento(s)</p>
        </>
      ) : <p className="mt-2 text-sm text-ink-soft">Sem movimentações no período.</p>}
    </div>
  );
}
