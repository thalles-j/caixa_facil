import { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { formatCurrency } from '../lib/format';
import { TIPOS_DESPESA } from '../types';
import type { LancamentoManual, TipoDespesa, TipoEntrada } from '../types';

const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Cartão',
  cartao_debito: 'Cartão',
};

export default function PendingIdentificationList({ lancamentos }: { lancamentos: LancamentoManual[] }) {
  const { data, resolverPendenciaNoBanco } = useAppData();
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const produtos = data.produtos.filter((produto) => produto.type === 'product');
  const servicos = data.produtos.filter((produto) => produto.type === 'service');

  const resolver = async (lancamento: LancamentoManual) => {
    const selecao = selecoes[lancamento.id];
    if (!selecao) {
      setErro(
        lancamento.tipo === 'entrada'
          ? 'Escolha qual produto, qual serviço ou marque como gorjeta.'
          : 'Escolha uma categoria para confirmar a despesa.',
      );
      return;
    }

    let classificacao: TipoEntrada | TipoDespesa;
    let produtoId: string | undefined;
    if (lancamento.tipo === 'entrada') {
      const [tipoEntrada, itemId] = selecao.split(':');
      classificacao = tipoEntrada as TipoEntrada;
      produtoId = itemId || undefined;
    } else {
      classificacao = selecao as TipoDespesa;
    }

    setResolvendoId(lancamento.id);
    setErro(null);
    try {
      await resolverPendenciaNoBanco(lancamento.id, classificacao, produtoId);
      setSelecoes((atual) => {
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
      {lancamentos.map((lancamento) => {
        const entrada = lancamento.tipo === 'entrada';
        const Icon = entrada ? ArrowUp : ArrowDown;

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

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selecoes[lancamento.id] ?? ''}
                onChange={(event) => setSelecoes((atual) => ({ ...atual, [lancamento.id]: event.target.value }))}
                aria-label={entrada ? 'Classificar entrada' : 'Classificar despesa'}
                className="min-w-0 flex-1 rounded-lg border border-line bg-paper-raised px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ledger/30"
              >
                <option value="">{entrada ? 'Qual produto, serviço ou gorjeta?' : 'Categoria da despesa'}</option>
                {entrada ? (
                  <>
                    <option value="gorjeta">Gorjeta — entrada direta</option>
                    {produtos.length > 0 && (
                      <optgroup label="Produtos">
                        {produtos.map((produto) => (
                          <option key={produto.id} value={`produto:${produto.id}`}>{produto.nome}</option>
                        ))}
                      </optgroup>
                    )}
                    {servicos.length > 0 && (
                      <optgroup label="Serviços">
                        {servicos.map((servico) => (
                          <option key={servico.id} value={`servico:${servico.id}`}>{servico.nome}</option>
                        ))}
                      </optgroup>
                    )}
                  </>
                ) : (
                  TIPOS_DESPESA.map((opcao) => (
                    <option key={opcao.valor} value={opcao.valor}>{opcao.label}</option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={() => void resolver(lancamento)}
                disabled={resolvendoId !== null || !selecoes[lancamento.id]}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ledger px-3 py-2 text-xs font-bold text-paper disabled:opacity-45"
              >
                <CheckCircle size={16} weight="fill" />
                {resolvendoId === lancamento.id ? 'Confirmando…' : 'Resolver'}
              </button>
            </div>
            {entrada && produtos.length === 0 && servicos.length === 0 && (
              <p className="mt-2 text-xs text-brass">
                Nenhum item ativo no catálogo; esta entrada ainda pode ser identificada como gorjeta.
              </p>
            )}
          </article>
        );
      })}

      {erro && (
        <p className="flex items-start gap-1.5 rounded-lg bg-stamp/10 px-3 py-2 text-xs font-medium text-stamp">
          <WarningCircle size={15} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}
    </div>
  );
}
