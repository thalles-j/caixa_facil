export type Oferta = 'produtos' | 'servicos' | 'ambos';
export type Recorrencia = 'mensal' | 'semanal';
export type FrequenciaRelatorio = 'semanal' | 'mensal' | 'ambos' | 'nenhum';
export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'fiado';
export type TipoConta = 'pagar' | 'receber';
export type TipoLancamento = 'entrada' | 'saida';
export type ViewPeriod = 'day' | 'week';

export interface DespesaFixa {
  id: string;
  nome: string;
  valor: number;
  recorrencia: Recorrencia;
}

export interface CompanyConfig {
  nome: string;
  categoria: string; // ramo de atuação — também define o tema visual (cor + ícone), ver lib/categoryThemes.ts
  oferta: Oferta;
  controlaEstoque: boolean;
  metaDiariaVendas?: number;
  despesasFixas: DespesaFixa[];
  relatorio: {
    frequencia: FrequenciaRelatorio;
    porEmail: boolean;
    email?: string;
  };
  viewPeriod: ViewPeriod; // resumo do Painel Inicial: "hoje" ou "últimos 7 dias"
  onboardingConcluido: boolean;
}

export interface Venda {
  id: string;
  data: string; // ISO date
  createdAt?: string; // instante ISO usado para ordenar vendas do mesmo dia
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  formaPagamento: FormaPagamento; // 'fiado' também cria uma Conta a receber automaticamente
  produtoId?: string;
}

export interface Produto {
  id: string;
  type: 'product' | 'service';
  nome: string;
  categoria?: string; // tag livre, ex: "Bebidas", "Doces" — usada nos filtros da tela de Catálogo
  precoVenda: number;
  custo?: number; // opcional, para cálculo de margem futuro
  quantidade?: number; // só para produtos
  quantidadeMinima?: number; // só para produtos
  duracao?: string; // só para serviços
}

export interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
}

export interface Conta {
  id: string;
  tipo: TipoConta;
  descricao: string;
  valor: number;
  vencimento: string; // ISO date
  quitado: boolean;
  dataQuitacao?: string; // ISO date — quando a conta foi de fato paga/recebida (preenchido ao dar baixa)
  quitadoEm?: string; // instante ISO da baixa, para ordenação dentro do mesmo dia
  origemVendaId?: string; // preenchido quando a conta a receber nasce de uma venda "fiado"
  clienteId?: string; // preenchido quando a conta a receber está vinculada a um cliente cadastrado
}

export interface LancamentoManual {
  id: string;
  data: string;
  createdAt?: string; // instante ISO usado para ordenar lançamentos do mesmo dia
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  formaPagamento?: FormaPagamento;
}

export interface AppData {
  config: CompanyConfig | null;
  vendas: Venda[];
  produtos: Produto[];
  contas: Conta[];
  lancamentosManuais: LancamentoManual[];
  clientes: Cliente[];
}

export const RAMOS_ATUACAO = [
  'Alimentação (Mercado, Padaria...)',
  'Vestuário e Acessórios',
  'Beleza e Cosméticos',
  'Serviços',
  'Outros',
] as const;
