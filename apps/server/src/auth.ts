import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'snakesss-dev-secret-change-in-prod';
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'admin123';

export interface AdminTokenPayload {
  role: 'admin';
  iat: number;
}

export function generateAdminToken(): string {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const token = auth.slice(7);
  const payload = verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ success: false, error: 'Invalid token' });
    return;
  }

  next();
}

export function handleAdminLogin(req: Request, res: Response): void {
  const { password } = req.body as { password?: string };
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ success: false, error: 'Invalid password' });
    return;
  }
  const token = generateAdminToken();
  res.json({ success: true, data: { token } });
}
