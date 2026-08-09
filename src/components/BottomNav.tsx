import { NavLink } from 'react-router-dom';
import { House, Calculator, Package, CurrencyDollar, List } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';

const items = [
  { to: '/', label: 'Início', Icon: House },
  { to: '/caixa', label: 'Caixa', Icon: Calculator },
  { to: '/catalogo', label: 'Catálogo', Icon: Package },
  { to: '/financas', label: 'Finanças', Icon: CurrencyDollar },
];

export default function BottomNav() {
  useAppData();

  return (
    <>
      {/* Barra inferior — telas estreitas (celular) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-paper-raised shadow-[0_-2px_10px_rgba(36,26,18,0.08)] md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2">
          {items.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 p-2 transition ${
                  isActive ? 'text-ledger' : 'text-ink-soft hover:text-ledger'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Coluna lateral — telas médias e largas (tablet/desktop) */}
      <aside className="sticky top-0 hidden h-screen w-20 shrink-0 flex-col items-center gap-1 border-r border-line bg-paper-raised py-6 md:flex lg:w-56 lg:items-stretch lg:px-4">
        <div className="mb-6 flex items-center gap-2 px-1 lg:px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ledger text-paper">
            <List size={22} weight="bold" aria-label="Menu" />
          </div>
          <span className="hidden font-display text-lg font-semibold lg:inline">Caderneta</span>
        </div>
        <div className="flex w-full flex-col gap-1">
          {items.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition lg:justify-start ${
                  isActive ? 'bg-ledger/10 text-ledger' : 'text-ink-soft hover:bg-line/40 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={22} weight={isActive ? 'fill' : 'regular'} />
                  <span className="hidden lg:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </aside>
    </>
  );
}
