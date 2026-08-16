import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

export function jwtIssuer() {
  return 'car-service-ai';
}

export function jwtAudience() {
  return String(getEnv().APP_PUBLIC_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
}

export function signAppJwt(payload, options: any = {}) {
  const env = getEnv();
  return jwt.sign(
    { ...payload, iss: jwtIssuer(), aud: jwtAudience() },
    env.JWT_SECRET,
    { expiresIn: options.expiresIn || env.JWT_EXPIRES_IN, notBefore: '0s', ...stripExpires(options) },
  );
}

function stripExpires(options: any = {}) {
  return Object.fromEntries(Object.entries(options).filter(([key]) => key !== 'expiresIn'));
}

export function verifyAppJwt(token, extra: any = {}) {
  const env = getEnv();
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: jwtIssuer(),
    audience: jwtAudience(),
    clockTolerance: 5,
    ...extra,
  }) as any;
}
