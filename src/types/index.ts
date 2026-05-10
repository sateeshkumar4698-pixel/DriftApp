// ─── User ─────────────────────────────────────────────────────────────────────

export interface VibeProfile {
  energy: number;       // 0–1  quiet → energetic
  social: number;       // 0–1  introvert → extrovert
  adventure: number;    // 0–1  routine → spontaneous
  aesthetic: number;    // 0–1  practical → aesthetic
  primaryVibes: string[];
  musicTaste: string[];
  nightlifeStyle: 'club' | 'lounge' | 'houseparty' | 'homebody' | 'outdoor';
  quizCompletedAt?: number;
}

export interface UserStreak {
  current: number;
  longest: number;
  lastLoginDate: string; // 'YYYY-MM-DD'
}

export interface PrivacyPrefs {
  statusVisibility:           'connections' | 'everyone';
  memoriesVisibility:         'private' | 'connections' | 'everyone';
  showOnlineStatus:           boolean;
  showLastSeen:               boolean;
  allowConnectionRequests:    boolean;
  showInDiscoverFeed:         boolean;
  screenshotAlert:            boolean;
  readReceipts:               boolean;
  allowTagging:               boolean;
  profileIndexed:             boolean;
}

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;  // optional — email-only users have no phone number
  name: string;
  age: number;
  bio: string;
  interests: string[];
  photoURL?: string;
  photos?: string[];           // up to 6 photos
  lookingFor: LookingForOption[];
  vibeProfile?: VibeProfile;
  coins: number;
  streak: UserStreak;
  city?: string;
  college?: string;
  work?: string;
  instagram?: string;
  profileCompleteness: number; // 0–100
  isVerified: boolean;
  isBanned: boolean;
  blockedUsers?: string[];     // UIDs this user has blocked
  createdAt: number;
  privacyPrefs?: PrivacyPrefs;
  isPremium?: boolean;
  premiumExpiresAt?: number;
  // ── Profile Share (Phase 1) ────────────────────────────────────────────────
  username?: string;           // unique @handle e.g. "priya_7f3a" (auto-generated)
  driftId?: string;            // display form user can customise e.g. "priya.drift"
}

export type LookingForOption = 'friends' | 'dating' | 'networking' | 'events';

// ─── Connection (replaces Like + Match) ───────────────────────────────────────

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';

export interface ConnectionRequest {
  id: string;                  // fromUid_toUid
  fromUid: string;
  toUid: string;
  note: string;                // "What made you interesting" message
  status: ConnectionStatus;
  createdAt: number;
  respondedAt?: number;
}

export interface Connection {
  id: string;                  // sorted uid1_uid2
  users: [string, string];
  connectedAt: number;
  lastMessage?: string;
  lastMessageAt?: number;
  // After connection: meetup can be proposed
  meetupProposal?: MeetupProposal;
}

// ─── Meetup ───────────────────────────────────────────────────────────────────

export type MeetupType = 'cafe' | 'event' | 'jamming' | 'gaming' | 'walk' | 'food' | 'custom';

export interface MeetupProposal {
  id: string;
  proposedBy: string;
  meetupType: MeetupType;
  note: string;
  suggestedPlace?: string;     // cafe name or venue
  suggestedEventId?: string;   // link to a Drift event
  suggestedDate?: number;      // timestamp
  status: 'pending' | 'accepted' | 'declined' | 'done';
  createdAt: number;
}

// ─── Message ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
  readBy?: string[];
  metadata?: {
    type?: 'game_invite';
    gameId?: 'ludo' | 'truth-dare';
    roomId?: string;
    inviteId?: string;
  };
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export type MemoryType =
  | 'first_connection'
  | 'first_message'
  | 'call_milestone'
  | 'game_win'
  | 'event_attended'
  | 'streak_milestone'
  | 'meetup_done'
  | 'manual';

export interface Memory {
  id: string;
  uid: string;
  type: MemoryType;
  title: string;
  description: string;
  emoji: string;
  mediaURL?: string;
  involvedUsers?: string[];
  eventId?: string;
  location?: string;
  isPrivate: boolean;
  isPinned: boolean;
  isFavorite: boolean;
  date: number;
  createdAt: number;
}

// ─── Status ───────────────────────────────────────────────────────────────────

export type StatusType =
  | 'vibe_check'
  | 'location_drop'
  | 'looking_for'
  | 'event_invite'
  | 'game_invite'
  | 'photo_moment'
  | 'memory_share';

export interface DriftStatus {
  uid: string;
  type: StatusType;
  text?: string;
  mediaURL?: string;
  vibe?: string;
  location?: { venue: string; city: string };
  eventId?: string;
  memoryId?: string;
  audience: 'connections' | 'everyone';
  expiresAt: number;
  views: string[];
  reactions: Record<string, string>;
  createdAt: number;
}

// ─── Event ────────────────────────────────────────────────────────────────────

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  date: number;
  hostId: string;
  hostName: string;
  attendees: string[];
  maxAttendees?: number;
  category: EventCategory;
  imageURL?: string;
  tags?: string[];
  cancelled?: boolean;
  createdAt: number;
  updatedAt?: number;
}

export type EventCategory = 'social' | 'professional' | 'sports' | 'food' | 'other';

// ─── Post ─────────────────────────────────────────────────────────────────────

/** Canonical post type for the new microblog feed */
export type PostType = 'text' | 'image' | 'thread' | 'poll'
  // Legacy types kept for backward-compat with existing Firestore documents
  | 'moment' | 'memory' | 'vibe' | 'question' | 'achievement';

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // uids who voted
}

export interface PostComment {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  text: string;
  createdAt: number;
  replyTo?: { id: string; userName: string };
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  // Canonical type field (new) — falls back to postType for legacy docs
  type?: PostType;
  caption: string;
  mediaURL?: string;
  mediaType?: 'image' | 'video';
  // Thread (microblog)
  threadLines?: string[];   // array of paragraphs for long-form "Waves"
  // Poll
  pollOptions?: PollOption[];
  pollEndsAt?: number;      // epoch ms when poll closes
  pollDuration?: number;    // hours (legacy compat)
  // Engagement
  likes: string[];
  commentCount?: number;    // new field name
  comments?: number;        // legacy compat
  shareCount?: number;
  reactions?: Record<string, string[]>; // emoji → uid[]
  savedBy?: string[];
  // Meta
  tags?: string[];
  location?: string;
  createdAt: number;
  // Legacy fields for backward-compat
  postType?: PostType;
  quotedPostId?: string;
  repostCount?: number;
}

// ─── Community ────────────────────────────────────────────────────────────────

export type CommunityCategory =
  | 'culture_caste'
  | 'lgbtq'
  | 'startups'
  | 'employment'
  | 'education'
  | 'students'
  | 'politics'
  | 'gossip'
  | 'gaming'
  | 'fitness'
  | 'music_arts'
  | 'tech'
  | 'relationships'
  | 'travel'
  | 'food_lifestyle'
  | 'general';

export interface Community {
  id: string;
  name: string;
  description: string;
  category: CommunityCategory;
  tags: string[];
  iconEmoji: string;
  coverColor: string;       // hex for gradient
  coverColor2?: string;     // second gradient stop
  memberCount: number;
  postCount: number;
  isPrivate: boolean;
  isVerified?: boolean;
  communityType: 'open' | 'request' | 'invite';
  createdBy: string;
  createdByName: string;
  createdAt: number;
  rules?: string[];
  pinnedPostId?: string;
}

export interface CommunityMember {
  uid: string;
  role: 'admin' | 'moderator' | 'member';
  joinedAt: number;
  displayName: string;
  photoURL?: string;
}

export interface CommunityPost {
  id: string;
  communityId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  content: string;
  mediaURL?: string;
  likes: string[];
  commentsCount: number;
  isPinned: boolean;
  isAnnouncement: boolean;
  tags?: string[];
  reactions?: Record<string, string[]>; // emoji → uid[]
  createdAt: number;
}

export interface CommunityComment {
  id: string;
  postId: string;
  communityId: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  text: string;
  likes: string[];
  replyTo?: { id: string; authorName: string };
  createdAt: number;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Onboarding: undefined;
  PhoneLogin: undefined;
  EmailAuth: undefined;
  EmailVerify: undefined;
  ProfileSetup: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Discover:   undefined;
  Events:     undefined;
  Community:  undefined;   // replaces Feed — houses both Feed posts & Communities
  Play:       undefined;
  Profile:    undefined;
};

export type DiscoverStackParamList = {
  DiscoverFeed: undefined;
  ProfileDetail: { user: UserProfile };
  ConnectRequest: { user: UserProfile };
  Connections: undefined;
  Chat: { connectionId: string; connectedUser: UserProfile };
  MeetupSuggest: { connectionId: string; connectedUser: UserProfile };
  Notifications: undefined;
  StatusCreate: { initialStatus?: DriftStatus } | undefined;
  ViewStatus: { status: DriftStatus; name: string; photoURL?: string; isMine: boolean };
  // ── Calls ──────────────────────────────────────────────────────────────────
  Call: {
    connectionId: string;
    remoteUser: UserProfile;
    callType: CallType;
    isOutgoing: boolean;
    // For incoming calls received via push notification
    roomName?: string;
    roomUrl?: string;
  };
  // ── Profile Share (Phase 1) ────────────────────────────────────────────────
  QRScanner: undefined;
  ShakeShare: undefined;
  // ── Phase 2 ───────────────────────────────────────────────────────────────
  MeetupBoard: undefined;
  VibeRooms:   undefined;
  VibeRoom:    { roomId: string; role: 'host' | 'speaker' | 'listener' };
};

export type EventsStackParamList = {
  EventsMain: undefined;
  CreateEvent: undefined;
  EventDetail: { event: Event };
  EventInvite: { event: Event };
};

export type FeedStackParamList = {
  FeedMain:             undefined;
  CreatePost:           undefined;
  PostDetail:           { post: Post };
  // ── Community navigation (nested in Community tab) ─────────────────────────
  CommunitiesList:      undefined;
  CommunityDetail:      { communityId: string };
  CreateCommunity:      undefined;
  CommunityPostDetail:  { postId: string; communityId: string };
};

export type GamesStackParamList = {
  GamesList:       undefined;
  LudoGame:        { roomId?: string } | undefined;
  TruthOrDare:     { roomId?: string } | undefined;
  WouldYouRather:  { roomId?: string } | undefined;
  NeverHaveIEver:  { roomId?: string } | undefined;
  UnoGame:         undefined;
  ChessGame:       undefined;
  BetGame:         undefined;
  GameInvite:      { gameId: GameId };
  GameLobby:       { roomId: string; gameId: GameId };
};

// ─── Multiplayer Game Types ──────────────────────────────────────────────────

export type GameId = 'ludo' | 'truth-dare' | 'wyr' | 'nhie';

export type GameRoomStatus = 'waiting' | 'playing' | 'finished' | 'abandoned';

export interface GameRoomPlayer {
  uid:       string;
  name:      string;
  photoURL?: string;
  color?:    string;  // assigned at game start (e.g. red/green for Ludo)
  ready:     boolean;
  isHost:    boolean;
  joinedAt:  number;
}

export interface GameRoom {
  id:          string;
  /** Short 6-char alphanumeric code players can share to join (e.g. "ABX3K9") */
  code?:       string;
  gameId:      GameId;
  hostUid:     string;
  status:      GameRoomStatus;
  maxPlayers:  number;
  players:     Record<string, GameRoomPlayer>; // uid → player
  voiceRoomId?: string;                        // Daily.co room name
  createdAt:   number;
  startedAt?:  number;
  finishedAt?: number;
  winnerUid?:  string;
  /**
   * Game-specific state — kept as a record to stay schema-less.
   * Ludo: { pieces: Piece[], currentTurn: uid, lastDice: number }
   * TruthOrDare: { cards: [], round: number, currentPlayer: uid }
   */
  state:       Record<string, unknown>;
}

export interface GameInvite {
  id:          string;       // `${fromUid}_${toUid}_${gameId}_${createdAt}`
  fromUid:     string;
  fromName:    string;
  fromPhoto?:  string;
  toUid:       string;
  gameId:      GameId;
  roomId:      string;       // the room the invitee will join
  status:      'pending' | 'accepted' | 'declined' | 'expired';
  createdAt:   number;
  respondedAt?: number;
  expiresAt:   number;       // 5 minutes after creation
}

// ─── Voice / Video Room ───────────────────────────────────────────────────────

export type CallType = 'audio' | 'video';

export interface VoiceRoomToken {
  token:     string;
  roomUrl:   string;
  roomName:  string;
  callType?: CallType;
  expiresAt: number;
}

export interface IncomingCallPayload {
  type:           'incoming_call';
  callType:       CallType;
  roomName:       string;
  roomUrl:        string;
  callerUid:      string;
  callerName:     string;
  callerPhotoURL: string;
}

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  AvatarBuilder: undefined;
  DriftId: undefined;
  ViewMemories: undefined;
  VibeQuiz: undefined;
  StatusCreate: { initialStatus?: DriftStatus } | undefined;
  ViewStatus: { status: DriftStatus; name: string; photoURL?: string; isMine: boolean };
  CoinHistory: undefined;
  CoinShop: undefined;
  PrivacySettings: undefined;
  BlockedUsers: undefined;
  Terms: undefined;
  ProfileShare: undefined;
  Settings: undefined;
  Feedback: undefined;
};

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotifType =
  | 'connection_request'
  | 'connection_accepted'
  | 'game_invite'
  | 'event_invite'
  | 'new_message'
  | 'event_rsvp'
  | 'system';

export interface AppNotification {
  id: string;
  uid: string;          // recipient UID
  type: NotifType;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
  /** Payload for in-app navigation */
  data: Record<string, unknown>;
}

// ─── Event Invite ─────────────────────────────────────────────────────────────

export interface EventInvite {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  eventId: string;
  eventTitle: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
  expiresAt: number;
}

// ─── Coin Transaction ─────────────────────────────────────────────────────────

export type CoinTxReason =
  | 'daily_login'
  | 'streak_7'
  | 'streak_30'
  | 'signup_bonus'
  | 'first_connection'
  | 'profile_complete'
  | 'voice_call'
  | 'video_call'
  | 'boost'
  | 'purchase'
  | 'super_like'
  | 'story_highlight'
  | 'premium_month'
  | 'invite_friend'
  | 'game_win'
  | 'event_join'
  | 'referral_bonus';

export interface CoinTransaction {
  id: string;
  uid: string;
  amount: number;       // positive = earn, negative = spend
  reason: CoinTxReason;
  label: string;
  createdAt: number;
}
