import { Router, Request, Response } from 'express';
import { z } from 'zod';
import twilio from 'twilio';
import { admin } from '../firebase';

const router = Router();

const sendSchema = z.object({
  phoneNumber: z.string().min(5),
});

const verifySchema = z.object({
  phoneNumber: z.string().min(5),
  code: z.string().min(3),
});

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error('TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured');
  }
  return twilio(sid, token);
}

function getVerifyServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!sid) throw new Error('TWILIO_VERIFY_SERVICE_SID not configured');
  return sid;
}

router.post('/otp/send', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = sendSchema.parse(req.body);

    // Development bypass: allow a test number to skip Twilio
    if (phoneNumber === '+919999999999') {
      res.json({ success: true, mocked: true });
      return;
    }

    const client = getTwilioClient();
    await client.verify.v2
      .services(getVerifyServiceSid())
      .verifications.create({ to: phoneNumber, channel: 'sms' });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send OTP';
    const status = err instanceof z.ZodError ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

router.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = verifySchema.parse(req.body);

    // Development bypass: allow test number to verify with a fixed code
    if (phoneNumber === '+919999999999') {
      if (code !== '123456') {
        res.status(400).json({ error: 'Invalid test OTP' });
        return;
      }
    } else {
      const client = getTwilioClient();
      const check = await client.verify.v2
        .services(getVerifyServiceSid())
        .verificationChecks.create({ to: phoneNumber, code });

      if (check.status !== 'approved') {
        res.status(400).json({ error: `OTP not approved (status=${check.status})` });
        return;
      }
    }

    // Find or create Firebase user by phone.
    let uid: string;
    try {
      const user = await admin.auth().getUserByPhoneNumber(phoneNumber);
      uid = user.uid;
    } catch {
      const created = await admin.auth().createUser({ phoneNumber });
      uid = created.uid;
    }

    const customToken = await admin.auth().createCustomToken(uid);
    res.json({ customToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to verify OTP';
    const status = err instanceof z.ZodError ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
