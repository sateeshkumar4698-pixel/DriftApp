import { Router, Response } from 'express';
import { z } from 'zod';
import { admin } from '../firebase';
import { verifyFirebaseIdToken, AuthedRequest } from '../middleware/auth';

const router = Router();

const sendSchema = z.object({
  toUid: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string(), z.string()).optional(),
});

router.post(
  '/send',
  verifyFirebaseIdToken,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { toUid, title, body, data } = sendSchema.parse(req.body);

      const userSnap = await admin.firestore().collection('users').doc(toUid).get();
      if (!userSnap.exists) {
        res.status(404).json({ error: `User ${toUid} not found` });
        return;
      }

      const fcmToken = userSnap.get('fcmToken') as string | undefined;
      if (!fcmToken) {
        res.status(404).json({ error: `User ${toUid} has no fcmToken registered` });
        return;
      }

      const messageId = await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        data: data ?? {},
      });

      res.json({ success: true, messageId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send push';
      const status = err instanceof z.ZodError ? 400 : 500;
      res.status(status).json({ error: message });
    }
  }
);

export default router;
