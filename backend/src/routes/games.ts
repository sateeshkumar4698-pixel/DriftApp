import { Router, Response } from 'express';
import { z } from 'zod';
import { admin } from '../firebase';
import { verifyFirebaseIdToken, AuthedRequest } from '../middleware/auth';

const router = Router();

const inviteSchema = z.object({
  toUid: z.string().min(1),
  gameId: z.enum(['ludo', 'truth-dare']),
  roomId: z.string().min(1),
});

const INVITE_TTL_MS = 5 * 60 * 1000; // 5 minutes

router.post(
  '/invite',
  verifyFirebaseIdToken,
  async (req: AuthedRequest, res: Response) => {
    try {
      const fromUid = req.uid!;
      const { toUid, gameId, roomId } = inviteSchema.parse(req.body);

      const db = admin.firestore();

      // Fetch sender profile for fromName/fromPhoto.
      const fromSnap = await db.collection('users').doc(fromUid).get();
      if (!fromSnap.exists) {
        res.status(404).json({ error: `Sender ${fromUid} not found` });
        return;
      }
      const fromName =
        (fromSnap.get('name') as string | undefined) ||
        (fromSnap.get('displayName') as string | undefined) ||
        'Someone';
      const fromPhoto = fromSnap.get('photo') as string | undefined;

      const createdAt = Date.now();
      const expiresAt = createdAt + INVITE_TTL_MS;
      const id = `${fromUid}_${toUid}_${gameId}_${createdAt}`;

      const invite = {
        id,
        fromUid,
        fromName,
        ...(fromPhoto ? { fromPhoto } : {}),
        toUid,
        gameId,
        roomId,
        status: 'pending' as const,
        createdAt,
        expiresAt,
      };

      await db.collection('gameInvites').doc(id).set(invite);

      // Best-effort push notification. Don't fail the request if push fails.
      let pushSent = false;
      let pushError: string | undefined;
      try {
        const toSnap = await db.collection('users').doc(toUid).get();
        const fcmToken = toSnap.get('fcmToken') as string | undefined;
        if (fcmToken) {
          const gameLabel = gameId === 'ludo' ? 'Ludo' : 'Truth or Dare';
          await admin.messaging().send({
            token: fcmToken,
            notification: {
              title: `${fromName} invited you to play ${gameLabel}`,
              body: 'Tap to join the room.',
            },
            data: {
              type: 'game-invite',
              inviteId: id,
              gameId,
              roomId,
              fromUid,
            },
          });
          pushSent = true;
        } else {
          pushError = 'recipient has no fcmToken';
        }
      } catch (err) {
        pushError = err instanceof Error ? err.message : 'push failed';
      }

      res.json({ success: true, invite, pushSent, pushError });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invite';
      const status = err instanceof z.ZodError ? 400 : 500;
      res.status(status).json({ error: message });
    }
  }
);

export default router;
