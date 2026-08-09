import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarBlank, CaretRight, CheckCircle, Receipt, WarningCircle } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, formatDate } from '../lib/format';
import type { SessaoCaixa } from '../types';

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

export default function Fechamentos() {
  const { data } = useAppData();

  const dias = useMemo(() => {
    const grupos = new Map<string, SessaoCaixa[]>();
    data.fechamentosCaixa.forEach((sessao) => {
      const dia = dataLocalISO(sessao.fechadoEm);
      if (!dia) return;
      grupos.set(dia, [...(grupos.get(dia) ?? []), sessao]);
    });
    return Array.from(grupos.entries())
      .map(([dia, sessoes]) => ({ dia, sessoes }))
      .sort((a, b) => b.dia.localeCompare(a.dia));
  }, [data.fechamentosCaixa]);

  return (
    <div className="fade-in">
      <header className="mb-5">
        <h2 className="font-display text-2xl font-bold text-ink">Fechamentos de Caixa</h2>
        <p className="mt-1 text-sm text-ink-soft">Escolha um dia para abrir o relatório completo.</p>
      </header>

      {dias.length === 0 ? (
        <section className="flex flex-col items-center rounded-2xl border border-line bg-paper-raised px-5 py-14 text-center shadow-sm">
          <span className="mb-3 rounded-full bg-line/40 p-3 text-ink-soft"><Receipt size={25} /></span>
          <p className="font-semibold text-ink">Nenhum fechamento registrado.</p>
          <p className="mt-1 text-sm text-ink-soft">Os caixas fechados aparecerão aqui agrupados por dia.</p>
        </section>
      ) : (
        <div className="space-y-4">
          {dias.map(({ dia, sessoes }) => {
            const entradas =
              somar(sessoes, 'vendasDinheiro') +
              somar(sessoes, 'vendasPix') +
              somar(sessoes, 'vendasCartao') +
              somar(sessoes, 'vendasFiado');
            const contado = somar(sessoes, 'dinheiroContado');
            const diferenca = somar(sessoes, 'diferenca');
            const pendencias = somar(sessoes, 'pendenciasIdentificacao');

            return (
              <article key={dia} className="rounded-2xl border border-line bg-paper-raised p-4 shadow-sm sm:p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-ink-soft">
                      <CalendarBlank size={17} />
                      <span className="font-ledger text-[10px] font-bold uppercase tracking-wide">Fechamento diário</span>
                    </div>
                    <h3 className="mt-1 font-display text-xl font-bold text-ink">Fechamento do dia {formatDate(dia)}</h3>
                    <p className="mt-1 text-xs text-ink-soft">
                      {sessoes.length} caixa{sessoes.length === 1 ? '' : 's'} fechado{sessoes.length === 1 ? '' : 's'} neste dia
                    </p>
                  </div>

                  <Link
                    to={`/fechamentos/${dia}`}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-ledger px-4 py-2.5 text-sm font-bold text-paper transition hover:bg-ledger-strong"
                  >
                    Abrir relatório <CaretRight size={16} weight="bold" />
                  </Link>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
                  <Resumo label="Entradas e fiado" valor={entradas} />
                  <Resumo label="Dinheiro contado" valor={contado} />
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-ink-soft">Resultado</p>
                    <p className={`mt-0.5 font-ledger text-sm font-bold ${diferenca < 0 ? 'text-stamp' : diferenca > 0 ? 'text-brass' : 'text-ledger-strong dark:text-ledger'}`}>
                      {diferenca < 0
                        ? `Quebra de ${formatCurrency(Math.abs(diferenca))}`
                        : diferenca > 0
                          ? `Sobra de ${formatCurrency(diferenca)}`
                          : 'Conferido'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-ink-soft">Pendências</p>
                    <p className={`mt-0.5 inline-flex items-center gap-1 font-ledger text-sm font-bold ${pendencias > 0 ? 'text-brass' : 'text-ledger-strong dark:text-ledger'}`}>
                      {pendencias > 0 ? <WarningCircle size={14} weight="fill" /> : <CheckCircle size={14} weight="fill" />}
                      {pendencias}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Resumo({ label, valor }: { label: string; valor: number }) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 font-ledger text-sm font-bold text-ink">{formatCurrency(valor)}</p>
    </div>
  );
}
