// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_KEY } from './auth';
import { registerSaleRequest, registerTransactionRequest, resolveTransactionIdentificationRequest } from './business';

function fakeToken(): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'user-1', email: 'teste@example.com', exp })}.fake`;
}

function mockSuccess() {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('requisições financeiras', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, fakeToken());
  });

  it('nunca vincula cliente a uma venda comum, mesmo que um id seja informado por engano', async () => {
    const fetchMock = mockSuccess();

    await registerSaleRequest(
      [{ description: 'Café', quantity: 1, unitPrice: 10 }],
      'dinheiro',
      'cliente-indevido',
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ paymentMethod: 'dinheiro' });
    expect(body).not.toHaveProperty('customerId');
  });

  it('vincula cliente somente quando a forma selecionada é Fiado', async () => {
    const fetchMock = mockSuccess();

    await registerSaleRequest(
      [{ description: 'Serviço', quantity: 1, unitPrice: 50 }],
      'fiado',
      'cliente-1',
    );

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ paymentMethod: 'fiado', customerId: 'cliente-1' });
  });

  it('envia o tipo da entrada ao banco para a classificação de pendências', async () => {
    const fetchMock = mockSuccess();

    await registerTransactionRequest({
      type: 'entrada',
      description: 'Venda rápida',
      amount: 25,
      paymentMethod: 'pix',
      entryKind: 'produto',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({ type: 'entrada', paymentMethod: 'pix', entryKind: 'produto' });
  });

  it('envia a categoria da despesa e permite resolver uma pendência depois', async () => {
    const fetchMock = mockSuccess();

    await registerTransactionRequest({
      type: 'saida',
      description: 'Compra rápida',
      amount: 40,
      paymentMethod: 'dinheiro',
      expenseKind: 'mercadoria',
    });
    await resolveTransactionIdentificationRequest('transaction-1', 'fornecedor');

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ expenseKind: 'mercadoria' });
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/transactions/transaction-1/identification');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ classification: 'fornecedor' });
  });
});
