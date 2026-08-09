import { Storefront } from '@phosphor-icons/react';

export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center text-ink">
      <div className="w-full max-w-xs">
        <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-ledger text-paper shadow-md">
          <Storefront size={28} weight="fill" />
          <span className="absolute -inset-2 animate-ping rounded-3xl border border-ledger/30" />
        </div>
        <div className="mx-auto mb-4 h-1.5 w-36 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-ledger" />
        </div>
        <p className="mb-1 font-ledger text-[10px] font-bold uppercase tracking-[0.18em] text-ledger-strong dark:text-ledger">CaixaFacil</p>
        <p className="font-display text-xl font-bold text-ink">Preparando seu painel</p>
        <p className="mt-1 text-sm font-medium leading-relaxed text-ink-soft">
          Verificando sua sessão e atualizando as informações do dia…
        </p>
      </div>
    </div>
  );
}
