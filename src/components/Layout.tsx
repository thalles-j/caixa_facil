import { Outlet, useNavigate } from 'react-router-dom';
import { Bell, GearSix, Moon, Sun } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { getCategoryTheme } from '../lib/categoryThemes';
import { useDarkMode } from '../lib/theme';
import BottomNav from './BottomNav';
import FabButton from './FabButton';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
});

export default function Layout() {
  const { data, totalNotificacoes } = useAppData();
  const navigate = useNavigate();
  const [dark, setDark] = useDarkMode();
  const hoje = dateFormatter.format(new Date()).replace('-feira', '');
  const theme = getCategoryTheme(data.config?.categoria);
  const Icon = theme.icon;

  return (
    <div className="min-h-screen bg-paper font-body text-ink md:flex">
      <BottomNav />

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-40 border-b border-line bg-paper-raised/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-md items-center justify-between sm:max-w-xl lg:max-w-5xl">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-paper"
                style={{ backgroundColor: theme.accent }}
              >
                <Icon size={18} weight="fill" />
              </div>
              <div className="min-w-0">
                <h1 className="min-w-0 truncate font-display text-lg font-semibold leading-tight text-ink sm:text-xl">
                  {data.config?.nome ?? 'Meu Negócio'}
                </h1>
                <p className="truncate text-xs capitalize text-ink-soft">{hoje}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setDark(!dark)}
                className="rounded-full p-2 text-ink-soft transition hover:bg-line/50 hover:text-ink"
                aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              >
                {dark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => navigate('/configuracoes')}
                className="rounded-full p-2 text-ink-soft transition hover:bg-line/50 hover:text-ink"
                aria-label="Configurações"
              >
                <GearSix size={20} />
              </button>
              <button
                className="rounded-full p-2 text-ink-soft transition hover:bg-line/50 hover:text-ink"
                aria-label="Notificações"
              >
                <span className="relative inline-flex">
                  <Bell size={20} />
                  {totalNotificacoes > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-paper-raised bg-stamp px-1 font-ledger text-[9px] font-bold leading-none text-paper">
                      {totalNotificacoes}
                    </span>
                  )}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="relative mx-auto w-full max-w-md flex-1 p-4 sm:max-w-xl lg:max-w-5xl">
          <Outlet />
        </main>
      </div>

      <FabButton />
    </div>
  );
}
