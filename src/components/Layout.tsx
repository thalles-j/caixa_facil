import { Outlet, useNavigate } from 'react-router-dom';
import { Bell, GearSix } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';
import { getCategoryTheme } from '../lib/categoryThemes';
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
  const hoje = dateFormatter.format(new Date()).replace('-feira', '');
  const theme = getCategoryTheme(data.config?.categoria);
  const Icon = theme.icon;

  return (
    <div className="min-h-screen bg-gray-100 pb-20 text-gray-800 dark:bg-gray-900 dark:text-gray-100">
      <header
        className={`sticky top-0 z-40 bg-gradient-to-br p-4 text-white shadow-md ${theme.gradient}`}
      >
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Icon size={18} weight="fill" />
            </div>
            <div className="min-w-0">
              <h1 className="max-w-[180px] truncate text-xl font-bold leading-tight">
                {data.config?.nome ?? 'Meu Negócio'}
              </h1>
              <p className="text-xs capitalize text-white/80">{hoje}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/configuracoes')}
              className="rounded-full p-2 transition hover:bg-white/20"
              aria-label="Configurações"
            >
              <GearSix size={22} />
            </button>
            <button className="rounded-full p-2 transition hover:bg-white/20" aria-label="Notificações">
              <span className="relative inline-flex">
                <Bell size={22} />
                {totalNotificacoes > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white/40 bg-red-500 px-1 text-[9px] font-bold leading-none">
                    {totalNotificacoes}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-md p-4">
        <Outlet />
      </main>

      <FabButton />
      <BottomNav />
    </div>
  );
}
