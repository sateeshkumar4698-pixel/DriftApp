import { Router, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { z } from 'zod';
import { verifyFirebaseIdToken, AuthedRequest } from '../middleware/auth';
import { getFirebaseAdmin } from '../firebase';

const router = Router();

const tokenSchema = z.object({
  roomName: z.string().min(1),
  callType: z.enum(['audio', 'video']).default('audio'),
});

const initiateSchema = z.object({
  roomName:       z.string().min(1),
  callType:       z.enum(['audio', 'video']).default('audio'),
  toUid:          z.string().min(1),
  callerName:     z.string().min(1),
  callerPhotoURL: z.string().optional(),
});

const DAILY_API = 'https://api.daily.co/v1';
const TWO_HOURS_SECONDS = 60 * 60 * 2;

function getDailyConfig() {
  const apiKey = process.env.DAILY_API_KEY;
  const domain = process.env.DAILY_DOMAIN;
  if (!apiKey) throw new Error('DAILY_API_KEY not configured');
  if (!domain) throw new Error('DAILY_DOMAIN not configured');
  return { apiKey, domain };
}

async function ensureRoomExists(
  roomName: string,
  apiKey: string,
  callType: 'audio' | 'video' = 'audio',
): Promise<void> {
  try {
    await axios.get(`${DAILY_API}/rooms/${encodeURIComponent(roomName)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    const axErr = err as AxiosError;
    if (axErr.response?.status === 404) {
      await axios.post(
        `${DAILY_API}/rooms`,
        {
          name: roomName,
          properties: {
            enable_chat:        false,
            enable_screenshare: false,
            start_audio_off:    false,
            start_video_off:    callType === 'audio',
            exp: Math.floor(Date.now() / 1000) + TWO_HOURS_SECONDS,
          },
        },
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      return;
    }
    throw err;
  }
}

async function createMeetingToken(
  roomName: string,
  uid: string,
  apiKey: string,
): Promise<{ token: string; expiresAt: number }> {
  const expSeconds = Math.floor(Date.now() / 1000) + TWO_HOURS_SECONDS;
  const resp = await axios.post<{ token: string }>(
    `${DAILY_API}/meeting-tokens`,
    { properties: { room_name: roomName, user_id: uid, exp: expSeconds } },
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  return { token: resp.data.token, expiresAt: expSeconds * 1000 };
}

// POST /voice/token — get a Daily.co token (caller already has the room name)
router.post(
  '/token',
  verifyFirebaseIdToken,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { roomName, callType } = tokenSchema.parse(req.body);
      const { apiKey, domain }     = getDailyConfig();

      await ensureRoomExists(roomName, apiKey, callType);
      const { token, expiresAt } = await createMeetingToken(roomName, req.uid!, apiKey);

      res.json({
        token,
        roomUrl: `https://${domain}/${roomName}`,
        roomName,
        callType,
        expiresAt,
      });
    } catch (err) {
      const axErr = err as AxiosError<{ error?: string; info?: string }>;
      const message =
        axErr.response?.data?.info ||
        axErr.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to create voice token');
      const status = err instanceof z.ZodError ? 400 : (axErr.response?.status ?? 500);
      res.status(status).json({ error: message });
    }
  },
);

// POST /voice/initiate — caller creates room + sends FCM push to callee
router.post(
  '/initiate',
  verifyFirebaseIdToken,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { roomName, callType, toUid, callerName, callerPhotoURL } =
        initiateSchema.parse(req.body);
      const { apiKey, domain } = getDailyConfig();

      await ensureRoomExists(roomName, apiKey, callType);
      const { token, expiresAt } = await createMeetingToken(roomName, req.uid!, apiKey);
      const roomUrl = `https://${domain}/${roomName}`;

      // Notify callee via FCM (non-fatal on failure)
      try {
        const admin = getFirebaseAdmin();
        const snap  = await admin.firestore().collection('users').doc(toUid).get();
        const fcmToken: string | undefined = snap.data()?.fcmToken;

        if (fcmToken) {
          await admin.messaging().send({
            token: fcmToken,
            data: {
              type:           'incoming_call',
              callType,
              roomName,
              roomUrl,
              callerUid:      req.uid!,
              callerName,
              callerPhotoURL: callerPhotoURL ?? '',
            },
            android: {
              priority: 'high',
              notification: {
                title: `${callerName} is calling…`,
                body:  callType === 'video' ? '📹 Incoming video call' : '📞 Incoming audio call',
                sound: 'default',
              },
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: `${callerName} is calling…`,
                    body:  callType === 'video' ? '📹 Incoming video call' : '📞 Incoming audio call',
                  },
                  sound:            'default',
                  contentAvailable: true,
                },
              },
            },
          });
        }
      } catch (notifErr) {
        console.warn('[voice/initiate] FCM notification failed:', notifErr);
      }

      res.json({ token, roomUrl, roomName, callType, expiresAt });
    } catch (err) {
      const axErr = err as AxiosError<{ error?: string; info?: string }>;
      const message =
        axErr.response?.data?.info ||
        axErr.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to initiate call');
      const status = err instanceof z.ZodError ? 400 : (axErr.response?.status ?? 500);
      res.status(status).json({ error: message });
    }
  },
);

export default router;
