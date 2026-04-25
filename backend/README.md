# Drift Backend

Node.js + TypeScript + Express backend for the Drift React Native app. Provides
three server-only capabilities the mobile client cannot do safely on its own:

1. **Twilio OTP auth** — SMS OTP via Twilio Verify that mints a Firebase custom
   token (bypasses flaky Firebase reCAPTCHA in React Native).
2. **Push notifications** — authenticated FCM sender using Firebase Admin SDK.
3. **Daily.co voice tokens** — short-lived meeting tokens for in-game voice chat.

Most Firestore / RTDB traffic still goes directly from the app via security
rules — this server intentionally stays small.

---

## Endpoints

| Method | Path                  | Auth | Purpose |
|--------|-----------------------|------|---------|
| GET    | `/health`             | —    | Liveness check |
| POST   | `/auth/otp/send`      | —    | `{ phoneNumber }` → Twilio sends SMS OTP |
| POST   | `/auth/otp/verify`    | —    | `{ phoneNumber, code }` → `{ customToken }` |
| POST   | `/notifications/send` | Bearer ID token | `{ toUid, title, body, data? }` → FCM push |
| POST   | `/voice/token`        | Bearer ID token | `{ roomName }` → `{ token, roomUrl, roomName, expiresAt }` |
| POST   | `/games/invite`       | Bearer ID token | `{ toUid, gameId, roomId }` → creates GameInvite + push |

`Bearer ID token` = a Firebase ID token from the client
(`await auth.currentUser.getIdToken()`), passed as `Authorization: Bearer <token>`.

---

## Prerequisites — credentials to collect

You must gather the following before `npm run dev` will actually work. Drop each
where indicated.

### 1. Firebase service account JSON
- Firebase console → your project → Project Settings → **Service accounts**
  → "Generate new private key".
- Save the downloaded JSON as `backend/service-account.json`
  (or anywhere, then point `FIREBASE_SERVICE_ACCOUNT_PATH` at it).
- `.gitignore` already excludes `service-account.json`.

### 2. Twilio Verify credentials
- Twilio console → Account Info: copy **Account SID** and **Auth Token**.
- Twilio console → Verify → Services → create a service (or use an existing
  one) → copy its **Service SID** (starts with `VA...`).
- Put these into `.env` as `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_VERIFY_SERVICE_SID`.

### 3. Daily.co API key and domain
- Daily dashboard → **Developers** → copy your **API key**.
- Your Daily subdomain is shown on the dashboard (e.g. `drift.daily.co`).
- Put these in `.env` as `DAILY_API_KEY` and `DAILY_DOMAIN`
  (domain without the `https://`, e.g. `drift.daily.co`).

### 4. Create your `.env`
```bash
cp .env.example .env
# then fill in real values
```

---

## Run it

```bash
cd backend
npm install
npm run dev         # tsx watch, reloads on save
# or
npm run build && npm start
```

Health check:
```bash
curl http://localhost:4000/health
```

---

## Client integration notes

- OTP login: call `/auth/otp/send`, then `/auth/otp/verify`, then on the client
  `signInWithCustomToken(auth, customToken)`.
- Push: after the app registers for FCM, write the token to
  `users/{uid}.fcmToken` in Firestore. This backend reads it from there.
- Voice: `POST /voice/token` returns the same `VoiceRoomToken` shape the app's
  voice service expects (`{ token, roomUrl, roomName, expiresAt }`).

---

## Deploy

This is a standard Node service — works on Render, Railway, Fly.io, Cloud Run,
etc. Minimum config:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Env vars: everything in `.env.example`
- For the Firebase service account in production, either:
  - Mount the JSON file as a secret and point `FIREBASE_SERVICE_ACCOUNT_PATH`
    at it, or
  - Set `GOOGLE_APPLICATION_CREDENTIALS` (e.g. on Cloud Run with a bound
    service account), or
  - Inline the JSON into a secret env var and adapt `src/firebase.ts` to parse
    it from the env string.

A Dockerfile is optional but straightforward (node:20-alpine, copy, install,
build, `CMD ["node", "dist/index.js"]`).
