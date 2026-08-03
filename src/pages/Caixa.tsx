import { useMemo, useState } from 'react';
import {
  MagnifyingGlass,
  Camera,
  ShoppingCartSimple,
  CheckCircle,
  Money,
  QrCode,
  CreditCard,
  BookBookmark,
  Trash,
  UserCirclePlus,
  Check,
} from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, parseMoney, todayISO } from '../lib/format';
import type { Cliente, FormaPagamento } from '../types';

interface ItemCarrinho {
  key: string;
  produtoId?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

const FORMAS: { forma: FormaPagamento; label: string; Icon: typeof Money; classes: string }[] = [
  { forma: 'dinheiro', label: 'Dinheiro', Icon: Money, classes: 'bg-line/50 text-ink' },
  { forma: 'pix', label: 'Pix', Icon: QrCode, classes: 'bg-ledger/15 text-ledger-strong dark:text-ledger' },
  { forma: 'cartao_credito', label: 'Cartão', Icon: CreditCard, classes: 'bg-line/50 text-ink' },
  { forma: 'fiado', label: 'Fiado', Icon: BookBookmark, classes: 'bg-brass/15 text-brass' },
];

export default function Caixa() {
  const { data, addVenda, addCliente } = useAppData();
  const [busca, setBusca] = useState('');
  const [valorAvulso, setValorAvulso] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaSelecionada, setFormaSelecionada] = useState<FormaPagamento | null>(null);

  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false);

  const resultados = useMemo(() => {
    if (!busca.trim()) return [];
    const termo = busca.trim().toLowerCase();
    return data.produtos.filter((p) => p.nome.toLowerCase().includes(termo)).slice(0, 6);
  }, [busca, data.produtos]);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return data.clientes.slice(0, 6);
    return data.clientes.filter((c) => c.nome.toLowerCase().includes(termo)).slice(0, 6);
  }, [buscaCliente, data.clientes]);

  const total = carrinho.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0);

  const adicionarProduto = (produtoId: string) => {
    const produto = data.produtos.find((p) => p.id === produtoId);
    if (!produto) return;

    const jaNoCarrinho = carrinho.find((i) => i.produtoId === produtoId)?.quantidade ?? 0;
    if (produto.type === 'product' && jaNoCarrinho + 1 > (produto.quantidade ?? 0)) {
      alert(`Estoque insuficiente: só há ${produto.quantidade ?? 0} unidade(s) de "${produto.nome}" disponível.`);
      return;
    }

    setCarrinho((prev) => {
      const existente = prev.find((i) => i.produtoId === produtoId);
      if (existente) {
        return prev.map((i) => (i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [
        ...prev,
        {
          key: produto.id,
          produtoId: produto.id,
          descricao: produto.nome,
          quantidade: 1,
          valorUnitario: produto.precoVenda,
        },
      ];
    });
    setBusca('');
  };

  const adicionarAvulso = () => {
    const valor = parseMoney(valorAvulso);
    if (!valor || valor <= 0) return;
    setCarrinho((prev) => [
      ...prev,
      { key: `avulso-${Date.now()}-${prev.length}`, descricao: 'Diversos', quantidade: 1, valorUnitario: valor },
    ]);
    setValorAvulso('');
  };

  const removerItem = (key: string) => {
    setCarrinho((prev) => prev.filter((i) => i.key !== key));
  };

  const lerCodigo = () => {
    // TODO: integração real fica para versão futura com backend
    alert('Leitura de código de barras simulada — nenhum scanner real conectado.');
  };

  const selecionarForma = (forma: FormaPagamento) => {
    setFormaSelecionada(forma);
    if (forma !== 'fiado') {
      setClienteSelecionado(null);
      setCadastrandoCliente(false);
    }
  };

  const cadastrarCliente = () => {
    if (!novoClienteNome.trim()) return;
    const cliente = addCliente({
      nome: novoClienteNome.trim(),
      telefone: novoClienteTelefone.trim() || undefined,
    });
    setClienteSelecionado(cliente);
    setCadastrandoCliente(false);
    setNovoClienteNome('');
    setNovoClienteTelefone('');
  };

  const finalizarVenda = () => {
    if (!podeFinalizar) return;

    // reconfere contra o estoque atual — protege contra edições no Estoque
    // feitas depois que o item já estava no carrinho
    for (const item of carrinho) {
      if (item.quantidade <= 0 || item.valorUnitario <= 0) {
        alert('Item de venda inválido: quantidade e valor precisam ser maiores que zero.');
        return;
      }
      if (item.produtoId) {
        const produtoAtual = data.produtos.find((p) => p.id === item.produtoId);
        if (
          produtoAtual &&
          produtoAtual.type === 'product' &&
          (produtoAtual.quantidade ?? 0) < item.quantidade
        ) {
          alert(
            `Estoque insuficiente: só há ${produtoAtual.quantidade ?? 0} unidade(s) de "${item.descricao}" disponível.`,
          );
          return;
        }
      }
    }

    const hoje = todayISO();
    carrinho.forEach((item) => {
      addVenda(
        {
          data: hoje,
          descricao: item.descricao,
          quantidade: item.quantidade,
          valorUnitario: item.valorUnitario,
          formaPagamento: formaSelecionada!,
          produtoId: item.produtoId,
        },
        formaSelecionada === 'fiado' && clienteSelecionado ? { clienteId: clienteSelecionado.id } : undefined,
      );
    });
    setCarrinho([]);
    setFormaSelecionada(null);
    setClienteSelecionado(null);
    alert('Venda registrada com sucesso!');
  };

  const precisaCliente = formaSelecionada === 'fiado';
  const podeFinalizar =
    carrinho.length > 0 && formaSelecionada !== null && (!precisaCliente || clienteSelecionado !== null);

  return (
    <div className="fade-in">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Frente de Caixa</h2>
        <button onClick={lerCodigo} className="flex items-center gap-1 text-sm font-medium text-ledger-strong dark:text-ledger">
          <Camera size={18} /> Ler Código
        </button>
      </div>

      <div className="receipt-edge flex h-[60vh] flex-col rounded-2xl border border-line bg-paper-raised p-4 pb-6 shadow-sm lg:h-[65vh]">
        <div className="relative mb-2">
          <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto cadastrado..."
            className="w-full rounded-xl border border-line bg-paper py-3 pl-10 pr-4 text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ledger"
          />
          {resultados.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-line bg-paper-raised shadow-lg">
              {resultados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => adicionarProduto(p.id)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-line/30"
                >
                  <span className="min-w-0 truncate text-ink">{p.nome}</span>
                  <span className="shrink-0 font-ledger text-ink-soft">{formatCurrency(p.precoVenda)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-2 flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={valorAvulso}
            onChange={(e) => setValorAvulso(e.target.value)}
            placeholder="Ou digite um valor avulso (ex: 12,50)"
            className="w-full rounded-xl border border-line bg-paper px-4 py-2 text-sm text-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ledger"
          />
          <button
            onClick={adicionarAvulso}
            className="whitespace-nowrap rounded-xl bg-ledger/10 px-3 text-sm font-medium text-ledger-strong dark:text-ledger"
          >
            Adicionar
          </button>
        </div>

        <div className="mb-2 flex-1 overflow-y-auto border-b border-line pb-2">
          {carrinho.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-ink-soft">
              <ShoppingCartSimple size={40} className="mb-2 opacity-60" />
              <p className="text-center text-sm">
                Adicione produtos ou <br />
                digite um valor avulso.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {carrinho.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{item.descricao}</p>
                    <p className="font-ledger text-xs text-ink-soft">
                      {item.quantidade} x {formatCurrency(item.valorUnitario)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-ledger text-sm font-bold tabular-nums text-ink">
                      {formatCurrency(item.quantidade * item.valorUnitario)}
                    </span>
                    <button onClick={() => removerItem(item.key)} className="text-ink-soft hover:text-stamp">
                      <Trash size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-auto">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-medium text-ink-soft">Total a Pagar</span>
            <span className="font-ledger text-2xl font-bold tabular-nums text-ledger-strong dark:text-ledger">
              {formatCurrency(total)}
            </span>
          </div>

          <div className={`grid grid-cols-4 gap-2 ${carrinho.length === 0 ? 'pointer-events-none opacity-50' : ''}`}>
            {FORMAS.map(({ forma, label, Icon, classes }) => (
              <button
                key={forma}
                onClick={() => selecionarForma(forma)}
                className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium ${classes} ${
                  formaSelecionada === forma ? 'ring-2 ring-ledger' : ''
                }`}
              >
                <Icon size={18} /> {label}
              </button>
            ))}
          </div>

          {precisaCliente && (
            <div className="fade-in mt-3 rounded-xl border border-brass/30 bg-brass/10 p-3">
              {clienteSelecionado ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-brass">
                    <Check size={16} weight="bold" className="shrink-0" />
                    <span className="min-w-0 truncate">{clienteSelecionado.nome}</span>
                  </div>
                  <button
                    onClick={() => setClienteSelecionado(null)}
                    className="shrink-0 text-xs font-medium text-brass underline"
                  >
                    Trocar
                  </button>
                </div>
              ) : cadastrandoCliente ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    autoFocus
                    value={novoClienteNome}
                    onChange={(e) => setNovoClienteNome(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger"
                  />
                  <input
                    type="text"
                    value={novoClienteTelefone}
                    onChange={(e) => setNovoClienteTelefone(e.target.value)}
                    placeholder="Telefone (opcional)"
                    className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCadastrandoCliente(false)}
                      className="flex-1 rounded-lg bg-line/50 py-2 text-xs font-medium text-ink"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={cadastrarCliente}
                      className="flex-1 rounded-lg bg-brass py-2 text-xs font-bold text-paper"
                    >
                      Cadastrar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brass">Quem é o cliente?</p>
                  <input
                    type="text"
                    value={buscaCliente}
                    onChange={(e) => setBuscaCliente(e.target.value)}
                    placeholder="Buscar cliente cadastrado..."
                    className="w-full rounded-lg border border-line bg-paper p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger"
                  />
                  {clientesFiltrados.length > 0 && (
                    <ul className="max-h-28 overflow-y-auto rounded-lg border border-line bg-paper-raised">
                      {clientesFiltrados.map((c) => (
                        <li key={c.id}>
                          <button
                            onClick={() => setClienteSelecionado(c)}
                            className="w-full truncate px-3 py-2 text-left text-sm text-ink hover:bg-line/30"
                          >
                            {c.nome}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    onClick={() => setCadastrandoCliente(true)}
                    className="flex w-full items-center justify-center gap-1 rounded-lg border border-brass/40 py-2 text-xs font-medium text-brass"
                  >
                    <UserCirclePlus size={16} /> Cadastrar novo cliente
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={finalizarVenda}
            disabled={!podeFinalizar}
            className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold text-paper shadow-md transition active:scale-[0.98] ${
              podeFinalizar ? 'bg-ledger hover:bg-ledger-strong' : 'cursor-not-allowed bg-ledger opacity-50'
            }`}
          >
            <CheckCircle size={20} /> Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
