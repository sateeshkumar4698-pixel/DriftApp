import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const spec = {
  openapi: '3.0.0',
  info: {
    title: 'Drift Backend API',
    version: '1.0.0',
    description: 'REST API for the Drift social connection app — OTP auth, push notifications, voice rooms, and games.',
    contact: { email: 'sateeshkumar4698@gmail.com' },
  },
  servers: [
    { url: 'https://driftapp-production.up.railway.app', description: 'Production (Railway)' },
    { url: 'http://localhost:4000', description: 'Local development' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Firebase ID Token',
        description: 'Pass a Firebase ID Token obtained after authentication.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Something went wrong' },
        },
      },
    },
  },
  paths: {
    // ── Health ──────────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Returns server status and timestamp. Use this to verify the backend is reachable.',
        responses: {
          200: {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok:      { type: 'boolean', example: true },
                    service: { type: 'string',  example: 'drift-backend' },
                    time:    { type: 'string',  format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Auth — OTP Send ─────────────────────────────────────────────────────────
    '/auth/otp/send': {
      post: {
        tags: ['Auth — Phone OTP'],
        summary: 'Send OTP via SMS',
        description: 'Triggers a Twilio Verify SMS to the provided phone number. Use `+919999999999` as test number (always succeeds, no SMS sent).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phoneNumber'],
                properties: {
                  phoneNumber: { type: 'string', example: '+919876543210', description: 'E.164 format' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OTP sent',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    mocked:  { type: 'boolean', example: false, description: 'true for test number bypass' },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: { description: 'Twilio error',     content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── Auth — OTP Verify ───────────────────────────────────────────────────────
    '/auth/otp/verify': {
      post: {
        tags: ['Auth — Phone OTP'],
        summary: 'Verify OTP and get Firebase custom token',
        description: 'Checks OTP with Twilio, then creates/finds the Firebase user and returns a custom token. Exchange the custom token in your app with `signInWithCustomToken(auth, token)`. Test bypass: number `+919999999999` + code `123456`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phoneNumber', 'code'],
                properties: {
                  phoneNumber: { type: 'string', example: '+919876543210' },
                  code:        { type: 'string', example: '123456', description: '6-digit OTP' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'OTP approved — custom token returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customToken: { type: 'string', example: 'eyJhbGciOi...', description: 'Pass to signInWithCustomToken()' },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid OTP',   content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: { description: 'Server error',  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── Notifications — Send ────────────────────────────────────────────────────
    '/notifications/send': {
      post: {
        tags: ['Notifications'],
        summary: 'Send push notification to a user',
        description: 'Sends an FCM push notification to a specific user by UID. Requires a valid Firebase ID Token (authenticated user).',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['toUid', 'title', 'body'],
                properties: {
                  toUid:  { type: 'string', example: 'abc123uid', description: 'Firebase UID of recipient' },
                  title:  { type: 'string', example: 'New connection request! 🤝' },
                  body:   { type: 'string', example: 'Priya wants to connect with you.' },
                  data:   { type: 'object', additionalProperties: { type: 'string' }, example: { screen: 'Connections' } },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Notification sent',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success:   { type: 'boolean', example: true },
                    messageId: { type: 'string',  example: 'projects/drift/messages/12345' },
                  },
                },
              },
            },
          },
          401: { description: 'Missing or invalid auth token' },
          404: { description: 'User or FCM token not found' },
          500: { description: 'FCM error' },
        },
      },
    },

    // ── Voice — Create Room Token ───────────────────────────────────────────────
    '/voice/token': {
      post: {
        tags: ['Voice Rooms'],
        summary: 'Get Daily.co room token',
        description: 'Creates a Daily.co room if it does not exist, then returns a short-lived meeting token scoped to the caller. Requires Firebase ID Token.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['roomName'],
                properties: {
                  roomName: { type: 'string', example: 'drift-room-abc123', description: 'Unique room identifier' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Token created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token:   { type: 'string',  example: 'eyJhbGciOi...', description: 'Daily meeting token' },
                    roomUrl: { type: 'string',  example: 'https://drift.daily.co/drift-room-abc123' },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          500: { description: 'Daily.co API error' },
        },
      },
    },

    // ── Games — Invite ──────────────────────────────────────────────────────────
    '/games/invite': {
      post: {
        tags: ['Games'],
        summary: 'Send game invite notification',
        description: 'Sends a push notification to invite another user to a game room. Requires Firebase ID Token.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['toUid', 'gameType', 'roomId'],
                properties: {
                  toUid:    { type: 'string', example: 'xyz789uid' },
                  gameType: { type: 'string', example: 'ludo', enum: ['ludo', 'uno', 'chess', 'truth_dare', 'bet'] },
                  roomId:   { type: 'string', example: 'room_abc123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Invite sent',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                  },
                },
              },
            },
          },
          401: { description: 'Unauthorized' },
          500: { description: 'Server error' },
        },
      },
    },
  },
};

export function setupSwagger(app: Express) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Drift API Docs',
      customCss: `
        .swagger-ui .topbar { background-color: #FF4B6E; }
        .swagger-ui .topbar .download-url-wrapper { display: none; }
      `,
    }),
  );
  // Also expose raw JSON spec
  app.get('/api-docs.json', (_req, res) => res.json(spec));
}
