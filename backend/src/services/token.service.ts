import jwt from 'jsonwebtoken';

const configuredJwtSecret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET;
const configuredRefreshSecret = process.env.JWT_REFRESH_SECRET;
const EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';

if (!configuredJwtSecret) {
  throw new Error('JWT_ACCESS_SECRET nao foi definido.');
}
if (!configuredRefreshSecret) {
  throw new Error('JWT_REFRESH_SECRET nao foi definido.');
}
const JWT_SECRET: string = configuredJwtSecret;
const JWT_REFRESH_SECRET: string = configuredRefreshSecret;

export type TokenPayload = {
  sub: string;
  email: string;
};

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
}

export function signRefreshToken(payload: TokenPayload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as unknown as TokenPayload;
}
