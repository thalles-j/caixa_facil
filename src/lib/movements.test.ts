import { describe, expect, it } from 'vitest';
import { obterMovimentacoesFinanceiras, obterVendas } from './movements';
import type { AppData } from '../types';

const dados: AppData = {
  config: null,
  produtos: [],
  clientes: [{ id: 'cliente-1', nome: 'Ana' }],
  vendas: [
    {
      id: 'venda-antiga',
      data: '2026-08-01',
      descricao: 'Café',
      quantidade: 1,
      valorUnitario: 10,
      formaPagamento: 'dinheiro',
    },
    {
      id: 'venda-fiado',
      data: '2026-08-03',
      descricao: 'Limpeza',
      quantidade: 1,
      valorUnitario: 40,
      formaPagamento: 'fiado',
    },
  ],
  contas: [
    {
      id: 'fiado',
      tipo: 'receber',
      descricao: 'Limpeza',
      valor: 40,
      vencimento: '2026-08-10',
      quitado: false,
      origemVendaId: 'venda-fiado',
      clienteId: 'cliente-1',
    },
    {
      id: 'despesa',
      tipo: 'pagar',
      descricao: 'Energia',
      valor: 20,
      vencimento: '2026-08-02',
      quitado: true,
      dataQuitacao: '2026-08-04',
    },
  ],
  lancamentosManuais: [
    { id: 'entrada', data: '2026-08-02', tipo: 'entrada', descricao: 'Serviço', valor: 25 },
  ],
};

describe('movimentações financeiras', () => {
  it('ordena pelas datas mais recentes e não lança fiado pendente no caixa', () => {
    const movimentos = obterMovimentacoesFinanceiras(dados);

    expect(movimentos.map((movimento) => movimento.id)).toEqual(['despesa', 'entrada', 'venda-antiga']);
    expect(movimentos.some((movimento) => movimento.id === 'venda-fiado')).toBe(false);
  });

  it('mantém o fiado pendente pesquisável no histórico de vendas', () => {
    const vendas = obterVendas(dados);

    expect(vendas[0]).toMatchObject({ id: 'venda-fiado', fiadoPendente: true });
  });
});
