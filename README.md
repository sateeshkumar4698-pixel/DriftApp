# 🌊 Drift

> **Don't swipe. Drift.**

Drift is a social connection platform built for people who want **real connections** — not endless swiping. Users discover others through vibe compatibility, send intentional connection notes, chat, and actually meet up in the real world.

Built with React Native + Expo + Firebase. Designed for India's Gen Z social scene.

---

## 📱 What Drift Represents

Most social apps are built around swiping, followers, and vanity metrics. Drift is different:

| Old Way | Drift Way |
|---------|-----------|
| Swipe left / right | Send a personal connection note |
| Match = chat | Connection = intention to meet |
| Follower count | Vibe compatibility score |
| Ghost after match | Meetup proposal built-in |
| Addictive scroll | Purposeful discovery |

**Core belief:** The best connections happen when both people show up with intention.

---

## 🎯 Core Features

### 🔥 Discover
- Browse profiles sorted by vibe compatibility and profile completeness
- See active status stories from connections (like Instagram stories but for real-life vibes)
- Multi-photo profile carousel with up to 6 photos

### 🤝 Connections
- Send a connection note (max 300 chars) — forced intentionality
- Accept / decline incoming requests
- Once connected: chat, propose meetups, play games together

### 💬 Chat
- Real-time messaging with live typing indicators (Firebase RTDB)
- Propose real-world meetup (cafe, event, gaming, walk, etc.) directly from chat

### 📅 Events
- Browse and RSVP to community events
- Host your own events with location, date, and category

### ✨ Feed
- Share posts with your community
- Like posts, view feed from everyone on the platform

### 🎮 Play
- **Ludo** — full 2-player board game (dice, capture, home run, win detection)
- **Truth or Dare** — 120 cards across 3 spice levels (Mild / Spicy / Wild)
- More games coming (Chess, Uno, Trivia, Drift World)

### 👤 Profile
- Vibe Quiz — 7 questions that build your VibeProfile (energy, social, adventure, aesthetic scores)
- Up to 6 profile photos with automatic "Main" photo selection
- Profile completeness bar with actionable tips
- 24-hour status posts (vibe check, location drop, event invite, etc.)
- Memories timeline — auto-generated life moments
- Privacy controls (who sees your status, memories, online presence)

### 💰 Drift Coins
- Virtual currency with no real-money value
- Earn: +10 daily login, +75 at 7-day streak, +300 at 30-day streak, +20 first connection, +50 signup bonus
- Spend: Profile Boost (−50 coins)
- Full transaction history with categorised ledger

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript (strict mode) |
| Navigation | React Navigation v6 (native-stack + bottom-tabs) |
| State | Zustand v5 |
| Database | Firebase Firestore v12 |
| Auth | Firebase Auth (Phone OTP) |
| Real-time | Firebase RTDB (typing indicators) |
| Storage | Firebase Storage (profile photos, post media) |
| Notifications | Expo Notifications |
| Local storage | AsyncStorage (onboarding flag) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (iOS or Android) **OR** an iOS Simulator / Android Emulator

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd DriftApp
npm install
```

### 2. Start the Dev Server

```bash
npm start
# or
npx expo start
```

This opens the Expo Dev Tools in your browser and shows a QR code.

### 3. Run on Device / Simulator

| Platform | Command |
|----------|---------|
| Scan QR with Expo Go (iOS/Android) | `npm start` |
| iOS Simulator | `npm run ios` |
| Android Emulator | `npm run android` |
| Web (limited) | `npm run web` |

> **Note:** The app currently runs in **Mock Auth mode** — it bypasses Firebase phone OTP and injects a test user automatically. You will land directly on the app without needing to log in.

---

## 🔧 Development Modes

### Mock Auth Mode (Default — No Firebase Billing Required)

The app ships with `MOCK_AUTH = true` in `App.tsx`. This injects a fake user and skips Firebase phone authentication entirely.

```ts
// App.tsx line ~18
const MOCK_AUTH = true; // ← currently this
```

**Use this when:** Firebase billing is not enabled or you're building/testing UI.

### Real Auth Mode

```ts
const MOCK_AUTH = false; // ← flip this
```

**Requires:**
1. Firebase billing enabled (Blaze plan — needed for Phone Auth SMS)
2. Firebase Console → Authentication → Sign-in providers → Phone → Enable
3. Real device (phone OTP doesn't work on simulators)

---

## 🔄 How to Reset / Fresh Start

### Reset the mock user state
The mock user is injected fresh on every app launch — no persistent state issues.  
Just **shake your device → Reload** or press `r` in the Expo terminal.

### Reset onboarding (show intro slides again)
```bash
# In Expo Dev Tools: shake device → Open Dev Menu → Clear AsyncStorage
# OR in code, temporarily add:
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.removeItem('drift_onboarding_done');
```

### Reset Firestore data (dev)
Go to [Firebase Console](https://console.firebase.google.com) → your project → Firestore → Delete collections manually.

### Full clean reinstall
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### Clear Expo cache
```bash
npx expo start --clear
```

---

## 🗄 Firebase Setup

The app is already connected to a Firebase project. Config lives in `src/config/firebase.ts`.

**Firebase Project:** `community-app-5a4d1`

| Service | Status |
|---------|--------|
| Firestore | ✅ Active |
| Firebase Auth (Phone OTP) | ⚠️ Needs billing enabled |
| Firebase Storage | ✅ Active |
| Firebase RTDB | ✅ Active |

### Deploy Security Rules

After any changes to `firestore.rules`:

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools

# Login
firebase login

# Deploy rules only
firebase deploy --only firestore:rules
```

---

## 📁 Project Structure

```
DriftApp/
├── App.tsx                        # Root — auth listener, notifications, MOCK_AUTH flag
├── app.json                       # Expo config (bundle IDs, splash, icons)
├── firestore.rules                # Firebase security rules (deploy separately)
├── CODEBASE.md                    # Full code map — read this for fast navigation
│
├── src/
│   ├── config/
│   │   └── firebase.ts            # Firebase init (auth, db, storage, rtdb)
│   │
│   ├── types/
│   │   └── index.ts               # All TypeScript interfaces + navigation param lists
│   │
│   ├── utils/
│   │   ├── theme.ts               # Design tokens (colors, spacing, typography, radius)
│   │   ├── helpers.ts             # Misc utility functions
│   │   └── firestore-helpers.ts   # All Firestore CRUD operations
│   │
│   ├── services/
│   │   ├── coinService.ts         # Coin earning/spending (atomic Firestore transactions)
│   │   └── notificationService.ts # Push token registration, local notifications
│   │
│   ├── store/
│   │   ├── authStore.ts           # Zustand: firebaseUser, userProfile, isLoading
│   │   ├── matchStore.ts          # Zustand: connections, pending requests
│   │   └── eventStore.ts          # Zustand: events list
│   │
│   ├── navigation/
│   │   ├── RootNavigator.tsx      # Root stack (Onboarding → Login → Setup → Main)
│   │   └── MainTabs.tsx           # Bottom tabs + nested stacks for each tab
│   │
│   ├── components/
│   │   ├── Avatar.tsx             # User avatar with initials fallback
│   │   ├── Button.tsx             # Primary / secondary / outline button
│   │   ├── Card.tsx               # Surface card with border
│   │   ├── EmptyState.tsx         # Centered empty state (emoji + text)
│   │   ├── ErrorBoundary.tsx      # React class crash boundary
│   │   └── Input.tsx              # Styled text input
│   │
│   └── screens/
│       ├── Auth/
│       │   ├── OnboardingScreen.tsx     # 3-slide intro (shows once)
│       │   ├── PhoneLoginScreen.tsx     # Phone number + OTP entry
│       │   └── ProfileSetupScreen.tsx  # First-time profile creation
│       │
│       ├── Discover/
│       │   ├── DiscoverScreen.tsx       # Main discover feed + stories
│       │   ├── ProfileDetailScreen.tsx  # Profile view with photo carousel
│       │   ├── ConnectRequestScreen.tsx # Send connection note
│       │   ├── ConnectionsScreen.tsx    # My connections list
│       │   ├── ChatScreen.tsx           # Real-time chat + typing indicator
│       │   └── MeetupSuggestionScreen.tsx # Propose real-world meetup
│       │
│       ├── Events/
│       │   ├── EventsScreen.tsx         # Browse events
│       │   ├── CreateEventScreen.tsx    # Host an event
│       │   └── EventDetailScreen.tsx    # Event + RSVP
│       │
│       ├── Feed/
│       │   ├── FeedScreen.tsx           # Social feed with likes
│       │   └── CreatePostScreen.tsx     # Create post with image
│       │
│       ├── Games/
│       │   ├── GamesScreen.tsx          # Games hub
│       │   ├── LudoGame.tsx             # Full 2-player Ludo
│       │   └── TruthOrDare.tsx          # Truth or Dare card game
│       │
│       └── Profile/
│           ├── ProfileScreen.tsx        # Main profile view
│           ├── EditProfileScreen.tsx    # Edit profile + photos
│           ├── VibeQuizScreen.tsx       # 7-question vibe quiz
│           ├── ViewMemoriesScreen.tsx   # Memories timeline
│           ├── StatusCreateScreen.tsx   # Post a 24h status
│           ├── CoinHistoryScreen.tsx    # Coin transaction history
│           ├── PrivacySettingsScreen.tsx # Privacy toggles
│           └── TermsScreen.tsx          # Terms of Service + Privacy Policy
```

---

## 🗃 Database Schema

```
Firestore:
  users/{uid}
    ├── coinTransactions/{txId}     ← immutable coin ledger
    └── memories/{memoryId}         ← auto-generated life moments

  connectionRequests/{fromUid_toUid}
  connections/{uid1_uid2}           ← sorted uid pair
    └── messages/{messageId}        ← chat messages

  statuses/{uid}                    ← one active status per user (24h)
  events/{eventId}
  posts/{postId}

Firebase RTDB:
  typing/{connectionId}/{uid}       ← live typing indicators

Firebase Storage:
  photos/{uid}/{0..5}.jpg           ← up to 6 profile photos
  posts/{uid}/{postId}              ← post images/videos
```

---

## 🏗 Architecture Decisions

### Why no backend server?
All business logic runs client-side via Firebase SDKs. Firebase handles:
- Auth (OTP via Google's infrastructure)
- Database (Firestore with security rules)
- Real-time (RTDB for sub-100ms typing indicators)
- File storage

This means **zero server costs** to start. If the app scales and needs server-side logic (push to all users, heavy ML matching, payments), Cloud Functions can be added without changing the client architecture.

### Why Zustand over Redux?
Minimal boilerplate, no provider wrapping, TypeScript-first. For an app of this scope it's cleaner and faster to work with.

### Why React Navigation native-stack?
Hardware-accelerated navigation on both iOS and Android. Better performance than JS-based stack for card transitions and swipe-back gestures.

### Coin atomicity
All coin operations use Firestore `runTransaction` with dedup keys (`uid_reason_date`). This prevents double-awarding if the app crashes mid-write or the user opens the app twice in quick succession.

---

## 🔐 Security

- Firestore rules in `firestore.rules` — deploy before going live
- Users can only write their own profile
- Messages only accessible to conversation participants
- Coin transaction ledger is append-only (no update/delete allowed)
- Status audience is enforced server-side (connections vs everyone)
- Phone numbers are never exposed in Firestore (only stored in Firebase Auth)

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~54.0.33 | Managed React Native framework |
| `firebase` | ^12.12.0 | Auth, Firestore, Storage, RTDB |
| `@react-navigation/native` | ^7.2.2 | Navigation container |
| `@react-navigation/native-stack` | ^7.14.11 | Stack navigator |
| `@react-navigation/bottom-tabs` | ^7.15.9 | Tab bar navigator |
| `zustand` | ^5.0.12 | State management |
| `react-native-safe-area-context` | ~5.6.0 | Safe area insets |
| `expo-image-picker` | ~17.0.10 | Camera roll access for photos |
| `expo-image-manipulator` | ~14.0.8 | Resize/compress before upload |
| `expo-notifications` | ~0.32.16 | Push notification handling |
| `expo-device` | ~8.0.10 | Device detection for push tokens |
| `@react-native-async-storage/async-storage` | ^3.0.2 | Persist onboarding flag |

---

## ⚠️ Known Limitations (Current Build)

| Limitation | Status | Fix |
|-----------|--------|-----|
| Phone OTP auth requires Firebase billing | Working in mock mode | Enable Blaze plan → flip `MOCK_AUTH = false` |
| Push notifications delivery (to other users) | Tokens stored, no sender | Add Cloud Functions or backend to send FCM |
| Chat list screen exists but is unreachable | Navigation goes via Connections tab | Wire `ChatListScreen.tsx` into navigation |
| Post comments UI | Data model ready, no UI | Build comments screen |
| Game multiplayer | Local-only | Phase 3 — needs RTDB game rooms |
| Memory auto-generation | Types defined, no triggers | Add calls to `saveMemory()` on key events |

---

## 🗺 Roadmap

### Phase 3 (Next)
- [ ] Chat list screen (all conversations in one view)
- [ ] Post comments
- [ ] Notification badges on tab bar (unread message count, pending requests)
- [ ] Memory auto-generation on key events (first connection, meetup done)
- [ ] Block / report user

### Phase 4
- [x] Game multiplayer infrastructure (GameRoom/GameInvite + RTDB sync) — shipped
- [x] Voice chat via Daily.co (stub in Expo Go; real audio in dev build) — shipped
- [x] Node.js backend (Twilio OTP, FCM push, Daily.co tokens) — shipped
- [ ] Chess, Uno, Trivia games
- [ ] Upgrade LudoGame/TruthOrDare to use ludoRoomService RTDB sync
- [ ] Event attendee list

### Phase 5
- [ ] Drift World (3D virtual social space)
- [ ] Coin purchases (Razorpay / Stripe)
- [ ] Verified profiles
- [ ] City-based discovery filter
- [ ] Admin dashboard + moderation tools
- [ ] App Store + Play Store submission

---

## 🖥️ Backend Server (`/backend`)

Optional Node.js + Express + TypeScript server that provides:
- **Twilio OTP** — custom phone auth (bypasses Firebase reCAPTCHA). Activate in the app by setting `EXPO_PUBLIC_BACKEND_URL`.
- **FCM push** — `POST /notifications/send` using Firebase Admin SDK.
- **Daily.co voice tokens** — `POST /voice/token` for multiplayer voice chat.
- **Game invites** — `POST /games/invite` (writes GameInvite + triggers push).

### Run locally
```bash
cd backend
cp .env.example .env          # fill in Twilio + Daily.co + Firebase creds
# download service-account.json from Firebase Console → Project Settings → Service accounts
npm install
npm run dev                   # http://localhost:4000
```

See `backend/README.md` for full setup.

---

## 👨‍💻 Built By

**Satish** — indie builder, Drift founder  
Contact: sateeshkumar4698@gmail.com  
Firebase Project: `community-app-5a4d1`

---

## 📄 License

Private — all rights reserved. Not open source.
