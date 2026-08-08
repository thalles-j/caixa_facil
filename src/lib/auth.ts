import type { AppData } from '../types';

export const TOKEN_KEY = 'mnb-auth-token';

export type TokenPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

export function decodeToken(token: string): TokenPayload | null {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function isTokenValid(token: string | null): token is string {
  if (!token) return false;
  const payload = decodeToken(token);
  if (!payload) return false;
  return payload.exp * 1000 > Date.now();
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export type AuthResponse = {
  token: string;
  user: { id: string; email: string };
  data?: AppData | null;
};
export type SessionResponse = Omit<AuthResponse, 'token'>;

async function parseJsonOrThrow(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? 'Não foi possível completar a solicitação.');
  }
  return body;
}

export async function registerRequest(
  email: string,
  password: string,
  confirmPassword: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, confirmPassword }),
  });
  return parseJsonOrThrow(res);
}

export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseJsonOrThrow(res);
}

export async function sessionRequest(token: string): Promise<SessionResponse> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJsonOrThrow(res);
}

export async function resetAccountDataRequest(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/account/data`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? 'Não foi possível zerar os dados da conta.');
  }
}
