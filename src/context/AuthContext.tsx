import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  clearStoredToken,
  decodeToken,
  getStoredToken,
  isTokenValid,
  loginRequest,
  registerRequest,
  resetAccountDataRequest,
  sessionRequest,
  setStoredToken,
  TOKEN_KEY,
} from '../lib/auth';
import { APP_DATA_CHANGED_EVENT, loadData, saveData } from '../lib/storage';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string) => Promise<void>;
  resetAccountData: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromToken(token: string | null): AuthUser | null {
  if (!isTokenValid(token)) return null;
  const payload = decodeToken(token);
  return payload ? { id: payload.sub, email: payload.email } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => userFromToken(getStoredToken()));

  useEffect(() => {
    const token = getStoredToken();
    if (!isTokenValid(token)) return;

    void sessionRequest(token)
      .then(({ user: sessionUser, data }) => {
        if (data && !loadData(sessionUser.id).config) saveData(data, sessionUser.id);
        window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
        setUser(sessionUser);
      })
      .catch(() => {
        clearStoredToken();
        window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
        setUser(null);
      });
  }, []);

  useEffect(() => {
    // reavalia periodicamente para deslogar automaticamente quando o token de 2h expira
    // enquanto o app está aberto, sem esperar uma ação do usuário para notar
    const interval = setInterval(() => {
      const token = getStoredToken();
      if (token && !isTokenValid(token)) {
        clearStoredToken();
        setUser(null);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key !== null && event.key !== TOKEN_KEY) return;
      setUser(userFromToken(getStoredToken()));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: loggedUser, data } = await loginRequest(email, password);
    setStoredToken(token);
    if (data && !loadData(loggedUser.id).config) saveData(data, loggedUser.id);
    window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    setUser(loggedUser);
  };

  const register = async (email: string, password: string, confirmPassword: string) => {
    const { token, user: registeredUser } = await registerRequest(email, password, confirmPassword);
    setStoredToken(token);
    window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    setUser(registeredUser);
  };

  const logout = () => {
    clearStoredToken();
    window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    setUser(null);
  };

  const resetAccountData = async () => {
    const token = getStoredToken();
    if (!isTokenValid(token)) throw new Error('Sua sessão expirou. Entre novamente.');
    await resetAccountDataRequest(token);
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    login,
    register,
    resetAccountData,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- mesmo padrão já usado em AppDataContext
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
