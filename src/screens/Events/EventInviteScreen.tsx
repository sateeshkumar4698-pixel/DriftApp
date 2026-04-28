import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { subscribeToConnections, getUserProfile, sendEventInvite } from '../../utils/firestore-helpers';
import Avatar from '../../components/Avatar';
import { spacing, radius, shadows } from '../../utils/theme';
import { Connection, EventsStackParamList, EventInvite, UserProfile } from '../../types';

type RouteProps = RouteProp<EventsStackParamList, 'EventInvite'>;

// ─── Dark tokens ──────────────────────────────────────────────────────────────
const D = {
  bg:     '#0D0D1A',
  card:   '#15152A',
  border: '#2A2A4A',
  text:   '#FFFFFF',
  sub:    '#8888BB',
  muted:  '#555580',
  pink:   '#FF4B6E',
  purple: '#6C5CE7',
  cyan:   '#00D2FF',
  green:  '#00E676',
};

export default function EventInviteScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { event } = route.params;
  const { firebaseUser, userProfile } = useAuthStore();
  const uid = firebaseUser?.uid ?? '';

  const [connections, setConnections] = useState<UserProfile[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [sending,     setSending]     = useState<Set<string>>(new Set());
  const [sent,        setSent]        = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToConnections(uid, async (conns: Connection[]) => {
      const profiles = await Promise.all(
        conns.map((c) => {
          const otherUid = c.users.find((u) => u !== uid) ?? '';
          return getUserProfile(otherUid);
        }),
      );
      setConnections(profiles.filter((p): p is UserProfile => p !== null));
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  async function handleInvite(friend: UserProfile) {
    if (!userProfile) return;
    setSending((prev) => new Set(prev).add(friend.uid));
    try {
      const now = Date.now();
      const invite: EventInvite = {
        id:         `${uid}_${friend.uid}_${event.id}_${now}`,
        fromUid:    uid,
        fromName:   userProfile.name,
        toUid:      friend.uid,
        eventId:    event.id,
        eventTitle: event.title,
        status:     'pending',
        createdAt:  now,
        expiresAt:  now + 7 * 24 * 60 * 60 * 1000,
      };
      await sendEventInvite(invite);
      setSent((prev) => new Set(prev).add(friend.uid));
    } catch {
      Alert.alert('Error', 'Could not send invite. Try again.');
    } finally {
      setSending((prev) => { const s = new Set(prev); s.delete(friend.uid); return s; });
    }
  }

  return (
    <View style={sc.root}>
      <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={sc.flex} edges={['top']}>

        {/* Header */}
        <LinearGradient colors={['#1A0A2E', '#0D1744', '#0A1628']} style={sc.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <LinearGradient colors={['#ffffff18', '#ffffff0A']} style={sc.backBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <View style={sc.headerCenter}>
            <Text style={sc.headerTitle}>Invite Friends</Text>
            <Text style={sc.headerSub} numberOfLines={1}>{event.title}</Text>
          </View>
          {/* Sent count bubble */}
          {sent.size > 0 && (
            <LinearGradient colors={['#00E676', '#00BCD4']} style={sc.sentBubble}>
              <Text style={sc.sentBubbleText}>{sent.size} sent</Text>
            </LinearGradient>
          )}
        </LinearGradient>

        {loading ? (
          <View style={sc.center}>
            <ActivityIndicator color={D.pink} size="large" />
            <Text style={sc.loadingText}>Loading connections...</Text>
          </View>
        ) : connections.length === 0 ? (
          <View style={sc.center}>
            <LinearGradient colors={['#FF4B6E22', '#6C5CE722']} style={sc.emptyIcon}>
              <Ionicons name="people-outline" size={40} color={D.pink} />
            </LinearGradient>
            <Text style={sc.emptyTitle}>No connections yet</Text>
            <Text style={sc.emptySub}>Connect with people on Discover first!</Text>
          </View>
        ) : (
          <FlatList
            data={connections}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={sc.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={sc.listHeader}>
                <Ionicons name="paper-plane-outline" size={14} color={D.sub} />
                <Text style={sc.listHeaderText}>
                  {connections.length} connection{connections.length !== 1 ? 's' : ''} — tap to invite
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={sc.sep} />}
            renderItem={({ item }) => {
              const isSending = sending.has(item.uid);
              const isSent    = sent.has(item.uid);
              return (
                <View style={sc.row}>
                  <Avatar name={item.name} photoURL={item.photoURL} size={46} />
                  <View style={sc.rowInfo}>
                    <Text style={sc.rowName}>{item.name}{item.age ? `, ${item.age}` : ''}</Text>
                    {item.city ? (
                      <View style={sc.rowCity}>
                        <Ionicons name="location-outline" size={11} color={D.muted} />
                        <Text style={sc.rowCityText}>{item.city}</Text>
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => !isSent && !isSending && handleInvite(item)}
                    disabled={isSent || isSending}
                    activeOpacity={0.8}
                  >
                    {isSent ? (
                      <LinearGradient colors={['#00E676', '#00BCD4']} style={sc.inviteBtn}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                        <Text style={sc.inviteBtnText}>Invited</Text>
                      </LinearGradient>
                    ) : isSending ? (
                      <View style={sc.inviteBtnLoading}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    ) : (
                      <LinearGradient colors={['#FF4B6E', '#C2185B']} style={sc.inviteBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Ionicons name="paper-plane-outline" size={14} color="#fff" />
                        <Text style={sc.inviteBtnText}>Invite</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const sc = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: '#ffffff10', gap: spacing.sm,
  },
  backBtn:       { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffffff20' },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub:     { fontSize: 12, color: D.sub, marginTop: 1 },
  sentBubble:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  sentBubbleText:{ fontSize: 11, fontWeight: '800', color: '#fff' },

  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { fontSize: 13, color: D.sub },
  emptyIcon:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: D.text },
  emptySub:    { fontSize: 13, color: D.sub, textAlign: 'center' },

  list:       { padding: spacing.lg, paddingBottom: 80 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
  listHeaderText: { fontSize: 12, color: D.sub, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  sep:        { height: 1, backgroundColor: D.border, marginLeft: 62 },

  row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '600', color: D.text },
  rowCity: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  rowCityText: { fontSize: 12, color: D.muted },

  inviteBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full },
  inviteBtnLoading:{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full, backgroundColor: D.purple, opacity: 0.7 },
  inviteBtnText:   { fontSize: 12, fontWeight: '700', color: '#fff' },
});
