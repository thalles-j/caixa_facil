import { NavLink } from 'react-router-dom';
import { House, Calculator, Package, CurrencyDollar } from '@phosphor-icons/react';
import { useAppData } from '../context/AppDataContext';

export default function BottomNav() {
  useAppData();

  const items = [
    { to: '/', label: 'Início', Icon: House },
    { to: '/caixa', label: 'Caixa', Icon: Calculator },
    { to: '/catalogo', label: 'Catálogo', Icon: Package },
    { to: '/financas', label: 'Finanças', Icon: CurrencyDollar },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex max-w-md items-center justify-between px-6 py-2">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 p-2 transition ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-blue-600'
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
  );
}
