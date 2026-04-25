# Drift App — Codebase Index
> **Purpose:** Read THIS file first every session. It maps every file, key exports, and patterns so you don't need to read the full codebase.  
> **Update this file whenever you add/rename files or change key exports.**

---

## Project Root

| File | Purpose |
|------|---------|
| `App.tsx` | Root component. Auth listener (MOCK_AUTH flag), daily login, push registration, deep-link handler |
| `app.json` | Expo config — name: Drift, slug: drift-app, bundle: com.drift.app |
| `firestore.rules` | Firestore security rules (deploy with `firebase deploy --only firestore:rules`). Covers users, connections, messages, statuses, events, posts, gameRooms, gameInvites |
| `firestore.indexes.json` | Composite indexes (users feed, connectionRequests in/out, connections by-user) |
| `firebase.json` | Points CLI at rules + indexes files |
| `eas.json` | EAS Build profiles: development (dev-client APK), preview, production (AAB) |
| `tsconfig.json` | TypeScript strict mode |
| `package.json` | Expo SDK 54, React Native 0.81, Firebase v12, Zustand v5, React Navigation v7 |
| `backend/` | Node.js + TypeScript + Express server. See `backend/README.md`. Provides Twilio OTP, FCM push, Daily.co voice tokens |

---

## `src/config/`

| File | Exports | Notes |
|------|---------|-------|
| `firebase.ts` | `auth`, `db`, `storage`, `rtdb`, `default app` | Uses `require('firebase/auth')` for `getReactNativePersistence` — TS workaround for Firebase v12 export map |

---

## `src/types/index.ts`

All shared TypeScript interfaces and navigation param lists.

**Key interfaces:**
- `UserProfile` — uid, name, age, bio, interests, photoURL, photos[], coins, streak, profileCompleteness, vibeProfile?, privacyPrefs?
- `VibeProfile` — energy/social/adventure/aesthetic (0-1 floats), primaryVibes[], musicTaste[], nightlifeStyle
- `Connection` — id (sorted uid1_uid2), users[2], connectedAt, meetupProposal?
- `ConnectionRequest` — fromUid, toUid, note, status (pending/accepted/declined/withdrawn)
- `Message` — senderId, text, createdAt, readBy[]
- `Memory` — type (MemoryType), date, isPrivate, isPinned, isFavorite
- `DriftStatus` — type (StatusType), audience, expiresAt (24h), reactions
- `Event` — hostId, attendees[], category (EventCategory), date timestamp
- `Post` — userId, caption, mediaURL?, likes[], comments count
- `CoinTransaction` — amount (+earn/-spend), reason (CoinTxReason), createdAt
- `MeetupProposal` — proposedBy, meetupType, suggestedPlace?, status

**Navigation param lists:**
- `RootStackParamList` → Onboarding | PhoneLogin | ProfileSetup | Main
- `MainTabParamList` → Discover | Events | Feed | Play | Profile
- `DiscoverStackParamList` → DiscoverFeed | ProfileDetail | ConnectRequest | Connections | Chat | MeetupSuggest
- `EventsStackParamList` → EventsMain | CreateEvent | EventDetail
- `FeedStackParamList` → FeedMain | CreatePost
- `GamesStackParamList` → GamesList | LudoGame | TruthOrDare
- `ProfileStackParamList` → ProfileMain | EditProfile | ViewMemories | VibeQuiz | StatusCreate | CoinHistory | PrivacySettings | Terms

---

## `src/utils/`

| File | Key Exports | Notes |
|------|------------|-------|
| `theme.ts` | `colors`, `spacing`, `typography`, `radius`, `shadows` | All UI constants. Import from here — never hardcode values |
| `helpers.ts` | Misc utility functions | Check before writing new helpers |
| `firestore-helpers.ts` | Firestore CRUD functions | See full list below |

**`firestore-helpers.ts` exports:**
- `getUserProfile(uid)` → `UserProfile | null`
- `setUserProfile(uid, partial)` → void
- `checkDailyLoginAndUpdateStreak(uid, current)` → `{coins, streak}` — **DEPRECATED**: use `coinService.processDailyLogin` instead
- `getDiscoverFeed(uid, excludeUids, lastDoc?, pageSize)` → `{users, lastDoc}`
- `getInteractedUids(uid)` → `string[]`
- `sendConnectionRequest(from, to, note)` / `respondToConnectionRequest(id, status)` / `withdrawConnectionRequest(id)`
- `subscribeToPendingRequests(uid, cb)` → Unsubscribe
- `getConnectionRequestStatus(from, to)` → `ConnectionRequest | null`
- `subscribeToConnections(uid, cb)` → Unsubscribe
- `areConnected(uid1, uid2)` → boolean
- `proposeMeetup(connectionId, proposal)` / `respondToMeetup(connectionId, status)`
- `subscribeToMessages(connectionId, cb)` / `sendMessage(connectionId, message)`
- `getMemories(uid)` / `saveMemory(uid, memory)` / `toggleMemoryFavorite(uid, memoryId, current)`
- `postStatus(uid, status)` / `getActiveStatuses(connectionUids[])` (max 10 uids, Firestore __name__ in limit)
- `getEvents(constraints[])` / `createEvent(event)` / `rsvpEvent(eventId, uid)`
- `getPosts()` / `createPost(post)` / `togglePostLike(postId, uid, liked)`

---

## `src/services/`

| File | Key Exports | Notes |
|------|------------|-------|
| `coinService.ts` | `awardCoins`, `spendCoins`, `processDailyLogin`, `COIN_REWARDS`, `COIN_LABELS` | Atomic Firestore transactions + dedup keys. Use this, not firestore-helpers for coins |
| `notificationService.ts` | `registerForPushNotifications`, `scheduleDailyStreakReminder`, `clearAllNotifications`, `addForegroundListener`, `addResponseListener` | Expo Notifications. Requires expo-notifications + expo-device packages |
| `otpService.ts` | `isBackendOtpEnabled`, `sendBackendOtp`, `verifyBackendOtp` | Custom OTP via Node backend + Twilio Verify. Activates when `EXPO_PUBLIC_BACKEND_URL` is set. Calls `signInWithCustomToken` on success |
| `voiceService.ts` | `fetchVoiceToken`, `createVoiceClient` | Daily.co wrapper. `createVoiceClient` lazy-requires `@daily-co/react-native-daily-js`, falls back to no-op stub in Expo Go |
| `ludoRoomService.ts` | `subscribeToLudoState`, `updateLudoState`, `initLudoState` | RTDB sync at `gameRooms/{roomId}/ludo` — low-latency multiplayer state |

---

## `src/store/`

| File | Store | State |
|------|-------|-------|
| `authStore.ts` | `useAuthStore` | `firebaseUser`, `userProfile`, `isLoading` + setters + `reset()` |
| `matchStore.ts` | `useMatchStore` | Pending requests, connections list |
| `eventStore.ts` | `useEventStore` | Events list |

---

## `src/navigation/`

| File | Exports | Notes |
|------|---------|-------|
| `RootNavigator.tsx` | `default RootNavigator` | Wraps in `<ErrorBoundary>`. Reads `ONBOARDING_KEY` from AsyncStorage. Flow: Onboarding→PhoneLogin→ProfileSetup→Main |
| `MainTabs.tsx` | `default MainTabs` | 5 tabs: Discover/Events/Feed/Play/Profile. Each has its own stack navigator. Play tab uses GamesNavigator |

---

## `src/screens/Auth/`

| File | Purpose |
|------|---------|
| `OnboardingScreen.tsx` | 3-slide intro. Animated FlatList pagingEnabled. Sets `ONBOARDING_KEY` in AsyncStorage |
| `PhoneLoginScreen.tsx` | Firebase phone OTP login. Confirm code → ProfileSetup or Main |
| `ProfileSetupScreen.tsx` | First-time profile creation wizard |

---

## `src/screens/Discover/`

| File | Purpose |
|------|---------|
| `DiscoverScreen.tsx` | Main discover feed. `StoriesBar` (status stories row), paginated profiles, vibe compatibility display |
| `ProfileDetailScreen.tsx` | Detailed profile view with `PhotoCarousel` (multi-photo + dots) |
| `ConnectRequestScreen.tsx` | Send connection request with note (max 300 chars) |
| `ConnectionsScreen.tsx` | List of accepted connections, navigate to Chat |
| `ChatScreen.tsx` | Real-time chat. RTDB typing indicators (`typing/{connectionId}/{uid}`). Cleanup on unmount |
| `MeetupSuggestionScreen.tsx` | Propose real-world meetup with type/place/date |
| `MatchesListScreen.tsx` | Unused stub (navigation goes Discover→Connections→Chat) |

---

## `src/screens/Events/`

| File | Purpose |
|------|---------|
| `EventsScreen.tsx` | Browse events list with category filter |
| `CreateEventScreen.tsx` | Host a new event (title, description, location, date, category) |
| `EventDetailScreen.tsx` | Event details + RSVP button |

---

## `src/screens/Feed/`

| File | Purpose |
|------|---------|
| `FeedScreen.tsx` | Social feed with like/unlike and create post nav |
| `CreatePostScreen.tsx` | Create text+image post. Firebase Storage for media |

---

## `src/screens/Games/`

| File | Purpose |
|------|---------|
| `GamesScreen.tsx` | Hub: Incoming invites section + Ludo/Truth-or-Dare cards with "Play Solo" / "Play with Friends" buttons |
| `LudoGame.tsx` | Full 2-player Ludo. Accepts optional `roomId` route param; shows multiplayer banner when present |
| `TruthOrDare.tsx` | Truth or Dare card game. Accepts optional `roomId` route param; shows multiplayer banner when present |
| `GameInviteScreen.tsx` | Multi-select connections list. Creates GameRoom + fans out GameInvites (5-min expiry) → navigates to GameLobby |
| `GameLobbyScreen.tsx` | Waiting room. Subscribes to room, Ready toggle, host Start button, Join/Mute/Leave voice, auto-nav when status='playing' |
| `GameRoomScreen.tsx` | Empty stub (kept for back-compat) |

---

## `src/screens/Profile/`

| File | Purpose |
|------|---------|
| `ProfileScreen.tsx` | Main profile. Stats (coins/streak), completeness bar, vibe summary, quick actions, settings links |
| `EditProfileScreen.tsx` | Edit profile. 6-photo grid with Firebase Storage upload, completeness calculator |
| `VibeQuizScreen.tsx` | 7-question vibe quiz. Computes VibeProfile (energy/social/adventure/aesthetic). Animated progress bar |
| `ViewMemoriesScreen.tsx` | Timeline of auto-generated memories. Filter tabs, favorite toggle |
| `StatusCreateScreen.tsx` | Post a 24h DriftStatus (6 types: vibe_check, location_drop, etc.) |
| `CoinHistoryScreen.tsx` | Coin transaction history. Reads `users/{uid}/coinTransactions` subcollection |
| `PrivacySettingsScreen.tsx` | Toggle privacy prefs. Loads from `userProfile.privacyPrefs`. Saves to Firestore |
| `TermsScreen.tsx` | Terms of Service + Privacy Policy tabs with markdown-parsed content |

---

## `src/components/`

| File | Props | Notes |
|------|-------|-------|
| `Avatar.tsx` | `photoURL?`, `name`, `size?` | Initials fallback |
| `Button.tsx` | `title`, `onPress`, `variant?`, `loading?` | primary/secondary/outline variants |
| `Card.tsx` | `children`, `style?` | Surface card with border |
| `EmptyState.tsx` | `emoji`, `title`, `subtitle?` | Centered empty list state |
| `ErrorBoundary.tsx` | `children` | React class component. "Something drifted off course" crash screen |
| `Input.tsx` | `value`, `onChangeText`, `placeholder?`, etc. | Styled text input |
| `GameInviteBanner.tsx` | — | Root-mounted animated bottom toast. Listens to `subscribeToIncomingInvites`. Accept → join room + nav to GameLobby. Auto-hides after 15s |

---

## `backend/`  (Node.js server)

| File | Purpose |
|------|---------|
| `src/index.ts` | Express bootstrap, CORS, JSON, `/health`, mounts routers, listens on PORT |
| `src/firebase.ts` | firebase-admin init via `FIREBASE_SERVICE_ACCOUNT_PATH` |
| `src/middleware/auth.ts` | `verifyFirebaseIdToken` — extracts Bearer token, attaches `req.uid` |
| `src/routes/auth.ts` | `POST /auth/otp/send`, `POST /auth/otp/verify` (Twilio Verify → Firebase custom token) |
| `src/routes/notifications.ts` | `POST /notifications/send` — FCM push to `users/{uid}.fcmToken` |
| `src/routes/voice.ts` | `POST /voice/token` — Daily.co room + meeting token (2h expiry) |
| `src/routes/games.ts` | `POST /games/invite` — creates GameInvite doc + triggers push |
| `.env.example` | All env vars: TWILIO_*, DAILY_*, FIREBASE_SERVICE_ACCOUNT_PATH, PORT |

---

## Firebase Architecture

```
Firestore collections:
  users/{uid}                           ← UserProfile
  users/{uid}/coinTransactions/{txId}   ← CoinTransaction (immutable ledger)
  users/{uid}/memories/{memoryId}       ← Memory

  connectionRequests/{fromUid_toUid}    ← ConnectionRequest
  connections/{sorted_uid1_uid2}        ← Connection
  connections/{id}/messages/{msgId}     ← Message

  statuses/{uid}                        ← DriftStatus (one active per user)
  events/{eventId}                      ← Event
  posts/{postId}                        ← Post

RTDB paths:
  typing/{connectionId}/{uid}           ← boolean (typing indicator)

Firebase Storage:
  photos/{uid}/{index}.jpg              ← Profile photos (max 6)
  posts/{uid}/{postId}                  ← Post media
```

---

## Key Patterns

```ts
// Navigation typing (always use this pattern)
const navigation = useNavigation<NativeStackNavigationProp<StackParamList, 'ScreenName'>>();

// Auth guard
const { firebaseUser, userProfile } = useAuthStore();

// Real-time listener cleanup
useEffect(() => {
  const unsub = subscribeToX(uid, cb);
  return () => unsub();
}, [uid]);

// Coin award (atomic + dedup)
await awardCoins(uid, 'daily_login', undefined, `${uid}_daily_login_${today}`);

// RTDB typing indicator
const typingRef = ref(rtdb, `typing/${connectionId}/${uid}`);
set(typingRef, true);
// cleanup: remove(typingRef)
```

---

## MOCK_AUTH flag
`App.tsx` has `const MOCK_AUTH = true`.  
- `true` → injects mock user, skips Firebase Auth (use while OTP billing is off)  
- `false` → real `onAuthStateChanged` listener (flip when billing is enabled)

## Manual Steps Required
1. **Enable Firebase Billing** → flip `MOCK_AUTH = false` in App.tsx
2. **Deploy Firestore rules**: `firebase deploy --only firestore:rules`
3. **Install missing packages** (if not already):  
   `expo install expo-notifications expo-device`
4. **Firebase Console**: enable Phone Authentication under Auth > Sign-in providers
5. **App Store / Play Store**: update `app.json` icons + splash before submission
