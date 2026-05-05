// ─── Analytics Service (React Native safe stub) ──────────────────────────────
//
// firebase/analytics is a BROWSER-ONLY SDK. It requires cookies, IndexedDB,
// and DOM APIs (getElementsByTagName) that do not exist in React Native's JS
// engine. Importing it — even inside a try/catch — triggers Firebase's
// analytics module initializer and crashes with:
//   [TypeError: Cannot read property 'getElementsByTagName' of undefined]
//
// Solution: stub every exported function as a no-op.
// If you later need real analytics, use @react-native-firebase/analytics
// (the native module) which calls the native Firebase SDK instead.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Session ──────────────────────────────────────────────────────────────────

export function setAnalyticsUser(_uid: string, _city?: string) {}
export function trackSessionStart() {}
export function trackSessionEnd(_durationMs: number) {}

// ─── Feed ─────────────────────────────────────────────────────────────────────

export function trackPostCreated(_postType: string) {}
export function trackPostLiked(_postId: string) {}
export function trackPostShared(_postId: string) {}
export function trackPostCommented(_postId: string) {}

// ─── Events ───────────────────────────────────────────────────────────────────

export function trackEventViewed(_eventId: string, _category: string) {}
export function trackEventInterested(_eventId: string) {}
export function trackEventCreated(_category: string) {}

// ─── Discovery / Matching ─────────────────────────────────────────────────────

export function trackProfileViewed(_targetUid: string) {}
export function trackConnectRequested(_targetUid: string) {}
export function trackConnectAccepted() {}
export function trackMessageSent(_connectionId: string) {}

// ─── Notifications ────────────────────────────────────────────────────────────

export function trackNotificationReceived(_type: string) {}
export function trackNotificationTapped(_type: string) {}

// ─── Games ────────────────────────────────────────────────────────────────────

export function trackGameStarted(_gameId: string, _mode: 'solo' | 'friends') {}
export function trackGameFinished(_gameId: string, _won: boolean) {}

// ─── Onboarding funnel ────────────────────────────────────────────────────────

export function trackOnboardingStep(_step: string) {}
export function trackOnboardingComplete() {}
