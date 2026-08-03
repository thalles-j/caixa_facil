import { useState, type FormEvent } from 'react';
import { Plus, Trash, PaperPlaneTilt, Moon, Sun } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, parseMoney } from '../lib/format';
import { uid } from '../lib/storage';
import { useDarkMode } from '../lib/theme';
import { RAMOS_ATUACAO } from '../types';
import type { DespesaFixa, FrequenciaRelatorio, Oferta, Recorrencia, ViewPeriod } from '../types';

export default function Configuracoes() {
  const { data, setConfig, resetData } = useAppData();
  const config = data.config;

  const [novaDespesaNome, setNovaDespesaNome] = useState('');
  const [novaDespesaValor, setNovaDespesaValor] = useState('');
  const [novaDespesaRecorrencia, setNovaDespesaRecorrencia] = useState<Recorrencia>('mensal');
  const [darkMode, setDarkMode] = useDarkMode();

  if (!config) return null;

  const salvarCampo = (patch: Partial<typeof config>) => {
    setConfig({ ...config, ...patch });
  };

  const adicionarDespesaFixa = (e: FormEvent) => {
    e.preventDefault();
    const valor = parseMoney(novaDespesaValor);
    if (!novaDespesaNome.trim() || !valor || valor <= 0) return;

    const despesa: DespesaFixa = {
      id: uid(),
      nome: novaDespesaNome.trim(),
      valor,
      recorrencia: novaDespesaRecorrencia,
    };
    salvarCampo({ despesasFixas: [...config.despesasFixas, despesa] });
    setNovaDespesaNome('');
    setNovaDespesaValor('');
  };

  const removerDespesaFixa = (id: string) => {
    salvarCampo({ despesasFixas: config.despesasFixas.filter((d) => d.id !== id) });
  };

  const enviarRelatorioAgora = () => {
    // TODO: integração real fica para versão futura com backend
    alert(`Relatório simulado enviado para ${config.relatorio.email || '(nenhum e-mail cadastrado)'}.`);
  };

  const inputClasses =
    'w-full rounded-lg border border-line bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30';

  return (
    <div className="fade-in space-y-6 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
      <h2 className="font-display text-xl font-bold lg:col-span-2">Configurações</h2>

      <section className="min-w-0 rounded-2xl border border-line bg-paper-raised p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Negócio</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Nome do Negócio</label>
            <input
              type="text"
              defaultValue={config.nome}
              onBlur={(e) => salvarCampo({ nome: e.target.value.trim() || config.nome })}
              className={inputClasses}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Ramo de Atuação</label>
            <select
              value={config.categoria}
              onChange={(e) => salvarCampo({ categoria: e.target.value })}
              className={inputClasses}
            >
              {RAMOS_ATUACAO.map((ramo) => (
                <option key={ramo} value={ramo}>
                  {ramo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">O que você oferece?</label>
            <select
              value={config.oferta}
              onChange={(e) => salvarCampo({ oferta: e.target.value as Oferta })}
              className={inputClasses}
            >
              <option value="produtos">Produtos</option>
              <option value="servicos">Serviços</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <label className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-soft">Controla estoque?</span>
            <input
              type="checkbox"
              checked={config.controlaEstoque}
              onChange={(e) => salvarCampo({ controlaEstoque: e.target.checked })}
              className="h-5 w-5 accent-ledger"
            />
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Meta Diária de Vendas</label>
            <input
              type="text"
              inputMode="decimal"
              defaultValue={config.metaDiariaVendas ?? ''}
              onBlur={(e) =>
                salvarCampo({ metaDiariaVendas: e.target.value ? parseMoney(e.target.value) : undefined })
              }
              placeholder="Ex: 600,00"
              className={inputClasses}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Painel Inicial mostra números de</label>
            <select
              value={config.viewPeriod ?? 'day'}
              onChange={(e) => salvarCampo({ viewPeriod: e.target.value as ViewPeriod })}
              className={inputClasses}
            >
              <option value="day">Dia Atual</option>
              <option value="week">Semana (últimos 7 dias)</option>
            </select>
          </div>
        </div>
      </section>

      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-line bg-paper-raised p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Aparência</h3>
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-medium text-ink-soft">
              {darkMode ? <Moon size={16} /> : <Sun size={16} />} Modo escuro
            </span>
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="h-5 w-5 accent-ledger"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-line bg-paper-raised p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Despesas Fixas</h3>
          <ul className="mb-3 space-y-2">
            {config.despesasFixas.length === 0 && (
              <p className="text-sm text-ink-soft">Nenhuma despesa fixa cadastrada.</p>
            )}
            {config.despesasFixas.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-paper p-2 text-sm">
                <span className="min-w-0 truncate text-ink">
                  {d.nome} <span className="text-ink-soft">({d.recorrencia})</span>
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-ledger font-medium tabular-nums text-ink">{formatCurrency(d.valor)}</span>
                  <button onClick={() => removerDespesaFixa(d.id)} className="text-ink-soft hover:text-stamp">
                    <Trash size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <form onSubmit={adicionarDespesaFixa} className="space-y-2">
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
                type="submit"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-ledger/10 px-3 text-sm font-medium text-ledger-strong dark:text-ledger"
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-paper-raised p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">Relatórios</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Frequência</label>
              <select
                value={config.relatorio.frequencia}
                onChange={(e) =>
                  salvarCampo({
                    relatorio: { ...config.relatorio, frequencia: e.target.value as FrequenciaRelatorio },
                  })
                }
                className={inputClasses}
              >
                <option value="nenhum">Nenhum</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="ambos">Semanal e Mensal</option>
              </select>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-ink-soft">Receber por e-mail</span>
              <input
                type="checkbox"
                checked={config.relatorio.porEmail}
                onChange={(e) => salvarCampo({ relatorio: { ...config.relatorio, porEmail: e.target.checked } })}
                className="h-5 w-5 accent-ledger"
              />
            </label>
            {config.relatorio.porEmail && (
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">E-mail</label>
                <input
                  type="email"
                  defaultValue={config.relatorio.email}
                  onBlur={(e) => salvarCampo({ relatorio: { ...config.relatorio, email: e.target.value } })}
                  placeholder="seuemail@exemplo.com"
                  className={inputClasses}
                />
              </div>
            )}
            <button
              onClick={enviarRelatorioAgora}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ledger py-2.5 text-sm font-bold text-paper transition hover:bg-ledger-strong"
            >
              <PaperPlaneTilt size={18} /> Enviar Relatório Agora
            </button>
          </div>
        </section>

        <button
          onClick={() => {
            if (confirm('Isso vai apagar todos os dados salvos neste dispositivo. Continuar?')) {
              resetData();
            }
          }}
          className="w-full rounded-lg border border-stamp/30 bg-stamp/10 py-2.5 text-sm font-bold text-stamp transition hover:bg-stamp/20"
        >
          Zerar Dados do App
        </button>
      </div>
    </div>
  );
}
