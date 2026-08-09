import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Printer, Receipt, WarningCircle } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency } from '../lib/format';
import type { SessaoCaixa } from '../types';
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

            <div className="space-y-5">
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
