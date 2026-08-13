import type { TransacaoFinanceira, Venda } from '../types';

export type ProdutoAgrupado = {
  chave: string;
  nome: string;
  tipo?: Venda['tipoItem'];
  quantidade: number;
  faturamento: number;
  formas: string[];
};

export type PagamentoAgrupado = {
  chave: string;
  nome: string;
  quantidade: number;
  total: number;
  formas: string[];
};

export type MovimentoDiario = {
  dia: string;
  entradas: number;
  saidas: number;
  volume: number;
  saldo: number;
  quantidade: number;
};

export const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Cartão de crédito',
  cartao_debito: 'Cartão de débito',
  fiado: 'Fiado',
  outro: 'Outro',
};

export function dataLocalISO(iso?: string): string {
  if (!iso) return '';
  const data = new Date(iso);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarQuantidade(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export function agruparProdutos(vendas: Venda[]): ProdutoAgrupado[] {
  const grupos = new Map<string, ProdutoAgrupado & { formasSet: Set<string> }>();
  vendas.forEach((venda) => {
    const chave = venda.produtoId ?? venda.descricao.trim().toLocaleLowerCase('pt-BR');
    const atual = grupos.get(chave) ?? {
      chave,
      nome: venda.descricao,
      tipo: venda.tipoItem,
      quantidade: 0,
      faturamento: 0,
      formas: [],
      formasSet: new Set<string>(),
    };
    atual.quantidade += venda.quantidade;
    atual.faturamento += venda.quantidade * venda.valorUnitario;
    atual.formasSet.add(FORMAS_PAGAMENTO[venda.formaPagamento] ?? venda.formaPagamento);
    grupos.set(chave, atual);
  });
  return Array.from(grupos.values()).map(({ formasSet, ...produto }) => ({
    ...produto,
    formas: Array.from(formasSet),
  }));
}

export function agruparPagamentos(transacoes: TransacaoFinanceira[]): PagamentoAgrupado[] {
  const grupos = new Map<string, PagamentoAgrupado & { formasSet: Set<string> }>();
  transacoes.forEach((transacao) => {
    const chave = transacao.clienteId ?? transacao.clienteNome ?? transacao.id;
    const atual = grupos.get(chave) ?? {
      chave,
      nome: transacao.clienteNome ?? 'Cliente não identificado',
      quantidade: 0,
      total: 0,
      formas: [],
      formasSet: new Set<string>(),
    };
    atual.quantidade += 1;
    atual.total += transacao.valor;
    atual.formasSet.add(FORMAS_PAGAMENTO[transacao.formaPagamento] ?? transacao.formaPagamento);
    grupos.set(chave, atual);
  });
  return Array.from(grupos.values())
    .map(({ formasSet, ...pagamento }) => ({ ...pagamento, formas: Array.from(formasSet) }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

export function agruparMovimentosPorDia(transacoes: TransacaoFinanceira[]): MovimentoDiario[] {
  const grupos = new Map<string, MovimentoDiario>();
  transacoes.forEach((transacao) => {
    const dia = dataLocalISO(transacao.ocorridoEm);
    if (!dia) return;
    const atual = grupos.get(dia) ?? {
      dia,
      entradas: 0,
      saidas: 0,
      volume: 0,
      saldo: 0,
      quantidade: 0,
    };
    if (transacao.tipo === 'entrada') atual.entradas += transacao.valor;
    else atual.saidas += transacao.valor;
    atual.volume += transacao.valor;
    atual.saldo = atual.entradas - atual.saidas;
    atual.quantidade += 1;
    grupos.set(dia, atual);
  });
  return Array.from(grupos.values()).sort((a, b) => a.dia.localeCompare(b.dia));
}

export function inicioDaSemana(dataIso: string): string {
  const data = new Date(`${dataIso}T12:00:00`);
  const diaSemana = data.getDay();
  data.setDate(data.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  return dataLocalISO(data.toISOString());
}

export function semanaISO(dataIso: string): string {
  const data = new Date(`${dataIso}T12:00:00Z`);
  const diaSemana = data.getUTCDay() || 7;
  data.setUTCDate(data.getUTCDate() + 4 - diaSemana);
  const ano = data.getUTCFullYear();
  const inicioAno = new Date(Date.UTC(ano, 0, 1));
  const semana = Math.ceil(((data.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7);
  return `${ano}-W${String(semana).padStart(2, '0')}`;
}

export function inicioDaSemanaISO(semanaIso: string): string {
  const resultado = /^(\d{4})-W(\d{2})$/.exec(semanaIso);
  if (!resultado) return '';
  const ano = Number(resultado[1]);
  const semana = Number(resultado[2]);
  if (semana < 1 || semana > 53) return '';
  const primeiraSemana = new Date(Date.UTC(ano, 0, 4, 12));
  const diaSemana = primeiraSemana.getUTCDay() || 7;
  primeiraSemana.setUTCDate(primeiraSemana.getUTCDate() - diaSemana + 1 + (semana - 1) * 7);
  return primeiraSemana.toISOString().slice(0, 10);
}

export function somarDias(dataIso: string, quantidade: number): string {
  const data = new Date(`${dataIso}T12:00:00`);
  data.setDate(data.getDate() + quantidade);
  return dataLocalISO(data.toISOString());
}
