import jwt from 'jsonwebtoken';
import { validateJwtEnv } from '../env.js';

export type TokenPayload = {
  sub: string;
  email: string;
};

export function signToken(payload: TokenPayload) {
  const env = validateJwtEnv(process.env);
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload {
  const env = validateJwtEnv(process.env);
  return jwt.verify(token, env.jwtAccessSecret) as unknown as TokenPayload;
}

export function signRefreshToken(payload: TokenPayload) {
  const env = validateJwtEnv(process.env);
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): TokenPayload {
  const env = validateJwtEnv(process.env);
  return jwt.verify(token, env.jwtRefreshSecret) as unknown as TokenPayload;
}
