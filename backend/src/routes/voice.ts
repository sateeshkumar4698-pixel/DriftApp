import { Router, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { z } from 'zod';
import { verifyFirebaseIdToken, AuthedRequest } from '../middleware/auth';

const router = Router();

const tokenSchema = z.object({
  roomName: z.string().min(1),
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

async function ensureRoomExists(roomName: string, apiKey: string): Promise<void> {
  try {
    await axios.get(`${DAILY_API}/rooms/${encodeURIComponent(roomName)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    // Room exists.
  } catch (err) {
    const axErr = err as AxiosError;
    if (axErr.response?.status === 404) {
      await axios.post(
        `${DAILY_API}/rooms`,
        {
          name: roomName,
          properties: {
            enable_chat: false,
            enable_screenshare: false,
            start_audio_off: false,
            start_video_off: true,
            exp: Math.floor(Date.now() / 1000) + TWO_HOURS_SECONDS,
          },
        },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      return;
    }
    throw err;
  }
}

router.post(
  '/token',
  verifyFirebaseIdToken,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { roomName } = tokenSchema.parse(req.body);
      const { apiKey, domain } = getDailyConfig();

      await ensureRoomExists(roomName, apiKey);

      const expSeconds = Math.floor(Date.now() / 1000) + TWO_HOURS_SECONDS;

      const tokenResp = await axios.post<{ token: string }>(
        `${DAILY_API}/meeting-tokens`,
        {
          properties: {
            room_name: roomName,
            user_id: req.uid,
            exp: expSeconds,
          },
        },
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );

      res.json({
        token: tokenResp.data.token,
        roomUrl: `https://${domain}/${roomName}`,
        roomName,
        expiresAt: expSeconds * 1000,
      });
    } catch (err) {
      const axErr = err as AxiosError<{ error?: string; info?: string }>;
      const message =
        axErr.response?.data?.info ||
        axErr.response?.data?.error ||
        (err instanceof Error ? err.message : 'Failed to create voice token');
      const status =
        err instanceof z.ZodError ? 400 : axErr.response?.status ?? 500;
      res.status(status).json({ error: message });
    }
  }
);

export default router;
