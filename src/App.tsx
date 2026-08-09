import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppData } from './context/AppDataContext';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Cadastro from './pages/Cadastro';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Caixa from './pages/Caixa';
import FecharCaixa from './pages/FecharCaixa';
import Catalogo from './pages/Catalogo';
import Financas from './pages/Financas';
import Configuracoes from './pages/Configuracoes';
import Movimentacoes from './pages/Movimentacoes';
import RecuperarConta from './pages/RecuperarConta';
import RelatoriosCaixa from './pages/RelatoriosCaixa';
import Fechamentos from './pages/Fechamentos';

export default function App() {
  const { pathname } = useLocation();
  const { isAuthenticated, isInitializing, user } = useAuth();
  const { data, loadedUserId } = useAppData();
  const onboardingConcluido = data.config?.onboardingConcluido ?? false;

  if (isInitializing || (user && loadedUserId !== user.id)) {
    if (pathname !== '/') return null;
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-center text-ink">
        <div>
          <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-line border-t-ledger" />
          <p className="font-display text-lg font-bold text-ink">Preparando seu painel</p>
          <p className="mt-1 text-sm font-medium text-ink-soft">Verificando sua sessão e atualizando os dados…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/recuperar-conta" element={<RecuperarConta />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (!onboardingConcluido) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/cadastro" element={<Navigate to="/" replace />} />
      <Route path="/onboarding" element={<Navigate to="/" replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/caixa" element={<Caixa />} />
        <Route path="/caixa/fechamento" element={<FecharCaixa />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/estoque" element={<Navigate to="/catalogo" replace />} />
        <Route path="/financas" element={<Financas />} />
        <Route path="/movimentacoes" element={<Movimentacoes modo="todas" />} />
        <Route path="/entradas" element={<Movimentacoes modo="vendas" />} />
        <Route path="/vendas" element={<Navigate to="/entradas" replace />} />
        <Route path="/despesas" element={<Movimentacoes modo="saidas" />} />
        <Route path="/fechamentos" element={<Fechamentos />} />
        <Route path="/fechamentos/:dataRelatorio" element={<RelatoriosCaixa />} />
        <Route path="/relatorios" element={<Navigate to="/fechamentos" replace />} />
        <Route path="/configuracoes" element={<Configuracoes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
