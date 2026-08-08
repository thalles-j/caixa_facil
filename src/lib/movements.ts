import type { AppData, FormaPagamento, TipoLancamento } from '../types';

export type OrigemMovimentacao = 'venda' | 'lancamento' | 'conta';

export interface Movimentacao {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: TipoLancamento;
  origem: OrigemMovimentacao;
  categoria: 'venda' | 'entrada' | 'despesa';
  detalhe: string;
  formaPagamento?: FormaPagamento;
  fiadoPendente?: boolean;
  ordem: number;
}

function ordenarMaisRecentesPrimeiro(movimentacoes: Movimentacao[]): Movimentacao[] {
  return movimentacoes.sort((a, b) => b.data.localeCompare(a.data) || b.ordem - a.ordem);
}

export function formaPagamentoLabel(forma: FormaPagamento): string {
  const labels: Record<FormaPagamento, string> = {
    dinheiro: 'Dinheiro',
    pix: 'Pix',
    cartao_credito: 'Cartão de crédito',
    cartao_debito: 'Cartão de débito',
    fiado: 'Fiado',
  };
  return labels[forma];
}

/** Movimentos que alteraram o caixa. Vendas fiado só aparecem depois da baixa. */
export function obterMovimentacoesFinanceiras(data: AppData): Movimentacao[] {
  const clientes = new Map(data.clientes.map((cliente) => [cliente.id, cliente.nome]));

  const vendas: Movimentacao[] = data.vendas
    .filter((venda) => venda.formaPagamento !== 'fiado')
    .map((venda, index) => ({
      id: venda.id,
      data: venda.data,
      descricao: venda.descricao,
      valor: venda.quantidade * venda.valorUnitario,
      tipo: 'entrada',
      origem: 'venda',
      categoria: 'venda',
      detalhe: `Venda · ${formaPagamentoLabel(venda.formaPagamento)}`,
      formaPagamento: venda.formaPagamento,
      ordem: index * 3 + 2,
    }));

  const lancamentos: Movimentacao[] = data.lancamentosManuais.map((lancamento, index) => ({
    id: lancamento.id,
    data: lancamento.data,
    descricao: lancamento.descricao,
    valor: lancamento.valor,
    tipo: lancamento.tipo,
    origem: 'lancamento',
    categoria: lancamento.tipo === 'entrada' ? 'entrada' : 'despesa',
    detalhe: lancamento.tipo === 'entrada' ? 'Entrada manual' : 'Saída manual',
    ordem: index * 3 + 1,
  }));

  const contas: Movimentacao[] = data.contas
    .filter((conta) => conta.quitado && conta.dataQuitacao)
    .map((conta, index) => {
      const nomeCliente = conta.clienteId ? clientes.get(conta.clienteId) : undefined;
      const recebimentoFiado = conta.tipo === 'receber' && Boolean(conta.origemVendaId);
      return {
        id: conta.id,
        data: conta.dataQuitacao!,
        descricao: nomeCliente ? `${nomeCliente} — ${conta.descricao}` : conta.descricao,
        valor: conta.valor,
        tipo: conta.tipo === 'receber' ? 'entrada' : 'saida',
        origem: 'conta',
        categoria: conta.tipo === 'receber' ? 'entrada' : 'despesa',
        detalhe: recebimentoFiado ? 'Pagamento de fiado' : conta.tipo === 'receber' ? 'Conta recebida' : 'Despesa paga',
        ordem: index * 3,
      };
    });

  return ordenarMaisRecentesPrimeiro([...vendas, ...lancamentos, ...contas]);
}

/** Histórico comercial completo, incluindo fiado ainda não recebido. */
export function obterVendas(data: AppData): Movimentacao[] {
  const contasPorVenda = new Map(
    data.contas.filter((conta) => conta.origemVendaId).map((conta) => [conta.origemVendaId!, conta]),
  );

  return ordenarMaisRecentesPrimeiro(
    data.vendas.map((venda, index) => {
      const conta = contasPorVenda.get(venda.id);
      const fiadoPendente = venda.formaPagamento === 'fiado' && !conta?.quitado;
      return {
        id: venda.id,
        data: venda.data,
        descricao: venda.descricao,
        valor: venda.quantidade * venda.valorUnitario,
        tipo: 'entrada',
        origem: 'venda',
        categoria: 'venda',
        detalhe:
          venda.formaPagamento === 'fiado'
            ? fiadoPendente
              ? 'Fiado · aguardando pagamento'
              : `Fiado · recebido${conta?.dataQuitacao ? ` em ${conta.dataQuitacao}` : ''}`
            : `${venda.quantidade} un. · ${formaPagamentoLabel(venda.formaPagamento)}`,
        formaPagamento: venda.formaPagamento,
        fiadoPendente,
        ordem: index,
      };
    }),
  );
}
