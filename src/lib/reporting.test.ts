import { describe, expect, it } from 'vitest';
import {
  agruparMovimentosPorDia,
  agruparPagamentos,
  agruparProdutos,
  inicioDaSemana,
  inicioDaSemanaISO,
  semanaISO,
} from './reporting';
import type { TransacaoFinanceira, Venda } from '../types';

describe('consolidação dos relatórios de caixa', () => {
  it('agrupa produtos vendidos e preserva as formas de pagamento', () => {
    const vendas: Venda[] = [
      { id: '1', data: '2026-08-03', descricao: 'Café', quantidade: 2, valorUnitario: 8, formaPagamento: 'dinheiro', produtoId: 'cafe' },
      { id: '2', data: '2026-08-04', descricao: 'Café', quantidade: 3, valorUnitario: 8, formaPagamento: 'pix', produtoId: 'cafe' },
      { id: '3', data: '2026-08-04', descricao: 'Entrega', quantidade: 1, valorUnitario: 12, formaPagamento: 'cartao_debito', produtoId: 'entrega' },
    ];

    expect(agruparProdutos(vendas)).toEqual([
      expect.objectContaining({ nome: 'Café', quantidade: 5, faturamento: 40, formas: ['Dinheiro', 'Pix'] }),
      expect.objectContaining({ nome: 'Entrega', quantidade: 1, faturamento: 12, formas: ['Cartão de débito'] }),
    ]);
  });

  it('agrupa pessoas que pagaram e o movimento financeiro de cada dia', () => {
    const transacoes: TransacaoFinanceira[] = [
      { id: '1', tipo: 'entrada', origem: 'pagamento_fiado', descricao: 'Parcela', valor: 20, formaPagamento: 'pix', ocorridoEm: '2026-08-04T10:00:00.000Z', clienteId: 'ana', clienteNome: 'Ana' },
      { id: '2', tipo: 'entrada', origem: 'pagamento_fiado', descricao: 'Quitação', valor: 15, formaPagamento: 'dinheiro', ocorridoEm: '2026-08-04T11:00:00.000Z', clienteId: 'ana', clienteNome: 'Ana' },
      { id: '3', tipo: 'saida', origem: 'despesa_avulsa', descricao: 'Embalagens', valor: 10, formaPagamento: 'dinheiro', ocorridoEm: '2026-08-04T12:00:00.000Z' },
    ];

    expect(agruparPagamentos(transacoes.filter((item) => item.origem === 'pagamento_fiado'))[0]).toMatchObject({
      nome: 'Ana',
      quantidade: 2,
      total: 35,
      formas: ['Pix', 'Dinheiro'],
    });
    expect(agruparMovimentosPorDia(transacoes)[0]).toMatchObject({
      dia: '2026-08-04',
      entradas: 35,
      saidas: 10,
      saldo: 25,
      volume: 45,
      quantidade: 3,
    });
  });

  it('normaliza qualquer data para a segunda-feira da semana', () => {
    expect(inicioDaSemana('2026-08-09')).toBe('2026-08-03');
    expect(semanaISO('2026-08-09')).toBe('2026-W32');
    expect(inicioDaSemanaISO('2026-W32')).toBe('2026-08-03');
  });
});
