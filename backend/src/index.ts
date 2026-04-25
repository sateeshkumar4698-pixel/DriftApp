import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { initFirebase } from './firebase';
import authRoutes from './routes/auth';
import notificationRoutes from './routes/notifications';
import voiceRoutes from './routes/voice';
import gameRoutes from './routes/games';

initFirebase();

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'drift-backend', time: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/notifications', notificationRoutes);
app.use('/voice', voiceRoutes);
app.use('/games', gameRoutes);

// Fallback error handler.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const message = err instanceof Error ? err.message : 'Internal server error';
    // eslint-disable-next-line no-console
    console.error('[drift-backend] unhandled error:', err);
    res.status(500).json({ error: message });
  }
);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[drift-backend] listening on port ${PORT}`);
});
