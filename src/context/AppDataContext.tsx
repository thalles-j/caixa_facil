import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  AppData,
  Cliente,
  CompanyConfig,
  Conta,
  LancamentoManual,
  Produto,
  Venda,
  ViewPeriod,
} from '../types';
import { loadData, saveData, uid } from '../lib/storage';
import { todayISO } from '../lib/format';

interface ResumoPeriodo {
  vendas: number;
  despesas: number;
}

interface AppDataContextValue {
  data: AppData;
  setConfig: (config: CompanyConfig) => void;
  addVenda: (venda: Omit<Venda, 'id'>, opts?: { clienteId?: string }) => void;
  addProduto: (produto: Omit<Produto, 'id'>) => void;
  atualizarProduto: (id: string, patch: Partial<Omit<Produto, 'id'>>) => void;
  addConta: (conta: Omit<Conta, 'id' | 'quitado'>) => void;
  marcarContaQuitada: (id: string, dataPagamento?: string) => void;
  addLancamentoManual: (lancamento: Omit<LancamentoManual, 'id'>) => void;
  addCliente: (cliente: Omit<Cliente, 'id'>) => Cliente;
  resetData: () => void;
  saldoCaixa: number;
  vendasHoje: number;
  despesasHoje: number;
  lucroEstimadoHoje: number;
  resumoPeriodo: ResumoPeriodo;
  vendasUltimos7Dias: { data: string; total: number }[];
  contasAPagarHoje: Conta[];
  contasAReceberEmAberto: Conta[];
  contasVencendoEmBreve: Conta[];
  contasVencidas: Conta[];
  contasQuitadasHoje: Conta[];
  produtosEstoqueBaixo: Produto[];
  totalNotificacoes: number;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function ultimosNDias(hoje: string, n: number): string[] {
  const base = new Date(`${hoje}T00:00:00`);
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

function diffDias(deIso: string, paraIso: string): number {
  const de = new Date(`${deIso}T00:00:00`);
  const para = new Date(`${paraIso}T00:00:00`);
  return Math.round((para.getTime() - de.getTime()) / 86_400_000);
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());

  useEffect(() => {
    saveData(data);
  }, [data]);

  const setConfig = (config: CompanyConfig) => {
    setData((prev) => ({ ...prev, config }));
  };

  const addVenda = (venda: Omit<Venda, 'id'>, opts?: { clienteId?: string }) => {
    const novaVenda: Venda = { ...venda, id: uid() };

    setData((prev) => {
      let produtos = prev.produtos;
      if (novaVenda.produtoId) {
        produtos = prev.produtos.map((p) =>
          p.id === novaVenda.produtoId
            ? { ...p, quantidade: Math.max(0, p.quantidade - novaVenda.quantidade) }
            : p,
        );
      }

      let contas = prev.contas;
      if (novaVenda.formaPagamento === 'fiado') {
        const contaFiado: Conta = {
          id: uid(),
          tipo: 'receber',
          descricao: novaVenda.descricao,
          valor: novaVenda.quantidade * novaVenda.valorUnitario,
          vencimento: novaVenda.data,
          quitado: false,
          origemVendaId: novaVenda.id,
          clienteId: opts?.clienteId,
        };
        contas = [...prev.contas, contaFiado];
      }

      return { ...prev, vendas: [...prev.vendas, novaVenda], produtos, contas };
    });
  };

  const addProduto = (produto: Omit<Produto, 'id'>) => {
    setData((prev) => ({ ...prev, produtos: [...prev.produtos, { ...produto, id: uid() }] }));
  };

  const atualizarProduto = (id: string, patch: Partial<Omit<Produto, 'id'>>) => {
    setData((prev) => ({
      ...prev,
      produtos: prev.produtos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const addConta = (conta: Omit<Conta, 'id' | 'quitado'>) => {
    setData((prev) => ({
      ...prev,
      contas: [...prev.contas, { ...conta, id: uid(), quitado: false }],
    }));
  };

  const marcarContaQuitada = (id: string, dataPagamento?: string) => {
    setData((prev) => ({
      ...prev,
      contas: prev.contas.map((c) =>
        c.id === id ? { ...c, quitado: true, dataQuitacao: dataPagamento ?? todayISO() } : c,
      ),
    }));
  };

  const addLancamentoManual = (lancamento: Omit<LancamentoManual, 'id'>) => {
    setData((prev) => ({
      ...prev,
      lancamentosManuais: [...prev.lancamentosManuais, { ...lancamento, id: uid() }],
    }));
  };

  const addCliente = (cliente: Omit<Cliente, 'id'>): Cliente => {
    const novoCliente: Cliente = { ...cliente, id: uid() };
    setData((prev) => ({ ...prev, clientes: [...prev.clientes, novoCliente] }));
    return novoCliente;
  };

  const resetData = () => {
    setData({ config: null, vendas: [], produtos: [], contas: [], lancamentosManuais: [], clientes: [] });
  };

  const hoje = todayISO();
  const viewPeriod: ViewPeriod = data.config?.viewPeriod ?? 'day';

  const vendasHoje = useMemo(
    () =>
      data.vendas
        .filter((v) => v.data === hoje)
        .reduce((sum, v) => sum + v.quantidade * v.valorUnitario, 0),
    [data.vendas, hoje],
  );

  const contasQuitadasHoje = useMemo(
    () => data.contas.filter((c) => c.quitado && c.dataQuitacao === hoje),
    [data.contas, hoje],
  );

  const despesasHoje = useMemo(() => {
    const contasPagas = contasQuitadasHoje
      .filter((c) => c.tipo === 'pagar')
      .reduce((sum, c) => sum + c.valor, 0);
    const lancamentosSaida = data.lancamentosManuais
      .filter((l) => l.tipo === 'saida' && l.data === hoje)
      .reduce((sum, l) => sum + l.valor, 0);
    return contasPagas + lancamentosSaida;
  }, [contasQuitadasHoje, data.lancamentosManuais, hoje]);

  const lucroEstimadoHoje = useMemo(() => {
    return data.vendas
      .filter((v) => v.data === hoje && v.produtoId)
      .reduce((sum, v) => {
        const produto = data.produtos.find((p) => p.id === v.produtoId);
        if (!produto || produto.custo === undefined) return sum;
        return sum + (v.valorUnitario - produto.custo) * v.quantidade;
      }, 0);
  }, [data.vendas, data.produtos, hoje]);

  const resumoPeriodo = useMemo<ResumoPeriodo>(() => {
    const dias = viewPeriod === 'day' ? [hoje] : ultimosNDias(hoje, 7);
    const diasSet = new Set(dias);

    const vendas = data.vendas
      .filter((v) => diasSet.has(v.data))
      .reduce((sum, v) => sum + v.quantidade * v.valorUnitario, 0);

    const contasPagas = data.contas
      .filter((c) => c.tipo === 'pagar' && c.quitado && c.dataQuitacao && diasSet.has(c.dataQuitacao))
      .reduce((sum, c) => sum + c.valor, 0);
    const lancamentosSaida = data.lancamentosManuais
      .filter((l) => l.tipo === 'saida' && diasSet.has(l.data))
      .reduce((sum, l) => sum + l.valor, 0);

    return { vendas, despesas: contasPagas + lancamentosSaida };
  }, [data.vendas, data.contas, data.lancamentosManuais, viewPeriod, hoje]);

  const vendasUltimos7Dias = useMemo(() => {
    const dias = ultimosNDias(hoje, 7);
    return dias.map((data_) => ({
      data: data_,
      total: data.vendas
        .filter((v) => v.data === data_)
        .reduce((sum, v) => sum + v.quantidade * v.valorUnitario, 0),
    }));
  }, [data.vendas, hoje]);

  const saldoCaixa = useMemo(() => {
    const entradasVendas = data.vendas
      .filter((v) => v.formaPagamento !== 'fiado')
      .reduce((sum, v) => sum + v.quantidade * v.valorUnitario, 0);
    const entradasContasRecebidas = data.contas
      .filter((c) => c.tipo === 'receber' && c.quitado)
      .reduce((sum, c) => sum + c.valor, 0);
    const saidasContasPagas = data.contas
      .filter((c) => c.tipo === 'pagar' && c.quitado)
      .reduce((sum, c) => sum + c.valor, 0);
    const entradasManuais = data.lancamentosManuais
      .filter((l) => l.tipo === 'entrada')
      .reduce((sum, l) => sum + l.valor, 0);
    const saidasManuais = data.lancamentosManuais
      .filter((l) => l.tipo === 'saida')
      .reduce((sum, l) => sum + l.valor, 0);

    return (
      entradasVendas +
      entradasContasRecebidas +
      entradasManuais -
      saidasContasPagas -
      saidasManuais
    );
  }, [data.vendas, data.contas, data.lancamentosManuais]);

  const contasAPagarHoje = useMemo(
    () => data.contas.filter((c) => c.tipo === 'pagar' && !c.quitado && c.vencimento === hoje),
    [data.contas, hoje],
  );

  const contasAReceberEmAberto = useMemo(
    () => data.contas.filter((c) => c.tipo === 'receber' && !c.quitado),
    [data.contas],
  );

  const contasVencendoEmBreve = useMemo(
    () =>
      data.contas.filter((c) => {
        if (c.tipo !== 'pagar' || c.quitado) return false;
        const dias = diffDias(hoje, c.vencimento);
        return dias > 0 && dias <= 3;
      }),
    [data.contas, hoje],
  );

  const contasVencidas = useMemo(
    () =>
      data.contas.filter((c) => {
        if (c.tipo !== 'pagar' || c.quitado) return false;
        return diffDias(hoje, c.vencimento) < 0;
      }),
    [data.contas, hoje],
  );

  const produtosEstoqueBaixo = useMemo(
    () => data.produtos.filter((p) => p.quantidade <= p.quantidadeMinima),
    [data.produtos],
  );

  const totalNotificacoes = produtosEstoqueBaixo.length + contasVencendoEmBreve.length + contasVencidas.length;

  const value: AppDataContextValue = {
    data,
    setConfig,
    addVenda,
    addProduto,
    atualizarProduto,
    addConta,
    marcarContaQuitada,
    addLancamentoManual,
    addCliente,
    resetData,
    saldoCaixa,
    vendasHoje,
    despesasHoje,
    lucroEstimadoHoje,
    resumoPeriodo,
    vendasUltimos7Dias,
    contasAPagarHoje,
    contasAReceberEmAberto,
    contasVencendoEmBreve,
    contasVencidas,
    contasQuitadasHoje,
    produtosEstoqueBaixo,
    totalNotificacoes,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData deve ser usado dentro de AppDataProvider');
  return ctx;
}
