import { type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Storefront } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';

export default function Login() {
  const navigate = useNavigate();
  const { data } = useAppData();
  const onboardingConcluido = data.config?.onboardingConcluido ?? false;

  const entrar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate(onboardingConcluido ? '/' : '/onboarding');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-12 text-ink">
      <Link to="/" className="mb-8 flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Voltar para a apresentação
      </Link>

      <div className="receipt-edge w-full max-w-sm rounded-2xl border border-line bg-paper-raised px-7 pb-10 pt-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ledger text-paper">
            <Storefront size={24} weight="fill" />
          </div>
          <h1 className="font-display text-2xl font-bold">Bem-vindo de volta</h1>
          <p className="mt-1 text-sm text-ink-soft">Entre para abrir sua caderneta.</p>
        </div>

        <form className="space-y-4" onSubmit={entrar}>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">E-mail</label>
            <input
              type="email"
              required
              placeholder="voce@seunegocio.com"
              className="w-full rounded-lg border border-line bg-paper p-2.5 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">Senha</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-line bg-paper p-2.5 text-sm text-ink focus:border-ledger focus:outline-none focus:ring-2 focus:ring-ledger/30"
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-ledger py-3 text-sm font-bold text-paper shadow-md transition hover:bg-ledger-strong active:scale-[0.98]"
          >
            <Lock size={16} weight="fill" /> Entrar
          </button>
        </form>

        <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-snug text-ink-soft">
          Login de demonstração — ainda não existe conta na nuvem. Seus dados continuam salvos apenas neste
          aparelho.
        </p>

        <p className="mt-6 text-center text-sm text-ink-soft">
          Ainda não usa o app?{' '}
          <Link to="/onboarding" className="font-semibold text-ledger-strong dark:text-ledger">
            Começar agora
          </Link>
        </p>
      </div>
    </div>
  );
}
