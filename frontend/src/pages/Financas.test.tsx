// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Financas from './Financas';

afterEach(() => cleanup());

vi.mock('../context/AppDataContext', () => ({
  useAppData: () => ({
    data: {
      config: {
        nome: 'Negócio de Teste',
        despesasFixas: [],
      },
      contas: [],
      clientes: [],
      lancamentosManuais: [],
    },
    addConta: vi.fn(),
    editarConta: vi.fn(),
    removerConta: vi.fn(),
    marcarContaQuitada: vi.fn(),
    editarLancamentoManual: vi.fn(),
    removerLancamentoManual: vi.fn(),
    editarCliente: vi.fn(),
    baixarFiado: vi.fn(),
    baixarDespesaFixa: vi.fn(),
  }),
}));

describe('abas do Financeiro', () => {
  it('permite alternar repetidamente sem desmontar ou quebrar a página', () => {
    render(
      <MemoryRouter initialEntries={['/financas?tab=pagar']}>
        <Routes>
          <Route path="/financas" element={<Financas />} />
        </Routes>
      </MemoryRouter>,
    );

    const pagar = screen.getByRole('button', { name: 'A Pagar' });
    const receber = screen.getByRole('button', { name: 'A Receber (Fiado)' });

    for (let indice = 0; indice < 12; indice += 1) {
      fireEvent.click(receber);
      fireEvent.click(pagar);
    }

    fireEvent.click(receber);

    expect(receber.getAttribute('data-selected')).toBe('true');
    expect(pagar.getAttribute('data-selected')).toBe('false');
    expect(screen.getByText(/Nenhuma entrada registrada/)).toBeTruthy();
  });
});
