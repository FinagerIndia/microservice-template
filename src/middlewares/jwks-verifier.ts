import env from '@/configs/env';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { Request, Response, NextFunction } from 'express';

async function validateToken(token: string) {
  try {
    if (!token) return;
    const JWKS = createRemoteJWKSet(new URL(env.BASE_URL + '/api/auth/jwks'));
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: env.BASE_URL, // Should match your JWT issuer, which is the BASE_URL
      audience: env.BASE_URL, // Should match your JWT audience, which is the BASE_URL by default
    });
    return payload;
  } catch (error) {
    console.error('Token validation failed:', error);
    throw error;
  }
}

export default function jwksVerifier() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await validateToken(req.cookies.session);
      req.session = session;
      next();
    } catch (error) {
      next(error);
    }
  };
}
