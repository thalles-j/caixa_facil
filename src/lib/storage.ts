import type { AppData } from '../types';

const KEY = 'mnb-data-v1';

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
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData;
    const parsed = JSON.parse(raw);
    return { ...emptyData, ...parsed };
  } catch {
    return emptyData;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
