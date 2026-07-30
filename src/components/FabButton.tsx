import { useNavigate, useLocation } from 'react-router-dom';
import { Plus } from '@phosphor-icons/react';

export default function FabButton() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === '/caixa') return null;

  return (
    <button
      onClick={() => navigate('/caixa')}
      className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:scale-105 hover:bg-blue-700"
      aria-label="Nova venda"
    >
      <Plus size={28} weight="bold" />
    </button>
  );
}
