// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PendingIdentificationList from './PendingIdentificationList';

const resolverPendenciaMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../context/AppDataContext', () => ({
  useAppData: () => ({
    data: {
      produtos: [
        {
          id: 'produto-1',
          type: 'product',
          nome: 'Café',
          precoVenda: 8,
          quantidade: 12,
        },
        {
          id: 'servico-1',
          type: 'service',
          nome: 'Entrega',
          precoVenda: 15,
          duracao: '30 min',
        },
      ],
    },
    resolverPendenciaNoBanco: resolverPendenciaMock,
  }),
}));

afterEach(() => {
  cleanup();
  resolverPendenciaMock.mockClear();
});

describe('PendingIdentificationList', () => {
  it('seleciona o produto concreto e o envia para abater a pendência', async () => {
    render(
      <PendingIdentificationList
        lancamentos={[
          {
            id: 'pendencia-1',
            data: '2026-08-15',
            tipo: 'entrada',
            descricao: 'Venda sem identificação',
            valor: 8,
            formaPagamento: 'dinheiro',
            tipoEntrada: 'produto',
            identificacaoPendente: true,
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Selecionar produto' }), {
      target: { value: 'produto-1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Unidades do produto' }), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Abater pendência' }));

    await waitFor(() => {
      expect(resolverPendenciaMock).toHaveBeenCalledWith('pendencia-1', 'produto', 'produto-1', 3);
    });
  });

  it('troca para serviço e mostra apenas serviços do catálogo', () => {
    render(
      <PendingIdentificationList
        lancamentos={[
          {
            id: 'pendencia-2',
            data: '2026-08-15',
            tipo: 'entrada',
            descricao: 'Entrada pendente',
            valor: 15,
            formaPagamento: 'pix',
            tipoEntrada: 'produto',
            identificacaoPendente: true,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Serviço' }));
    const seletor = screen.getByRole('combobox', { name: 'Selecionar serviço' });

    expect(seletor.textContent).toContain('Entrega');
    expect(seletor.textContent).not.toContain('Café');
  });
});
