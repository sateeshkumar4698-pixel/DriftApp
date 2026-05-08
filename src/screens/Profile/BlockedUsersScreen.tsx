import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { useTheme, AppColors } from '../../utils/useTheme';
import { spacing, radius, typography } from '../../utils/theme';
import Avatar from '../../components/Avatar';

interface BlockedUser {
  uid: string;
  name: string;
  photoURL?: string;
}

export default function BlockedUsersScreen() {
  const navigation = useNavigation();
  const { C, isDark } = useTheme();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();
  const styles = makeStyles(C);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  async function loadBlockedUsers() {
    const blockedUids = userProfile?.blockedUsers ?? [];
    if (blockedUids.length === 0) { setLoading(false); return; }

    try {
      const users: BlockedUser[] = [];
      for (const uid of blockedUids) {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const d = snap.data();
          users.push({ uid, name: d.name ?? 'Unknown', photoURL: d.photoURL });
        } else {
          users.push({ uid, name: 'Deleted User' });
        }
      }
      setBlocked(users);
    } catch {
      setBlocked([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUnblock(user: BlockedUser) {
    Alert.alert(
      `Unblock ${user.name}?`,
      'They will be able to see your profile and send you connection requests again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            if (!firebaseUser || !userProfile) return;
            setUnblocking(user.uid);
            try {
              await updateDoc(doc(db, 'users', firebaseUser.uid), {
                blockedUsers: arrayRemove(user.uid),
              });
              const newBlocked = (userProfile.blockedUsers ?? []).filter((u) => u !== user.uid);
              setStoreProfile({ ...userProfile, blockedUsers: newBlocked } as any);
              setBlocked((prev) => prev.filter((u) => u.uid !== user.uid));
            } catch {
              Alert.alert('Error', 'Could not unblock this user. Please try again.');
            } finally {
              setUnblocking(null);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: C.background }]}>
      {isDark && <LinearGradient colors={['#0D0D1A', '#0A0A1F', '#0D0D1A']} style={StyleSheet.absoluteFill} />}
      <SafeAreaView style={styles.flex}>

        {/* Header */}
        <LinearGradient
          colors={isDark ? ['#1A0A2E', '#0D1744', '#0A1628'] : ['#FFFFFF', '#F8F9FA']}
          style={[styles.header, { borderBottomColor: C.border }]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <LinearGradient
              colors={isDark ? ['#ffffff18', '#ffffff0A'] : ['#F3F4F6', '#E5E7EB']}
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: C.text }]}>Blocked Users</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>
              {blocked.length} {blocked.length === 1 ? 'person' : 'people'} blocked
            </Text>
          </View>
          <View style={{ width: 42 }} />
        </LinearGradient>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        ) : (
          <FlatList
            data={blocked}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="shield-checkmark-outline" size={56} color={C.textSecondary} style={{ opacity: 0.5 }} />
                <Text style={[styles.emptyTitle, { color: C.text }]}>No blocked users</Text>
                <Text style={[styles.emptySub, { color: C.textSecondary }]}>
                  When you block someone, they'll appear here. You can unblock them anytime.
                </Text>
              </View>
            }
            ListHeaderComponent={
              blocked.length > 0 ? (
                <View style={[styles.infoBox, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}20` }]}>
                  <Ionicons name="information-circle-outline" size={16} color={C.primary} />
                  <Text style={[styles.infoText, { color: C.textSecondary }]}>
                    Blocked users cannot see your profile, send you messages, or find you in Discover.
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <View style={[styles.userRow, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Avatar name={item.name} photoURL={item.photoURL} size={48} />
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: C.text }]}>{item.name}</Text>
                  <Text style={[styles.userSub, { color: C.textSecondary }]}>Blocked</Text>
                </View>
                {unblocking === item.uid ? (
                  <ActivityIndicator size="small" color={C.primary} />
                ) : (
                  <TouchableOpacity
                    style={[styles.unblockBtn, { borderColor: C.primary }]}
                    onPress={() => handleUnblock(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.unblockText, { color: C.primary }]}>Unblock</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle:  { fontSize: 18, fontWeight: '700' },
    headerSub:    { fontSize: 12, marginTop: 1 },

    list: { padding: spacing.lg, gap: spacing.sm },

    infoBox: {
      flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs,
      padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm,
    },
    infoText: { flex: 1, fontSize: 13, lineHeight: 18 },

    userRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
      borderRadius: radius.md, borderWidth: 1, padding: spacing.md,
    },
    userInfo:   { flex: 1 },
    userName:   { ...typography.body, fontWeight: '700' },
    userSub:    { ...typography.small, marginTop: 2 },
    unblockBtn: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.full, borderWidth: 1.5, minHeight: 44, justifyContent: 'center' },
    unblockText:{ fontSize: 13, fontWeight: '700' },

    emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl, gap: spacing.md },
    emptyTitle:     { ...typography.heading, fontWeight: '700' },
    emptySub:       { ...typography.body, textAlign: 'center', lineHeight: 22 },
  });
}
