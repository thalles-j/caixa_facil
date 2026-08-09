import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  clearStoredToken,
  decodeToken,
  ensureStoredAccessToken,
  getStoredToken,
  isTokenValid,
  loginRequest,
  logoutRequest,
  refreshSessionRequest,
  registerRequest,
  resetAccountDataRequest,
  sessionRequest,
  setStoredToken,
  TOKEN_KEY,
} from '../lib/auth';
import { APP_DATA_CHANGED_EVENT } from '../lib/storage';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string) => Promise<void>;
  resetAccountData: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromToken(token: string | null): AuthUser | null {
  if (!isTokenValid(token)) return null;
  const payload = decodeToken(token);
  return payload ? { id: payload.sub, email: payload.email } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const token = getStoredToken();
      try {
        let session;
        if (isTokenValid(token)) {
          try {
            session = await sessionRequest(token);
          } catch {
            session = await refreshSessionRequest();
          }
        } else {
          session = await refreshSessionRequest();
        }
        if (cancelled) return;
        if ('token' in session && typeof session.token === 'string') setStoredToken(session.token);
        window.dispatchEvent(new CustomEvent(APP_DATA_CHANGED_EVENT, { detail: session.data }));
        setUser(session.user);
      } catch {
        if (cancelled) return;
        clearStoredToken();
        window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
        setUser(null);
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    // O refresh token HTTP-only mantém a sessão. Este intervalo apenas renova o
    // access token quando necessário enquanto a aplicação permanece aberta.
    const interval = setInterval(() => {
      const token = getStoredToken();
      if (!isTokenValid(token)) {
        void refreshSessionRequest()
          .then((session) => {
            setStoredToken(session.token);
            window.dispatchEvent(new CustomEvent(APP_DATA_CHANGED_EVENT, { detail: session.data }));
            setUser(session.user);
          })
          .catch(() => {
            clearStoredToken();
            window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
            setUser(null);
          });
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [user]);

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
    window.dispatchEvent(new CustomEvent(APP_DATA_CHANGED_EVENT, { detail: data }));
    setUser(loggedUser);
  };

  const register = async (email: string, password: string, confirmPassword: string) => {
    const { token, user: registeredUser } = await registerRequest(email, password, confirmPassword);
    setStoredToken(token);
    window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
    setUser(registeredUser);
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      clearStoredToken();
      window.dispatchEvent(new Event(APP_DATA_CHANGED_EVENT));
      setUser(null);
    }
  };

  const resetAccountData = async () => {
    const token = await ensureStoredAccessToken();
    await resetAccountDataRequest(token);
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isInitializing,
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
