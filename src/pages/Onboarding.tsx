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
    <div className="fixed inset-0 z-[100] flex flex-col items-center bg-gradient-to-br from-blue-700 to-blue-900 px-6 py-8 text-white">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-lg shadow-blue-900/50">
        <Storefront size={38} weight="fill" className="text-blue-600" />
      </div>
      <h1 className="mb-1 text-center text-2xl font-extrabold leading-tight tracking-tight">
        Meu Negócio no Bolso
      </h1>
      <p className="mb-6 text-center text-xs font-medium text-blue-200">
        Passo {step + 1} de {TOTAL_STEPS}
      </p>

      <div className="mb-6 h-1.5 w-full max-w-sm rounded-full bg-white/20">
        <div
          className="h-1.5 rounded-full bg-white transition-all duration-300 ease-out"
          style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      <div className="flex w-full max-w-sm flex-1 flex-col overflow-hidden rounded-[2rem] bg-white text-gray-800 shadow-2xl">
        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <div className="fade-in space-y-5">
              <h2 className="text-lg font-bold text-gray-900">Sua empresa</h2>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Nome do Negócio
                </label>
                <input
                  type="text"
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Mercadinho da Esquina"
                  className="w-full border-b-2 border-gray-200 bg-transparent py-2 text-lg font-semibold text-gray-800 placeholder-gray-300 transition-colors focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
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
                          selecionado ? 'border-blue-600 bg-blue-50' : 'border-gray-100 bg-white'
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${theme.gradient}`}
                        >
                          <Icon size={20} weight="fill" />
                        </div>
                        <span className="text-xs font-medium leading-tight text-gray-700">{ramo}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="fade-in space-y-5">
              <h2 className="text-lg font-bold text-gray-900">Modelo de negócio</h2>
              <div className="space-y-2">
                {OFERTAS.map(({ valor, label }) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => selecionarOferta(valor)}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                      oferta === valor
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label
                className={`flex items-center justify-between rounded-xl bg-gray-50 p-3 transition ${
                  oferta === 'servicos' ? 'opacity-50' : ''
                }`}
              >
                <div>
                  <span className="block text-sm font-medium text-gray-700">Gerenciar Estoque?</span>
                  {oferta === 'servicos' && (
                    <span className="block text-xs text-gray-400">Não disponível para "Apenas Serviços"</span>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={controlaEstoque}
                  disabled={oferta === 'servicos'}
                  onChange={(e) => setControlaEstoque(e.target.checked)}
                  className="h-5 w-5 accent-blue-600"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="fade-in space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Despesas Fixas</h2>
              <p className="text-xs text-gray-500">Opcional — você pode adicionar depois em Configurações.</p>
              <ul className="space-y-2">
                {despesasFixas.map((d) => (
                  <li key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 text-sm">
                    <span>
                      {d.nome} <span className="text-gray-400">({d.recorrencia})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatCurrency(d.valor)}</span>
                      <button
                        type="button"
                        onClick={() => removerDespesa(d.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
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
                <button
                  type="button"
                  onClick={adicionarDespesa}
                  className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 text-sm font-medium text-blue-700"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="fade-in space-y-5">
              <h2 className="text-lg font-bold text-gray-900">Preferências</h2>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Painel Inicial mostra números de:
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewPeriod('day')}
                    className={`flex-1 rounded-xl border-2 px-4 py-2 text-sm font-medium transition ${
                      viewPeriod === 'day'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white text-gray-700'
                    }`}
                  >
                    Dia Atual
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewPeriod('week')}
                    className={`flex-1 rounded-xl border-2 px-4 py-2 text-sm font-medium transition ${
                      viewPeriod === 'week'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white text-gray-700'
                    }`}
                  >
                    Semana
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Relatórios Automáticos
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                    <span className="text-sm font-medium text-gray-700">Resumo Semanal</span>
                    <input
                      type="checkbox"
                      checked={resumoSemanal}
                      onChange={(e) => setResumoSemanal(e.target.checked)}
                      className="h-5 w-5 accent-blue-600"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                    <span className="text-sm font-medium text-gray-700">Fechamento Mensal</span>
                    <input
                      type="checkbox"
                      checked={fechamentoMensal}
                      onChange={(e) => setFechamentoMensal(e.target.checked)}
                      className="h-5 w-5 accent-blue-600"
                    />
                  </label>
                  <p className="text-xs text-gray-400">Simulado no protótipo — sem envio real.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-gray-100 p-4">
          {step > 0 && (
            <button
              type="button"
              onClick={voltar}
              className="flex items-center gap-1 rounded-xl px-4 py-3 text-sm font-bold text-gray-500 transition hover:bg-gray-50"
            >
              <ArrowLeft size={16} weight="bold" /> Voltar
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={avancar}
              disabled={!podeAvancar}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-md transition active:scale-95 ${
                podeAvancar ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-blue-300'
              }`}
            >
              Avançar <ArrowRight size={18} weight="bold" />
            </button>
          ) : (
            <button
              type="button"
              onClick={concluir}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
            >
              Concluir <Check size={18} weight="bold" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-blue-300/60">Protótipo 1.0 • Salvo no seu dispositivo</p>
    </div>
  );
}
