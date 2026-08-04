import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Plus, Trash, Storefront } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { RAMOS_ATUACAO } from '../types';
import type { DespesaFixa, Oferta, Recorrencia, ViewPeriod } from '../types';
import { getCategoryTheme } from '../lib/categoryThemes';
import { formatCurrency, parseMoney } from '../lib/format';
import { uid } from '../lib/storage';

const TOTAL_STEPS = 4;

const OFERTAS: { valor: Oferta; label: string }[] = [
  { valor: 'ambos', label: 'Produtos e Serviços' },
  { valor: 'produtos', label: 'Apenas Produtos' },
  { valor: 'servicos', label: 'Apenas Serviços' },
];

export default function Onboarding() {
  const { setConfig } = useAppData();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<string>(RAMOS_ATUACAO[0]);
  const [oferta, setOferta] = useState<Oferta>('ambos');
  const [controlaEstoque, setControlaEstoque] = useState(true);
  const [despesasFixas, setDespesasFixas] = useState<DespesaFixa[]>([]);
  const [novaDespesaNome, setNovaDespesaNome] = useState('');
  const [novaDespesaValor, setNovaDespesaValor] = useState('');
  const [novaDespesaRecorrencia, setNovaDespesaRecorrencia] = useState<Recorrencia>('mensal');
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('day');
  const [resumoSemanal, setResumoSemanal] = useState(true);
  const [fechamentoMensal, setFechamentoMensal] = useState(true);

  const selecionarOferta = (valor: Oferta) => {
    setOferta(valor);
    setControlaEstoque(valor !== 'servicos');
  };

  const adicionarDespesa = () => {
    const valor = parseMoney(novaDespesaValor);
    if (!novaDespesaNome.trim() || !valor || valor <= 0) return;
    setDespesasFixas((prev) => [
      ...prev,
      { id: uid(), nome: novaDespesaNome.trim(), valor, recorrencia: novaDespesaRecorrencia },
    ]);
    setNovaDespesaNome('');
    setNovaDespesaValor('');
  };

  const removerDespesa = (id: string) => {
    setDespesasFixas((prev) => prev.filter((d) => d.id !== id));
  };

  const podeAvancar = step !== 0 || nome.trim().length > 0;

  const avancar = () => {
    if (!podeAvancar) return;
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  };

  const voltar = () => setStep((s) => Math.max(0, s - 1));

  const concluir = () => {
    const frequencia =
      resumoSemanal && fechamentoMensal
        ? 'ambos'
        : resumoSemanal
        ? 'semanal'
        : fechamentoMensal
        ? 'mensal'
        : 'nenhum';

    setConfig({
      nome: nome.trim(),
      categoria,
      oferta,
      controlaEstoque,
      despesasFixas,
      relatorio: { frequencia, porEmail: false },
      viewPeriod,
      onboardingConcluido: true,
    });

    navigate('/', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center bg-[#241a12] px-6 py-8 text-[#f7f1e4]">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#f7f1e4] shadow-lg shadow-black/30">
        <Storefront size={38} weight="fill" className="text-ledger-strong" />
      </div>
      <h1 className="mb-1 text-center font-display text-2xl font-bold leading-tight tracking-tight">
        Meu Negócio no Bolso
      </h1>
      <p className="mb-6 text-center font-ledger text-xs font-medium text-[#f7f1e4]/60">
        Passo {step + 1} de {TOTAL_STEPS}
      </p>

      <div className="mb-6 h-1.5 w-full max-w-sm rounded-full bg-[#f7f1e4]/15">
        <div
          className="h-1.5 rounded-full bg-ledger transition-all duration-300 ease-out"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="flex w-full max-w-sm flex-1 flex-col overflow-hidden rounded-[2rem] bg-paper-raised text-ink shadow-2xl">
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="fade-in space-y-5">
              <h2 className="font-display text-lg font-bold text-ink">Sua empresa</h2>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  Nome do Negócio
                </label>
                <input
                  type="text"
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Mercadinho da Esquina"
                  className="w-full border-b-2 border-line bg-transparent py-2 text-lg font-semibold text-ink placeholder-ink-soft/50 transition-colors focus:border-ledger focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  Categoria Principal
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {RAMOS_ATUACAO.map((ramo) => {
                    const theme = getCategoryTheme(ramo);
                    const Icon = theme.icon;
                    const selecionado = categoria === ramo;
                    return (
                      <button
                        key={ramo}
                        type="button"
                        onClick={() => setCategoria(ramo)}
                        className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition ${
                          selecionado ? 'border-ledger bg-ledger/10' : 'border-line bg-paper'
                        }`}
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-paper"
                          style={{ backgroundColor: theme.accent }}
                        >
                          <Icon size={20} weight="fill" />
                        </div>
                        <span className="text-xs font-medium leading-tight text-ink">{ramo}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="fade-in space-y-5">
              <h2 className="font-display text-lg font-bold text-ink">Modelo de negócio</h2>
              <div className="space-y-2">
                {OFERTAS.map(({ valor, label }) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => selecionarOferta(valor)}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                      oferta === valor ? 'border-ledger bg-ledger/10 text-ledger-strong' : 'border-line bg-paper text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label
                className={`flex items-center justify-between gap-3 rounded-xl bg-paper p-3 transition ${
                  oferta === 'servicos' ? 'opacity-50' : ''
                }`}
              >
                <div>
                  <span className="block text-sm font-medium text-ink">Gerenciar Estoque?</span>
                  {oferta === 'servicos' && (
                    <span className="block text-xs text-ink-soft">Não disponível para "Apenas Serviços"</span>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={controlaEstoque}
                  disabled={oferta === 'servicos'}
                  onChange={(e) => setControlaEstoque(e.target.checked)}
                  className="h-5 w-5 accent-ledger"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in space-y-4">
              <h2 className="font-display text-lg font-bold text-ink">Despesas Fixas</h2>
              <p className="text-xs text-ink-soft">Opcional — você pode adicionar depois em Configurações.</p>
              <ul className="space-y-2">
                {despesasFixas.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-paper p-2 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      {d.nome} <span className="text-ink-soft">({d.recorrencia})</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-ledger font-medium tabular-nums text-ink">{formatCurrency(d.valor)}</span>
                      <button type="button" onClick={() => removerDespesa(d.id)} className="text-ink-soft hover:text-stamp">
                        <Trash size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <input
                  type="text"
                  value={novaDespesaNome}
                  onChange={(e) => setNovaDespesaNome(e.target.value)}
                  placeholder="Nome (ex: Aluguel)"
                  className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={novaDespesaValor}
                    onChange={(e) => setNovaDespesaValor(e.target.value)}
                    placeholder="Ex: 900,00"
                    className="w-28 min-w-0 rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
                  />
                  <select
                    value={novaDespesaRecorrencia}
                    onChange={(e) => setNovaDespesaRecorrencia(e.target.value as Recorrencia)}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="semanal">Semanal</option>
                  </select>
                  <button
                    type="button"
                    onClick={adicionarDespesa}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-ledger/10 px-3 text-sm font-medium text-ledger-strong"
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in space-y-5">
              <h2 className="font-display text-lg font-bold text-ink">Preferências</h2>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  Painel Inicial mostra números de:
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewPeriod('day')}
                    className={`flex-1 rounded-xl border-2 px-4 py-2 text-sm font-medium transition ${
                      viewPeriod === 'day' ? 'border-ledger bg-ledger/10 text-ledger-strong' : 'border-line bg-paper text-ink'
                    }`}
                  >
                    Dia Atual
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewPeriod('week')}
                    className={`flex-1 rounded-xl border-2 px-4 py-2 text-sm font-medium transition ${
                      viewPeriod === 'week' ? 'border-ledger bg-ledger/10 text-ledger-strong' : 'border-line bg-paper text-ink'
                    }`}
                  >
                    Semana
                  </button>
                </div>
                <p className="mt-2 text-xs text-ink-soft">
                  Define se os cartões de Vendas e Despesas no topo do Painel mostram o total de hoje ou dos
                  últimos 7 dias.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                  Relatórios Automáticos
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      Resumo Semanal
                      <span className="rounded-full bg-brass/15 px-2 py-0.5 font-ledger text-[9px] font-bold uppercase tracking-wide text-brass">
                        Em breve
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={resumoSemanal}
                      onChange={(e) => setResumoSemanal(e.target.checked)}
                      className="h-5 w-5 accent-ledger"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-paper p-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      Fechamento Mensal
                      <span className="rounded-full bg-brass/15 px-2 py-0.5 font-ledger text-[9px] font-bold uppercase tracking-wide text-brass">
                        Em breve
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={fechamentoMensal}
                      onChange={(e) => setFechamentoMensal(e.target.checked)}
                      className="h-5 w-5 accent-ledger"
                    />
                  </label>
                  <p className="rounded-lg bg-brass/10 px-3 py-2 text-xs text-ink-soft">
                    <span className="font-semibold text-brass">Simulação:</span> nesta versão do protótipo, nenhum
                    e-mail ou notificação é enviado de verdade.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line p-4">
          {step > 0 && (
            <button
              type="button"
              onClick={voltar}
              className="flex items-center gap-1 rounded-xl px-4 py-3 text-sm font-bold text-ink-soft transition hover:bg-line/30"
            >
              <ArrowLeft size={16} weight="bold" /> Voltar
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={avancar}
              disabled={!podeAvancar}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-bold text-paper shadow-md transition active:scale-95 ${
                podeAvancar ? 'bg-ledger hover:bg-ledger-strong' : 'cursor-not-allowed bg-ledger/40'
              }`}
            >
              Avançar <ArrowRight size={18} weight="bold" />
            </button>
          ) : (
            <button
              type="button"
              onClick={concluir}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ledger py-3 font-bold text-paper shadow-md transition-all hover:bg-ledger-strong active:scale-95"
            >
              Concluir <Check size={18} weight="bold" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-[#f7f1e4]/50">Protótipo 1.0 • Salvo no seu dispositivo</p>
    </div>
  );
}
