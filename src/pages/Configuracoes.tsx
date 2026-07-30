import { useState, type FormEvent } from 'react';
import { Plus, Trash, PaperPlaneTilt, Moon, Sun } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, parseMoney } from '../lib/format';
import { uid } from '../lib/storage';
import { applyDarkPreference, getInitialDark } from '../lib/theme';
import { RAMOS_ATUACAO } from '../types';
import type { DespesaFixa, FrequenciaRelatorio, Oferta, Recorrencia, ViewPeriod } from '../types';

export default function Configuracoes() {
  const { data, setConfig, resetData } = useAppData();
  const config = data.config;

  const [novaDespesaNome, setNovaDespesaNome] = useState('');
  const [novaDespesaValor, setNovaDespesaValor] = useState('');
  const [novaDespesaRecorrencia, setNovaDespesaRecorrencia] = useState<Recorrencia>('mensal');
  const [darkMode, setDarkMode] = useState(getInitialDark());

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

  return (
    <div className="fade-in space-y-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Configurações</h2>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Negócio</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Nome do Negócio</label>
            <input
              type="text"
              defaultValue={config.nome}
              onBlur={(e) => salvarCampo({ nome: e.target.value.trim() || config.nome })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Ramo de Atuação</label>
            <select
              value={config.categoria}
              onChange={(e) => salvarCampo({ categoria: e.target.value })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RAMOS_ATUACAO.map((ramo) => (
                <option key={ramo} value={ramo}>
                  {ramo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">O que você oferece?</label>
            <select
              value={config.oferta}
              onChange={(e) => salvarCampo({ oferta: e.target.value as Oferta })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="produtos">Produtos</option>
              <option value="servicos">Serviços</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Controla estoque?</span>
            <input
              type="checkbox"
              checked={config.controlaEstoque}
              onChange={(e) => salvarCampo({ controlaEstoque: e.target.checked })}
              className="h-5 w-5 accent-blue-600"
            />
          </label>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Meta Diária de Vendas</label>
            <input
              type="text"
              inputMode="decimal"
              defaultValue={config.metaDiariaVendas ?? ''}
              onBlur={(e) =>
                salvarCampo({ metaDiariaVendas: e.target.value ? parseMoney(e.target.value) : undefined })
              }
              placeholder="Ex: 600,00"
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Painel Inicial mostra números de</label>
            <select
              value={config.viewPeriod ?? 'day'}
              onChange={(e) => salvarCampo({ viewPeriod: e.target.value as ViewPeriod })}
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">Dia Atual</option>
              <option value="week">Semana (últimos 7 dias)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Aparência
        </h3>
        <label className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
            {darkMode ? <Moon size={16} /> : <Sun size={16} />} Modo escuro
          </span>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={(e) => {
              setDarkMode(e.target.checked);
              applyDarkPreference(e.target.checked);
            }}
            className="h-5 w-5 accent-blue-600"
          />
        </label>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Despesas Fixas</h3>
        <ul className="mb-3 space-y-2">
          {config.despesasFixas.length === 0 && (
            <p className="text-sm text-gray-400">Nenhuma despesa fixa cadastrada.</p>
          )}
          {config.despesasFixas.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-sm">
              <span>
                {d.nome} <span className="text-gray-400">({d.recorrencia})</span>
              </span>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatCurrency(d.valor)}</span>
                <button onClick={() => removerDespesaFixa(d.id)} className="text-gray-400 hover:text-red-500">
                  <Trash size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={adicionarDespesaFixa} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={novaDespesaNome}
            onChange={(e) => setNovaDespesaNome(e.target.value)}
            placeholder="Nome (ex: Aluguel)"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            inputMode="decimal"
            value={novaDespesaValor}
            onChange={(e) => setNovaDespesaValor(e.target.value)}
            placeholder="Valor (ex: 900,00)"
            className="w-24 rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={novaDespesaRecorrencia}
            onChange={(e) => setNovaDespesaRecorrencia(e.target.value as Recorrencia)}
            className="rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="mensal">Mensal</option>
            <option value="semanal">Semanal</option>
          </select>
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 text-sm font-medium text-blue-700">
            <Plus size={16} /> Add
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Relatórios</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Frequência</label>
            <select
              value={config.relatorio.frequencia}
              onChange={(e) =>
                salvarCampo({
                  relatorio: { ...config.relatorio, frequencia: e.target.value as FrequenciaRelatorio },
                })
              }
              className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="nenhum">Nenhum</option>
              <option value="semanal">Semanal</option>
              <option value="mensal">Mensal</option>
              <option value="ambos">Semanal e Mensal</option>
            </select>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">Receber por e-mail</span>
            <input
              type="checkbox"
              checked={config.relatorio.porEmail}
              onChange={(e) =>
                salvarCampo({ relatorio: { ...config.relatorio, porEmail: e.target.checked } })
              }
              className="h-5 w-5 accent-blue-600"
            />
          </label>
          {config.relatorio.porEmail && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">E-mail</label>
              <input
                type="email"
                defaultValue={config.relatorio.email}
                onBlur={(e) => salvarCampo({ relatorio: { ...config.relatorio, email: e.target.value } })}
                placeholder="seuemail@exemplo.com"
                className="w-full rounded-lg border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <button
            onClick={enviarRelatorioAgora}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white"
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
        className="w-full rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-600"
      >
        Zerar Dados do App
      </button>
    </div>
  );
}
