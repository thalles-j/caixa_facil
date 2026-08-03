import { Navigate, Route, Routes } from 'react-router-dom';
import { useAppData } from './context/AppDataContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Caixa from './pages/Caixa';
import Catalogo from './pages/Catalogo';
import Financas from './pages/Financas';
import Configuracoes from './pages/Configuracoes';

export default function App() {
  const { data } = useAppData();
  const onboardingConcluido = data.config?.onboardingConcluido ?? false;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {!onboardingConcluido ? (
        <>
          <Route path="/" element={<Landing />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route path="/onboarding" element={<Navigate to="/" replace />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/caixa" element={<Caixa />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/estoque" element={<Navigate to="/catalogo" replace />} />
            <Route path="/financas" element={<Financas />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </>
      )}
    </Routes>
  );
}
