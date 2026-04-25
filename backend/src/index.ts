import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { initFirebase } from './firebase';
import authRoutes from './routes/auth';
import notificationRoutes from './routes/notifications';
import voiceRoutes from './routes/voice';
import gameRoutes from './routes/games';

// ── Init Firebase (crash-safe — logs error but lets server start) ─────────────
try {
  initFirebase();
} catch (err) {
  console.error('[drift-backend] Firebase init failed:', err);
  console.error('[drift-backend] Auth routes will not work until FIREBASE_SERVICE_ACCOUNT_JSON is set.');
}

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'drift-backend', time: new Date().toISOString() });
});

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'drift-backend' });
});

app.use('/auth', authRoutes);
app.use('/notifications', notificationRoutes);
app.use('/voice', voiceRoutes);
app.use('/games', gameRoutes);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[drift-backend] unhandled error:', err);
    res.status(500).json({ error: message });
  },
);

// ── Listen on 0.0.0.0 (required for Railway / Docker / cloud) ────────────────
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[drift-backend] listening on 0.0.0.0:${PORT}`);
});
