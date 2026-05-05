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
import { useTheme, AppColors, spacing, typography, radius } from '../../utils/useTheme';
import { Connection, EventsStackParamList, EventInvite, UserProfile } from '../../types';

type RouteProps = RouteProp<EventsStackParamList, 'EventInvite'>;

export default function EventInviteScreen() {
  const { C, isDark } = useTheme();
  const styles = makeStyles(C);
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

  const bgColors = isDark
    ? (['#0D0D1A', '#0A0A1F', '#0D0D1A'] as const)
    : ([C.background, C.surface, C.background] as const);

  const headerColors = isDark
    ? (['#1A0A2E', '#0D1744', '#0A1628'] as const)
    : ([C.surface, C.card, C.surface] as const);

  return (
    <View style={styles.root}>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>

        <LinearGradient colors={headerColors} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <LinearGradient colors={['#ffffff18', '#ffffff0A']} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Invite Friends</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{event.title}</Text>
          </View>
          {sent.size > 0 && (
            <LinearGradient colors={['#00E676', '#00BCD4']} style={styles.sentBubble}>
              <Text style={styles.sentBubbleText}>{sent.size} sent</Text>
            </LinearGradient>
          )}
        </LinearGradient>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={styles.loadingText}>Loading connections...</Text>
          </View>
        ) : connections.length === 0 ? (
          <View style={styles.center}>
            <LinearGradient colors={[C.primary + '22', C.secondary + '22']} style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={40} color={C.primary} />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No connections yet</Text>
            <Text style={styles.emptySub}>Connect with people on Discover first!</Text>
          </View>
        ) : (
          <FlatList
            data={connections}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <Ionicons name="paper-plane-outline" size={14} color={C.textSecondary} />
                <Text style={styles.listHeaderText}>
                  {connections.length} connection{connections.length !== 1 ? 's' : ''} — tap to invite
                </Text>
              </View>
            }
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => {
              const isSending = sending.has(item.uid);
              const isSent    = sent.has(item.uid);
              return (
                <View style={styles.row}>
                  <Avatar name={item.name} photoURL={item.photoURL} size={46} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{item.name}{item.age ? `, ${item.age}` : ''}</Text>
                    {item.city ? (
                      <View style={styles.rowCity}>
                        <Ionicons name="location-outline" size={11} color={C.textTertiary} />
                        <Text style={styles.rowCityText}>{item.city}</Text>
                      </View>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => !isSent && !isSending && handleInvite(item)}
                    disabled={isSent || isSending}
                    activeOpacity={0.8}
                  >
                    {isSent ? (
                      <LinearGradient colors={['#00E676', '#00BCD4']} style={styles.inviteBtn}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                        <Text style={styles.inviteBtnText}>Invited</Text>
                      </LinearGradient>
                    ) : isSending ? (
                      <View style={[styles.inviteBtn, { backgroundColor: C.secondary, opacity: 0.7 }]}>
                        <ActivityIndicator size="small" color="#fff" />
                      </View>
                    ) : (
                      <LinearGradient colors={['#FF4B6E', '#C2185B']} style={styles.inviteBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Ionicons name="paper-plane-outline" size={14} color="#fff" />
                        <Text style={styles.inviteBtnText}>Invite</Text>
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

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: 1, borderBottomColor: C.border + '20', gap: spacing.sm,
    },
    backBtn:        { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border + '30' },
    headerCenter:   { flex: 1 },
    headerTitle:    { ...typography.h3, color: C.text },
    headerSub:      { ...typography.small, color: C.textSecondary, marginTop: 1 },
    sentBubble:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
    sentBubbleText: { ...typography.small, fontWeight: '800', color: '#fff' },
    center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    loadingText: { ...typography.caption, color: C.textSecondary },
    emptyIcon:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    emptyTitle:  { ...typography.h3, color: C.text },
    emptySub:    { ...typography.caption, color: C.textSecondary, textAlign: 'center' },
    list:       { padding: spacing.lg, paddingBottom: 80 },
    listHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.md },
    listHeaderText: { ...typography.small, color: C.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
    sep:        { height: 1, backgroundColor: C.border, marginLeft: 62 },
    row:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2 },
    rowInfo: { flex: 1 },
    rowName: { ...typography.body, fontWeight: '600', color: C.text },
    rowCity: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    rowCityText: { ...typography.small, color: C.textTertiary },
    inviteBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.full },
    inviteBtnText: { ...typography.small, fontWeight: '700', color: '#fff' },
  });
}
