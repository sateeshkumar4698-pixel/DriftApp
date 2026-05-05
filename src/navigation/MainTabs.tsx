import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MainTabParamList,
  DiscoverStackParamList,
  EventsStackParamList,
  FeedStackParamList,
  GamesStackParamList,
  ProfileStackParamList,
} from '../types';
import { typography } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';
import { darkColors, lightColors } from '../utils/useTheme';

// Discover stack
import DiscoverScreen from '../screens/Discover/DiscoverScreen';
import ProfileDetailScreen from '../screens/Discover/ProfileDetailScreen';
import ConnectRequestScreen from '../screens/Discover/ConnectRequestScreen';
import ConnectionsScreen from '../screens/Discover/ConnectionsScreen';
import MeetupSuggestionScreen from '../screens/Discover/MeetupSuggestionScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';

// Events stack
import EventsScreen from '../screens/Events/EventsScreen';
import CreateEventScreen from '../screens/Events/CreateEventScreen';
import EventDetailScreen from '../screens/Events/EventDetailScreen';
import EventInviteScreen from '../screens/Events/EventInviteScreen';

// Feed stack
import FeedScreen from '../screens/Feed/FeedScreen';
import CreatePostScreen from '../screens/Feed/CreatePostScreen';

// Games stack
import GamesScreen from '../screens/Games/GamesScreen';
import LudoGameScreen from '../screens/Games/LudoGame';
import TruthOrDareScreen from '../screens/Games/TruthOrDare';
import UnoGameScreen from '../screens/Games/UnoGame';
import ChessGameScreen from '../screens/Games/ChessGame';
import BetGameScreen from '../screens/Games/BetGame';
import GameInviteScreen from '../screens/Games/GameInviteScreen';
import GameLobbyScreen from '../screens/Games/GameLobbyScreen';

// Root-mounted overlays
import GameInviteBanner from '../components/GameInviteBanner';

// Profile stack
import ProfileScreen from '../screens/Profile/ProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import DriftIdScreen from '../screens/Profile/DriftIdScreen';
import VibeQuizScreen from '../screens/Profile/VibeQuizScreen';
import ViewMemoriesScreen from '../screens/Profile/ViewMemoriesScreen';
import StatusCreateScreen from '../screens/Profile/StatusCreateScreen';
import CoinHistoryScreen from '../screens/Profile/CoinHistoryScreen';
import PrivacySettingsScreen from '../screens/Profile/PrivacySettingsScreen';
import TermsScreen from '../screens/Profile/TermsScreen';
import ProfileShareScreen from '../screens/Profile/ProfileShareScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import FeedbackScreen from '../screens/Profile/FeedbackScreen';
// Discover extras (Phase 1)
import QRScannerScreen from '../screens/Discover/QRScannerScreen';
import ShakeToShareScreen from '../screens/Discover/ShakeToShareScreen';
import ViewStatusScreen from '../screens/Discover/ViewStatusScreen';

// ─── Stack Navigators ─────────────────────────────────────────────────────────

const DiscoverStack = createNativeStackNavigator<DiscoverStackParamList>();
const EventsStack   = createNativeStackNavigator<EventsStackParamList>();
const FeedStack     = createNativeStackNavigator<FeedStackParamList>();
const GamesStack    = createNativeStackNavigator<GamesStackParamList>();
const ProfileStack  = createNativeStackNavigator<ProfileStackParamList>();
const Tab           = createBottomTabNavigator<MainTabParamList>();

function DiscoverNavigator() {
  return (
    <DiscoverStack.Navigator screenOptions={{ headerShown: false }}>
      <DiscoverStack.Screen name="DiscoverFeed"    component={DiscoverScreen} />
      <DiscoverStack.Screen name="ProfileDetail"   component={ProfileDetailScreen} />
      <DiscoverStack.Screen name="ConnectRequest"  component={ConnectRequestScreen} />
      <DiscoverStack.Screen name="Connections"     component={ConnectionsScreen} />
      <DiscoverStack.Screen name="MeetupSuggest"   component={MeetupSuggestionScreen} />
      <DiscoverStack.Screen name="Chat"            component={ChatScreen} />
      <DiscoverStack.Screen name="Notifications"   component={NotificationsScreen} />
      <DiscoverStack.Screen name="StatusCreate"    component={StatusCreateScreen} />
      {/* Phase 1 extras */}
      <DiscoverStack.Screen name="QRScanner"   component={QRScannerScreen} />
      <DiscoverStack.Screen name="ShakeShare"  component={ShakeToShareScreen} />
      <DiscoverStack.Screen name="ViewStatus"  component={ViewStatusScreen} />
    </DiscoverStack.Navigator>
  );
}

function EventsNavigator() {
  return (
    <EventsStack.Navigator screenOptions={{ headerShown: false }}>
      <EventsStack.Screen name="EventsMain"   component={EventsScreen} />
      <EventsStack.Screen name="CreateEvent"  component={CreateEventScreen} />
      <EventsStack.Screen name="EventDetail"  component={EventDetailScreen} />
      <EventsStack.Screen name="EventInvite"  component={EventInviteScreen} />
    </EventsStack.Navigator>
  );
}

function FeedNavigator() {
  return (
    <FeedStack.Navigator screenOptions={{ headerShown: false }}>
      <FeedStack.Screen name="FeedMain"    component={FeedScreen} />
      <FeedStack.Screen name="CreatePost"  component={CreatePostScreen} />
    </FeedStack.Navigator>
  );
}

function GamesNavigator() {
  return (
    <GamesStack.Navigator screenOptions={{ headerShown: false }}>
      <GamesStack.Screen name="GamesList"    component={GamesScreen} />
      <GamesStack.Screen name="LudoGame"     component={LudoGameScreen} />
      <GamesStack.Screen name="TruthOrDare"  component={TruthOrDareScreen} />
      <GamesStack.Screen name="UnoGame"      component={UnoGameScreen} />
      <GamesStack.Screen name="ChessGame"    component={ChessGameScreen} />
      <GamesStack.Screen name="BetGame"      component={BetGameScreen} />
      <GamesStack.Screen name="GameInvite"   component={GameInviteScreen} />
      <GamesStack.Screen name="GameLobby"    component={GameLobbyScreen} />
    </GamesStack.Navigator>
  );
}

function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain"    component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile"    component={EditProfileScreen} />
      <ProfileStack.Screen name="DriftId"        component={DriftIdScreen} />
      <ProfileStack.Screen name="VibeQuiz"       component={VibeQuizScreen} />
      <ProfileStack.Screen name="ViewMemories"   component={ViewMemoriesScreen} />
      <ProfileStack.Screen name="StatusCreate"   component={StatusCreateScreen} />
      <ProfileStack.Screen name="CoinHistory"    component={CoinHistoryScreen} />
      <ProfileStack.Screen name="PrivacySettings"component={PrivacySettingsScreen} />
      <ProfileStack.Screen name="Terms"          component={TermsScreen} />
      <ProfileStack.Screen name="ProfileShare"   component={ProfileShareScreen} />
      <ProfileStack.Screen name="Settings"       component={SettingsScreen} />
      <ProfileStack.Screen name="Feedback"       component={FeedbackScreen} />
      <ProfileStack.Screen name="ViewStatus"     component={ViewStatusScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Tab icon helper ──────────────────────────────────────────────────────────
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon(icon: IoniconName, iconFilled: IoniconName, focused: boolean, color: string) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={focused ? iconFilled : icon} size={24} color={color} />
    </View>
  );
}

// ─── Main Tab Bar ─────────────────────────────────────────────────────────────
export default function MainTabs() {
  const insets   = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabBarH   = 52 + bottomPad;
  const isDark    = useThemeStore((s) => s.isDark);
  const C         = isDark ? darkColors : lightColors;

  return (
    <>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.background,
          borderTopColor:  C.border,
          borderTopWidth:  1,
          height:          tabBarH,
          paddingTop:      8,
          paddingBottom:   bottomPad,
        },
        tabBarActiveTintColor:   C.primary,
        tabBarInactiveTintColor: C.textSecondary,
        tabBarLabelStyle: { ...typography.small, marginTop: -2 },
      }}
    >
      <Tab.Screen
        name="Discover"
        component={DiscoverNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => TabIcon('compass-outline', 'compass', focused, color),
          tabBarLabel: 'Discover',
        }}
      />
      <Tab.Screen
        name="Events"
        component={EventsNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => TabIcon('calendar-outline', 'calendar', focused, color),
          tabBarLabel: 'Events',
        }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => TabIcon('layers-outline', 'layers', focused, color),
          tabBarLabel: 'Feed',
        }}
      />
      <Tab.Screen
        name="Play"
        component={GamesNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => TabIcon('game-controller-outline', 'game-controller', focused, color),
          tabBarLabel: 'Play',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          tabBarIcon: ({ focused, color }) => TabIcon('person-circle-outline', 'person-circle', focused, color),
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
    <GameInviteBanner />
    </>
  );
}
