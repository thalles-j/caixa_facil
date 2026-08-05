import { describe, expect, it } from 'vitest';
import { decodeToken, isTokenValid } from './auth';

function fakeToken(payload: Record<string, unknown>): string {
  const base64url = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.assinatura-fake`;
}

describe('decodeToken', () => {
  it('decodifica o payload de um token válido', () => {
    const token = fakeToken({ sub: 'user-1', email: 'a@b.com', iat: 1000, exp: 2000 });
    expect(decodeToken(token)).toEqual({ sub: 'user-1', email: 'a@b.com', iat: 1000, exp: 2000 });
  });

  it('retorna null para um token malformado', () => {
    expect(decodeToken('nao-e-um-jwt')).toBeNull();
  });
});

describe('isTokenValid', () => {
  it('retorna false para token nulo', () => {
    expect(isTokenValid(null)).toBe(false);
  });

  it('retorna false para token malformado', () => {
    expect(isTokenValid('lixo')).toBe(false);
  });

  it('retorna true para um token cujo exp ainda não passou', () => {
    const futuro = Math.floor(Date.now() / 1000) + 3600;
    const token = fakeToken({ sub: 'user-1', email: 'a@b.com', iat: 0, exp: futuro });
    expect(isTokenValid(token)).toBe(true);
  });

  it('retorna false para um token expirado', () => {
    const passado = Math.floor(Date.now() / 1000) - 3600;
    const token = fakeToken({ sub: 'user-1', email: 'a@b.com', iat: 0, exp: passado });
    expect(isTokenValid(token)).toBe(false);
  });
});
