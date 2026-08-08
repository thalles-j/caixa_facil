import type { AppData } from '../types';

export const STORAGE_KEY = 'mnb-data-v1';
export const APP_DATA_CHANGED_EVENT = 'mnb-app-data-changed';

export function storageKeyForUser(userId?: string | null): string {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

export const emptyData: AppData = {
  config: null,
  vendas: [],
  produtos: [],
  contas: [],
  lancamentosManuais: [],
  clientes: [],
};

function instanteLegado(data: string, hora: number, ordem: number): string {
  const base = new Date(`${data}T${String(hora).padStart(2, '0')}:00:00.000Z`).getTime();
  return Number.isNaN(base) ? `${data}T00:00:00.000Z` : new Date(base + ordem).toISOString();
}

export function loadData(userId?: string | null): AppData {
  try {
    const raw = localStorage.getItem(storageKeyForUser(userId));
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw);

    const produtos = Array.isArray(parsed.produtos)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- normalizando JSON bruto de origem externa (localStorage/importação), sem shape garantido
        parsed.produtos.map((p: any) => ({
          ...p,
          type: p.type ?? 'product',
          quantidade: p.quantidade !== undefined ? p.quantidade : p.type === 'service' ? undefined : 0,
          quantidadeMinima:
            p.quantidadeMinima !== undefined ? p.quantidadeMinima : p.type === 'service' ? undefined : 0,
        }))
      : [];

    const vendas = Array.isArray(parsed.vendas)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- normalização do backup/localStorage legado
        parsed.vendas.map((venda: any, index: number) => ({
          ...venda,
          createdAt: venda.createdAt ?? instanteLegado(venda.data, 12, index),
        }))
      : [];

    const lancamentosManuais = Array.isArray(parsed.lancamentosManuais)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- normalização do backup/localStorage legado
        parsed.lancamentosManuais.map((lancamento: any, index: number) => ({
          ...lancamento,
          createdAt: lancamento.createdAt ?? instanteLegado(lancamento.data, 23, index),
        }))
      : [];

    const contas = Array.isArray(parsed.contas)
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any -- normalização do backup/localStorage legado
        parsed.contas.map((conta: any, index: number) => ({
          ...conta,
          quitadoEm:
            conta.quitadoEm ??
            (conta.quitado && conta.dataQuitacao ? instanteLegado(conta.dataQuitacao, 20, index) : undefined),
        }))
      : [];

    return { ...emptyData, ...parsed, produtos, vendas, contas, lancamentosManuais };
  } catch {
    return emptyData;
  }
}

export function saveData(data: AppData, userId?: string | null) {
  localStorage.setItem(storageKeyForUser(userId), JSON.stringify(data));
}

/**
 * Validação mínima de estrutura (não é um schema validator completo): confirma
 * que os campos principais existem e têm o tipo esperado, o suficiente para
 * decidir se um arquivo importado é um backup reconhecível do app.
 */
export function isValidAppData(value: unknown): value is AppData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    'config' in v &&
    Array.isArray(v.vendas) &&
    Array.isArray(v.produtos) &&
    Array.isArray(v.contas) &&
    Array.isArray(v.lancamentosManuais) &&
    Array.isArray(v.clientes)
  );
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
