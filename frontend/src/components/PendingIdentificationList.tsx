import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle, Package, WarningCircle, Wrench } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency, sanitizeIntegerInput } from '../lib/format';
import { TIPOS_DESPESA } from '../types';
import type { LancamentoManual, TipoDespesa, TipoEntrada } from '../types';
import Pagination from './Pagination';
import { paginateItems } from '../lib/pagination';

const TIPOS_ENTRADA: ReadonlyArray<{ valor: TipoEntrada; label: string }> = [
  { valor: 'produto', label: 'Produto' },
  { valor: 'servico', label: 'Serviço' },
  { valor: 'gorjeta', label: 'Gorjeta' },
];

const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Cartão',
  cartao_debito: 'Cartão',
};

export default function PendingIdentificationList({ lancamentos }: { lancamentos: LancamentoManual[] }) {
  const { data, resolverPendenciaNoBanco } = useAppData();
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [itensSelecionados, setItensSelecionados] = useState<Record<string, string>>({});
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const lancamentosPaginados = paginateItems(lancamentos, pagina);

  const resolver = async (lancamento: LancamentoManual) => {
    const classificacao = (
      selecoes[lancamento.id] ??
      (lancamento.tipo === 'entrada' ? lancamento.tipoEntrada : lancamento.tipoDespesa)
    ) as TipoEntrada | TipoDespesa | undefined;
    const exigeItemCatalogo = classificacao === 'produto' || classificacao === 'servico';
    const produtoId = itensSelecionados[lancamento.id];
    const quantidade = classificacao === 'produto' ? Number(quantidades[lancamento.id] ?? '1') : undefined;
    if (!classificacao) {
      setErro(
        lancamento.tipo === 'entrada'
          ? 'Escolha Produto, Serviço ou Gorjeta para confirmar a entrada.'
          : 'Escolha uma categoria para confirmar a despesa.',
      );
      return;
    }
    if (exigeItemCatalogo && !produtoId) {
      setErro(`Selecione qual ${classificacao === 'produto' ? 'produto' : 'serviço'} deseja abater.`);
      return;
    }
    if (classificacao === 'produto') {
      const produto = data.produtos.find((item) => item.id === produtoId && item.type === 'product');
      if (!Number.isInteger(quantidade) || Number(quantidade) <= 0) {
        setErro('Informe uma quantidade inteira maior que zero.');
        return;
      }
      if (produto && Number(quantidade) > (produto.quantidade ?? 0)) {
        setErro(`Estoque insuficiente. Disponível: ${produto.quantidade ?? 0}.`);
        return;
      }
    }

    setResolvendoId(lancamento.id);
    setErro(null);
    try {
      await resolverPendenciaNoBanco(lancamento.id, classificacao, produtoId, quantidade);
      setSelecoes((atual) => {
        const proximo = { ...atual };
        delete proximo[lancamento.id];
        return proximo;
      });
      setItensSelecionados((atual) => {
        const proximo = { ...atual };
        delete proximo[lancamento.id];
        return proximo;
      });
      setQuantidades((atual) => {
        const proximo = { ...atual };
        delete proximo[lancamento.id];
        return proximo;
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível resolver a pendência.');
    } finally {
      setResolvendoId(null);
    }
  };

  return (
    <div className="space-y-3">
      {lancamentosPaginados.items.map((lancamento) => {
        const entrada = lancamento.tipo === 'entrada';
        const Icon = entrada ? ArrowUp : ArrowDown;
        const classificacao = (
          selecoes[lancamento.id] ?? (entrada ? lancamento.tipoEntrada : lancamento.tipoDespesa) ?? ''
        ) as TipoEntrada | TipoDespesa | '';
        const exigeItemCatalogo = classificacao === 'produto' || classificacao === 'servico';
        const tipoCatalogo = classificacao === 'produto' ? 'product' : 'service';
        const itensCatalogo = exigeItemCatalogo
          ? data.produtos.filter((item) => item.type === tipoCatalogo)
          : [];
        const itemSelecionado = itensCatalogo.find((item) => item.id === itensSelecionados[lancamento.id]);
        const quantidadeInformada = Number(quantidades[lancamento.id] ?? '1');
        const quantidadeValida = classificacao !== 'produto' || (
          Number.isInteger(quantidadeInformada) &&
          quantidadeInformada > 0 &&
          quantidadeInformada <= (itemSelecionado?.quantidade ?? 0)
        );
        const podeResolver = Boolean(classificacao) &&
          (!exigeItemCatalogo || Boolean(itemSelecionado)) &&
          quantidadeValida;

        return (
          <article key={lancamento.id} className="rounded-xl border border-brass/30 bg-paper p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={`mt-0.5 rounded-lg p-1.5 ${entrada ? 'bg-ledger/10 text-ledger-strong' : 'bg-stamp/10 text-stamp'}`}>
                  <Icon size={15} weight="bold" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{lancamento.descricao}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {entrada ? 'Entrada' : 'Despesa'} · {FORMAS_PAGAMENTO[lancamento.formaPagamento ?? ''] ?? 'Forma não informada'}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 font-ledger text-sm font-bold ${entrada ? 'text-ledger-strong dark:text-ledger' : 'text-stamp'}`}>
                {entrada ? '+ ' : '- '}{formatCurrency(lancamento.valor)}
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {entrada ? (
                <div
                  data-selected={classificacao}
                  data-choice-position={
                    classificacao === 'servico' ? 'second' : classificacao === 'gorjeta' ? 'third' : 'first'
                  }
                  className="segmented-slider segmented-slider-3 pending-type-selector grid grid-cols-3 rounded-xl border border-line bg-line/40 p-1"
                  aria-label="Classificar entrada"
                >
                  {TIPOS_ENTRADA.map((opcao) => {
                    const selecionada = classificacao === opcao.valor;
                    const OpcaoIcon = opcao.valor === 'produto' ? Package : opcao.valor === 'servico' ? Wrench : CheckCircle;
                    return (
                      <button
                        key={opcao.valor}
                        type="button"
                        aria-pressed={selecionada}
                        onClick={() => {
                          setSelecoes((atual) => ({ ...atual, [lancamento.id]: opcao.valor }));
                          setItensSelecionados((atual) => {
                            const proximo = { ...atual };
                            delete proximo[lancamento.id];
                            return proximo;
                          });
                          setQuantidades((atual) => ({ ...atual, [lancamento.id]: '1' }));
                          setErro(null);
                        }}
                        className={`selection-option flex min-w-0 items-center justify-center gap-1 rounded-lg border-0 px-2 py-2 text-xs font-semibold ${
                          selecionada
                            ? opcao.valor === 'produto'
                              ? 'bg-ledger text-paper shadow-sm'
                              : opcao.valor === 'servico'
                                ? 'bg-brass text-paper shadow-sm'
                                : 'bg-paper-raised text-ink shadow-sm'
                            : 'bg-transparent text-ink-soft hover:text-ink'
                        }`}
                      >
                        <OpcaoIcon size={14} className="shrink-0" />
                        <span className="truncate">{opcao.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select
                  value={classificacao}
                  onChange={(event) => {
                    setSelecoes((atual) => ({ ...atual, [lancamento.id]: event.target.value }));
                    setErro(null);
                  }}
                  aria-label="Classificar despesa"
                  className="w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
                >
                  <option value="">Categoria da despesa</option>
                  {TIPOS_DESPESA.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>{opcao.label}</option>
                  ))}
                </select>
              )}

              {entrada && exigeItemCatalogo && (
                <div
                  key={classificacao}
                  data-kind={tipoCatalogo}
                  className={`pending-fields-enter ${
                    classificacao === 'produto' ? 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]' : ''
                  }`}
                >
                <label className="block min-w-0">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                    {classificacao === 'produto' ? 'Qual produto?' : 'Qual serviço?'}
                  </span>
                  <select
                    value={itensSelecionados[lancamento.id] ?? ''}
                    onChange={(event) => {
                      setItensSelecionados((atual) => ({ ...atual, [lancamento.id]: event.target.value }));
                      setErro(null);
                    }}
                    aria-label={classificacao === 'produto' ? 'Selecionar produto' : 'Selecionar serviço'}
                    className="w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
                  >
                    <option value="">
                      {itensCatalogo.length > 0
                        ? `Selecione ${classificacao === 'produto' ? 'o produto' : 'o serviço'}`
                        : `Nenhum ${classificacao === 'produto' ? 'produto' : 'serviço'} cadastrado`}
                    </option>
                    {itensCatalogo.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome} · {formatCurrency(item.precoVenda)}
                        {item.type === 'product' ? ` · estoque: ${item.quantidade ?? 0}` : item.duracao ? ` · ${item.duracao}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {classificacao === 'produto' && (
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                      Unidades
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={quantidades[lancamento.id] ?? '1'}
                      onChange={(event) => {
                        setQuantidades((atual) => ({
                          ...atual,
                          [lancamento.id]: sanitizeIntegerInput(event.target.value),
                        }));
                        setErro(null);
                      }}
                      aria-label="Unidades do produto"
                      className="w-full rounded-lg border border-line bg-paper-raised px-3 py-2 text-center font-ledger text-sm font-bold text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
                    />
                  </label>
                )}
                </div>
              )}

              <button
                type="button"
                onClick={() => void resolver(lancamento)}
                disabled={resolvendoId !== null || !podeResolver}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-ledger px-3 py-2.5 text-xs font-bold text-paper transition-colors hover:bg-ledger-strong disabled:opacity-45"
              >
                <CheckCircle size={16} weight="fill" />
                {resolvendoId === lancamento.id ? 'Abatendo…' : 'Abater pendência'}
              </button>
            </div>
          </article>
        );
      })}

      {erro && (
        <p className="flex items-start gap-1.5 rounded-lg bg-stamp/10 px-3 py-2 text-xs font-medium text-stamp">
          <WarningCircle size={15} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}
      <Pagination
        currentPage={lancamentosPaginados.currentPage}
        totalItems={lancamentos.length}
        onPageChange={setPagina}
        itemLabel="pendências"
      />
    </div>
  );
}
