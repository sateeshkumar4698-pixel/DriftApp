import { Request, Response, NextFunction } from 'express';
import { admin } from '../firebase';

export interface AuthedRequest extends Request {
  uid?: string;
}

export async function verifyFirebaseIdToken(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' });
      return;
    }

    const idToken = match[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    res.status(401).json({ error: `Unauthorized: ${message}` });
  }
}
