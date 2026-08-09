import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  Package,
  Printer,
  Receipt,
  TrendDown,
  TrendUp,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, formatDate } from '../lib/format';
import type { SessaoCaixa, TransacaoFinanceira, Venda } from '../types';
import PendingIdentificationList from '../components/PendingIdentificationList';

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function dataLocalISO(iso?: string): string {
  if (!iso) return '';
  const data = new Date(iso);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function somar(sessoes: SessaoCaixa[], campo: keyof SessaoCaixa): number {
  return sessoes.reduce((total, sessao) => total + Number(sessao[campo] ?? 0), 0);
}

type ResumoProduto = {
  chave: string;
  nome: string;
  tipo?: Venda['tipoItem'];
  quantidade: number;
  faturamento: number;
  formas: string[];
};

type ResumoPagamento = {
  chave: string;
  nome: string;
  quantidade: number;
  total: number;
  formas: string[];
};

type ResumoDia = {
  dia: string;
  entradas: number;
  saidas: number;
  volume: number;
  quantidade: number;
};

const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  fiado: 'Fiado',
  outro: 'Outro',
};

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function agruparProdutos(vendas: Venda[]): ResumoProduto[] {
  const grupos = new Map<string, ResumoProduto & { formasSet: Set<string> }>();
  vendas.forEach((venda) => {
    const chave = venda.produtoId ?? venda.descricao.trim().toLocaleLowerCase('pt-BR');
    const atual = grupos.get(chave) ?? {
      chave,
      nome: venda.descricao,
      tipo: venda.tipoItem,
      quantidade: 0,
      faturamento: 0,
      formas: [],
      formasSet: new Set<string>(),
    };
    atual.quantidade += venda.quantidade;
    atual.faturamento += venda.quantidade * venda.valorUnitario;
    atual.formasSet.add(FORMAS_PAGAMENTO[venda.formaPagamento] ?? venda.formaPagamento);
    grupos.set(chave, atual);
  });
  return Array.from(grupos.values()).map(({ formasSet, ...produto }) => ({
    ...produto,
    formas: Array.from(formasSet),
  }));
}

function agruparPagamentos(transacoes: TransacaoFinanceira[]): ResumoPagamento[] {
  const grupos = new Map<string, ResumoPagamento & { formasSet: Set<string> }>();
  transacoes.forEach((transacao) => {
    const chave = transacao.clienteId ?? transacao.clienteNome ?? transacao.id;
    const atual = grupos.get(chave) ?? {
      chave,
      nome: transacao.clienteNome ?? 'Cliente não identificado',
      quantidade: 0,
      total: 0,
      formas: [],
      formasSet: new Set<string>(),
    };
    atual.quantidade += 1;
    atual.total += transacao.valor;
    atual.formasSet.add(FORMAS_PAGAMENTO[transacao.formaPagamento] ?? transacao.formaPagamento);
    grupos.set(chave, atual);
  });
  return Array.from(grupos.values())
    .map(({ formasSet, ...pagamento }) => ({ ...pagamento, formas: Array.from(formasSet) }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

function resumirDias(transacoes: TransacaoFinanceira[], mes: string): ResumoDia[] {
  const grupos = new Map<string, ResumoDia>();
  transacoes.forEach((transacao) => {
    const dia = dataLocalISO(transacao.ocorridoEm);
    if (!dia.startsWith(mes)) return;
    const atual = grupos.get(dia) ?? { dia, entradas: 0, saidas: 0, volume: 0, quantidade: 0 };
    if (transacao.tipo === 'entrada') atual.entradas += transacao.valor;
    else atual.saidas += transacao.valor;
    atual.volume += transacao.valor;
    atual.quantidade += 1;
    grupos.set(dia, atual);
  });
  return Array.from(grupos.values());
}

function ResultadoDiferenca({ valor }: { valor: number }) {
  if (valor < 0) {
    return <span className="font-semibold text-stamp">Quebra de {formatCurrency(Math.abs(valor))}</span>;
  }
  if (valor > 0) {
    return <span className="font-semibold text-brass">Sobra de {formatCurrency(valor)}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-ledger-strong dark:text-ledger">
      <CheckCircle size={15} weight="fill" /> Conferido
    </span>
  );
}

export default function RelatoriosCaixa() {
  const { data } = useAppData();
  const { dataRelatorio = '' } = useParams();
  const dataSelecionada = /^\d{4}-\d{2}-\d{2}$/.test(dataRelatorio) ? dataRelatorio : '';

  const fechamentos = useMemo(
    () =>
      data.fechamentosCaixa
        .filter((sessao) => dataLocalISO(sessao.fechadoEm) === dataSelecionada)
        .sort((a, b) => (b.fechadoEm ?? '').localeCompare(a.fechadoEm ?? '')),
    [data.fechamentosCaixa, dataSelecionada],
  );

  const idsFechamentos = useMemo(() => new Set(fechamentos.map((sessao) => sessao.id)), [fechamentos]);
  const mesSelecionado = dataSelecionada.slice(0, 7);

  const produtosDoDia = useMemo(
    () =>
      agruparProdutos(
        data.vendas.filter((venda) =>
          venda.caixaSessaoId ? idsFechamentos.has(venda.caixaSessaoId) : venda.data === dataSelecionada,
        ),
      ).sort((a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento || a.nome.localeCompare(b.nome)),
    [data.vendas, dataSelecionada, idsFechamentos],
  );

  const produtosDoMes = useMemo(
    () => agruparProdutos(data.vendas.filter((venda) => venda.data.startsWith(mesSelecionado))),
    [data.vendas, mesSelecionado],
  );

  const pagamentosDoDia = useMemo(
    () =>
      agruparPagamentos(
        data.transacoes.filter(
          (transacao) =>
            transacao.origem === 'pagamento_fiado' &&
            (transacao.caixaSessaoId
              ? idsFechamentos.has(transacao.caixaSessaoId)
              : dataLocalISO(transacao.ocorridoEm) === dataSelecionada),
        ),
      ),
    [data.transacoes, dataSelecionada, idsFechamentos],
  );

  const destaques = useMemo(() => {
    const produtosPorMaiorSaida = [...produtosDoMes].sort(
      (a, b) => b.quantidade - a.quantidade || b.faturamento - a.faturamento || a.nome.localeCompare(b.nome),
    );
    const produtosPorMenorSaida = [...produtosDoMes].sort(
      (a, b) => a.quantidade - b.quantidade || a.faturamento - b.faturamento || a.nome.localeCompare(b.nome),
    );
    const dias = resumirDias(data.transacoes, mesSelecionado);
    const diasPorMaiorMovimento = [...dias].sort((a, b) => b.volume - a.volume || a.dia.localeCompare(b.dia));
    const diasPorMenorMovimento = [...dias].sort((a, b) => a.volume - b.volume || a.dia.localeCompare(b.dia));
    return {
      produtoMais: produtosPorMaiorSaida[0],
      produtoMenos: produtosPorMenorSaida[0],
      diaMais: diasPorMaiorMovimento[0],
      diaMenos: diasPorMenorMovimento[0],
    };
  }, [data.transacoes, mesSelecionado, produtosDoMes]);

  const totais = useMemo(
    () => ({
      inicial: somar(fechamentos, 'valorInicial'),
      dinheiro: somar(fechamentos, 'vendasDinheiro'),
      pix: somar(fechamentos, 'vendasPix'),
      cartao: somar(fechamentos, 'vendasCartao'),
      fiado: somar(fechamentos, 'vendasFiado'),
      sangrias: somar(fechamentos, 'sangrias'),
      saidasOutros: somar(fechamentos, 'saidasOutros'),
      esperado: somar(fechamentos, 'dinheiroEsperado'),
      contado: somar(fechamentos, 'dinheiroContado'),
      diferenca: somar(fechamentos, 'diferenca'),
    }),
    [fechamentos],
  );

  const dataTitulo = dataSelecionada
    ? new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Data inválida';
  const mesTitulo = dataSelecionada
    ? new Date(`${dataSelecionada.slice(0, 7)}-01T12:00:00`).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })
    : 'mês inválido';
  const quantidadeVendidaNoDia = produtosDoDia.reduce((total, produto) => total + produto.quantidade, 0);
  const faturamentoProdutosNoDia = produtosDoDia.reduce((total, produto) => total + produto.faturamento, 0);
  const totalRecebidoDeClientes = pagamentosDoDia.reduce((total, pagamento) => total + pagamento.total, 0);

  return (
    <div className="fade-in print-report">
      <div className="no-print">
        <Link to="/fechamentos" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink">
          <ArrowLeft size={14} /> Voltar aos fechamentos
        </Link>
        <h2 className="font-display text-2xl font-bold text-ink">Relatório do fechamento</h2>
        <p className="mb-5 mt-1 text-sm capitalize text-ink-soft">Fechamento do dia {dataTitulo}</p>
      </div>

      <section className="report-sheet rounded-2xl border border-line bg-paper-raised p-5 shadow-sm sm:p-7">
        <header className="mb-6 border-b-2 border-ink pb-4">
          <p className="font-ledger text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">Relatório de fechamento</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">{data.config?.nome ?? 'Meu Negócio'}</h1>
          <p className="mt-1 text-sm capitalize text-ink-soft">{dataTitulo}</p>
        </header>

        {fechamentos.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-line/40 text-ink-soft">
              <Receipt size={23} />
            </div>
            <p className="font-medium text-ink">Nenhum fechamento nesta data.</p>
            <p className="mt-1 text-sm text-ink-soft">Feche uma sessão de caixa para ela aparecer no histórico.</p>
          </div>
        ) : (
          <>
            <div className="mb-7 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-paper p-4 text-sm sm:grid-cols-4">
              <TotalResumo label="Valores iniciais" valor={totais.inicial} />
              <TotalResumo label="Dinheiro" valor={totais.dinheiro} />
              <TotalResumo label="Pix" valor={totais.pix} />
              <TotalResumo label="Cartão" valor={totais.cartao} />
              <TotalResumo label="Fiado" valor={totais.fiado} />
              <TotalResumo label="Sangrias" valor={totais.sangrias} />
              <TotalResumo label="Saídas (outros meios)" valor={totais.saidasOutros} />
              <TotalResumo label="Dinheiro esperado" valor={totais.esperado} />
              <TotalResumo label="Dinheiro contado" valor={totais.contado} />
            </div>

            <section className="break-inside-avoid mb-7">
              <div className="mb-3 flex items-center gap-2">
                <CalendarBlank size={19} className="text-ink-soft" />
                <div>
                  <h2 className="font-display text-lg font-bold text-ink">Destaques de {mesTitulo}</h2>
                  <p className="text-xs text-ink-soft">Comparação dos dias com movimentação financeira e dos itens vendidos no mês.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DestaqueProduto
                  titulo="Maior saída no mês"
                  produto={destaques.produtoMais}
                  Icon={TrendUp}
                  classe="text-ledger-strong dark:text-ledger"
                />
                <DestaqueProduto
                  titulo="Menor saída no mês"
                  produto={destaques.produtoMenos}
                  Icon={TrendDown}
                  classe="text-brass"
                />
                <DestaqueDia
                  titulo="Dia com maior movimento"
                  resumo={destaques.diaMais}
                  Icon={TrendUp}
                  classe="text-ledger-strong dark:text-ledger"
                />
                <DestaqueDia
                  titulo="Dia com menor movimento"
                  resumo={destaques.diaMenos}
                  Icon={TrendDown}
                  classe="text-brass"
                />
              </div>
            </section>

            <section className="break-inside-avoid mb-7 rounded-xl border border-line p-4">
              <div className="mb-4 flex flex-col justify-between gap-2 border-b border-line pb-3 sm:flex-row sm:items-end">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                    <Package size={19} /> Produtos e serviços vendidos
                  </h2>
                  <p className="mt-1 text-xs text-ink-soft">Itens vinculados ao caixa fechado neste dia.</p>
                </div>
                <p className="font-ledger text-xs font-bold text-ink">
                  {formatarQuantidade(quantidadeVendidaNoDia)} item(ns) · {formatCurrency(faturamentoProdutosNoDia)}
                </p>
              </div>

              {produtosDoDia.length === 0 ? (
                <p className="rounded-lg bg-paper px-3 py-4 text-center text-sm text-ink-soft">Nenhum produto ou serviço vendido neste fechamento.</p>
              ) : (
                <div className="space-y-1">
                  <div className="hidden grid-cols-[minmax(0,1fr)_90px_110px] gap-3 px-2 pb-1 text-[9px] font-bold uppercase tracking-wide text-ink-soft sm:grid">
                    <span>Item e recebimento</span>
                    <span className="text-right">Quantidade</span>
                    <span className="text-right">Total vendido</span>
                  </div>
                  {produtosDoDia.map((produto, indice) => (
                    <div
                      key={produto.chave}
                      className="grid gap-2 rounded-lg bg-paper px-3 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_90px_110px] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">
                          {indice + 1}. {produto.nome}
                        </p>
                        <p className="truncate text-[10px] text-ink-soft">
                          {produto.tipo === 'service' ? 'Serviço' : produto.tipo === 'product' ? 'Produto' : 'Item avulso'} · {produto.formas.join(', ')}
                        </p>
                      </div>
                      <p className="font-ledger font-bold tabular-nums text-ink sm:text-right">
                        <span className="sm:hidden">Quantidade: </span>{formatarQuantidade(produto.quantidade)}
                      </p>
                      <p className="font-ledger font-bold tabular-nums text-ledger-strong dark:text-ledger sm:text-right">
                        {formatCurrency(produto.faturamento)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="break-inside-avoid mb-7 rounded-xl border border-line p-4">
              <div className="mb-4 flex flex-col justify-between gap-2 border-b border-line pb-3 sm:flex-row sm:items-end">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                    <UsersThree size={19} /> Pessoas que pagaram
                  </h2>
                  <p className="mt-1 text-xs text-ink-soft">Recebimentos de fiado registrados no caixa deste fechamento.</p>
                </div>
                <p className="font-ledger text-xs font-bold text-ledger-strong dark:text-ledger">
                  {pagamentosDoDia.length} pessoa(s) · {formatCurrency(totalRecebidoDeClientes)}
                </p>
              </div>

              {pagamentosDoDia.length === 0 ? (
                <p className="rounded-lg bg-paper px-3 py-4 text-center text-sm text-ink-soft">Nenhum pagamento de fiado recebido neste fechamento.</p>
              ) : (
                <ul className="space-y-2">
                  {pagamentosDoDia.map((pagamento) => (
                    <li key={pagamento.chave} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{pagamento.nome}</p>
                        <p className="truncate text-[10px] text-ink-soft">
                          {pagamento.quantidade} pagamento(s) · {pagamento.formas.join(', ')}
                        </p>
                      </div>
                      <span className="shrink-0 font-ledger text-sm font-bold tabular-nums text-ledger-strong dark:text-ledger">
                        {formatCurrency(pagamento.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="space-y-5">
              <h2 className="font-display text-lg font-bold text-ink">Conferência dos caixas</h2>
              {fechamentos.map((sessao, indice) => {
                const pendencias = data.lancamentosManuais.filter(
                  (lancamento) => lancamento.identificacaoPendente && lancamento.caixaSessaoId === sessao.id,
                );
                return (
                <article key={sessao.id} className="break-inside-avoid rounded-xl border border-line p-4">
                  <div className="mb-4 flex items-start justify-between gap-3 border-b border-line pb-3">
                    <div>
                      <h2 className="font-display font-bold text-ink">Fechamento {fechamentos.length - indice}</h2>
                      <p className="mt-1 text-xs text-ink-soft">
                        Aberto em {dataHora.format(new Date(sessao.abertoEm))}<br />
                        Fechado em {dataHora.format(new Date(sessao.fechadoEm!))}
                      </p>
                    </div>
                    <ResultadoDiferenca valor={sessao.diferenca ?? 0} />
                  </div>

                  <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                    <Linha label="Valor inicial" valor={sessao.valorInicial} />
                    <Linha label="Vendas em dinheiro" valor={sessao.vendasDinheiro} />
                    <Linha label="Vendas em Pix" valor={sessao.vendasPix} />
                    <Linha label="Vendas em cartão" valor={sessao.vendasCartao} />
                    <Linha label="Vendas fiado" valor={sessao.vendasFiado} />
                    <Linha label="Sangrias" valor={sessao.sangrias} />
                    <Linha label="Saídas por outros meios" valor={sessao.saidasOutros} />
                    <Linha label="Dinheiro esperado" valor={sessao.dinheiroEsperado} destaque />
                    <Linha label="Dinheiro contado" valor={sessao.dinheiroContado ?? 0} destaque />
                    <Linha label="Diferença" valor={sessao.diferenca ?? 0} destaque />
                  </div>

                  {sessao.pendenciasIdentificacao > 0 && (
                    <div className="no-print mt-4 space-y-3 border-t border-line pt-4">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-brass">
                        <WarningCircle size={14} /> {sessao.pendenciasIdentificacao} lançamento(s) aguardando revisão
                      </p>
                      {pendencias.length > 0 && <PendingIdentificationList lancamentos={pendencias} />}
                    </div>
                  )}
                </article>
                );
              })}
            </div>

            <footer className="mt-6 flex items-center justify-between gap-4 border-t-2 border-ink pt-4">
              <span className="text-sm font-bold text-ink">Resultado consolidado</span>
              <ResultadoDiferenca valor={totais.diferenca} />
            </footer>
          </>
        )}
      </section>

      <div className="no-print mt-5">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={fechamentos.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ledger px-4 py-3 font-bold text-paper shadow-sm transition hover:bg-ledger-strong disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Printer size={19} /> Gerar Relatório
        </button>
        <p className="mt-2 text-center text-xs text-ink-soft">Na janela de impressão, escolha “Salvar como PDF” para fazer o download.</p>
      </div>
    </div>
  );
}

function TotalResumo({ label, valor }: { label: string; valor: number }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 font-ledger font-bold tabular-nums text-ink">{formatCurrency(valor)}</p>
    </div>
  );
}

function Linha({ label, valor, destaque = false }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${destaque ? 'font-bold' : ''}`}>
      <span className="text-ink-soft">{label}</span>
      <span className="font-ledger tabular-nums text-ink">{formatCurrency(valor)}</span>
    </div>
  );
}

function DestaqueProduto({
  titulo,
  produto,
  Icon,
  classe,
}: {
  titulo: string;
  produto?: ResumoProduto;
  Icon: typeof TrendUp;
  classe: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${classe}`}>
        <Icon size={15} weight="bold" /> {titulo}
      </p>
      {produto ? (
        <>
          <p className="mt-2 truncate font-display text-base font-bold text-ink">{produto.nome}</p>
          <p className="mt-1 font-ledger text-xs font-bold text-ink">
            {formatarQuantidade(produto.quantidade)} vendido(s) · {formatCurrency(produto.faturamento)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">Sem vendas no mês.</p>
      )}
    </div>
  );
}

function DestaqueDia({
  titulo,
  resumo,
  Icon,
  classe,
}: {
  titulo: string;
  resumo?: ResumoDia;
  Icon: typeof TrendUp;
  classe: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${classe}`}>
        <Icon size={15} weight="bold" /> {titulo}
      </p>
      {resumo ? (
        <>
          <p className="mt-2 font-display text-base font-bold text-ink">{formatDate(resumo.dia)}</p>
          <p className="mt-1 font-ledger text-xs font-bold text-ink">
            {formatCurrency(resumo.volume)} em {resumo.quantidade} movimento(s)
          </p>
          <p className="mt-1 text-[10px] text-ink-soft">
            Entradas {formatCurrency(resumo.entradas)} · Saídas {formatCurrency(resumo.saidas)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">Sem movimentações no mês.</p>
      )}
    </div>
  );
}
