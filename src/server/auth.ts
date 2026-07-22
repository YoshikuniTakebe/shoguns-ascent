import jwt from 'jsonwebtoken';

const fallbackSecret = 'shoguns-ascent-secret-key-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || fallbackSecret;

if (process.env.NODE_ENV === 'production' && JWT_SECRET === fallbackSecret) {
  throw new Error('JWT_SECRET must be configured in production');
}

export interface TokenPayload {
  userId: string;
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}
