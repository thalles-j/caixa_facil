import { ensureStoredAccessToken } from './auth';
import type { AppData, FormaPagamento, TipoDespesa, TipoEntrada, TipoMovimentoCaixa } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export class BusinessRequestError extends Error {
  code?: string;
  pendingCount?: number;

  constructor(message: string, code?: string, pendingCount?: number) {
    super(message);
    this.name = 'BusinessRequestError';
    this.code = code;
    this.pendingCount = pendingCount;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const execute = (token: string) => fetch(`${API_URL}/business${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });

  let token: string;
  try {
    token = await ensureStoredAccessToken();
  } catch {
    throw new BusinessRequestError('Sua sessão expirou. Entre novamente.');
  }

  let response = await execute(token);
  if (response.status === 401) {
    try {
      token = await ensureStoredAccessToken(true);
      response = await execute(token);
    } catch {
      throw new BusinessRequestError('Sua sessão expirou. Entre novamente.');
    }
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new BusinessRequestError(
      body?.error ?? 'Não foi possível salvar a operação.',
      body?.code,
      body?.pendingCount,
    );
  }
  return body as T;
}

export type SaleItemInput = {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export function registerSaleRequest(
  items: SaleItemInput[],
  paymentMethod: FormaPagamento,
  customerId?: string,
) {
  return request<{ data: AppData }>('/sales', {
    method: 'POST',
    body: JSON.stringify({
      items,
      paymentMethod,
      customerId: paymentMethod === 'fiado' ? customerId : undefined,
    }),
  });
}

export function registerTransactionRequest(input: {
  type: 'entrada' | 'saida';
  description: string;
  amount: number;
  paymentMethod: Exclude<FormaPagamento, 'fiado'>;
  entryKind?: TipoEntrada;
  expenseKind?: TipoDespesa;
  movementKind?: TipoMovimentoCaixa;
}) {
  return request<{ data: AppData }>('/transactions', { method: 'POST', body: JSON.stringify(input) });
}

export function resolveTransactionIdentificationRequest(
  id: string,
  classification: TipoEntrada | TipoDespesa,
  productId?: string,
  quantity?: number,
) {
  return request<{ data: AppData }>(`/transactions/${id}/identification`, {
    method: 'PATCH',
    body: JSON.stringify({ classification, productId, quantity }),
  });
}

export function registerCustomerRequest(name: string, phone?: string) {
  return request<{ data: AppData; customer: { id: string; nome: string; telefone?: string } }>('/customers', {
    method: 'POST',
    body: JSON.stringify({ name, phone }),
  });
}

export function payCreditRequest(id: string, paymentMethod: Exclude<FormaPagamento, 'fiado'>) {
  return request<{ data: AppData }>(`/credits/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod }),
  });
}

export function payFixedExpenseRequest(id: string, paymentMethod: Exclude<FormaPagamento, 'fiado'>) {
  return request<{ data: AppData }>(`/fixed-expenses/${id}/pay`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod }),
  });
}

export function registerFixedExpenseRequest(
  description: string,
  amount: number,
  recurrence: 'weekly' | 'monthly',
) {
  return request<{ data: AppData }>('/fixed-expenses', {
    method: 'POST',
    body: JSON.stringify({ description, amount, recurrence }),
  });
}

export function deleteFixedExpenseRequest(id: string) {
  return request<{ data: AppData }>(`/fixed-expenses/${id}`, { method: 'DELETE' });
}

export function openCashSessionRequest(openingBalance: number, responsible?: string) {
  return request<{ data: AppData }>('/cash-sessions', {
    method: 'POST',
    body: JSON.stringify({ openingBalance, responsible }),
  });
}

export function closeCashSessionRequest(id: string, countedCash: number, allowPending: boolean) {
  return request<{ data: AppData }>(`/cash-sessions/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({ countedCash, allowPending }),
  });
}
