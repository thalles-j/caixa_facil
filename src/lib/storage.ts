import type { AppData } from '../types';

export const STORAGE_KEY = 'mnb-data-v1';

export const emptyData: AppData = {
  config: null,
  vendas: [],
  produtos: [],
  contas: [],
  lancamentosManuais: [],
  clientes: [],
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

    return { ...emptyData, ...parsed, produtos };
  } catch {
    return emptyData;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
