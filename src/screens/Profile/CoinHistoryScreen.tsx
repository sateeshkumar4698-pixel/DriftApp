import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  collection, getDocs, orderBy, query, limit,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import EmptyState from '../../components/EmptyState';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { CoinTransaction } from '../../types';

const REASON_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  daily_login:      { emoji: '☀️', label: 'Daily Login',        color: '#FDCB6E' },
  streak_7:         { emoji: '🔥', label: '7-Day Streak',       color: '#FF4B6E' },
  streak_30:        { emoji: '🏆', label: '30-Day Streak',      color: '#6C5CE7' },
  signup_bonus:     { emoji: '🎉', label: 'Welcome Bonus',      color: '#00B894' },
  first_connection: { emoji: '🤝', label: 'First Connection',   color: '#0984E3' },
  profile_complete: { emoji: '✅', label: 'Profile Complete',   color: '#00CEC9' },
  voice_call:       { emoji: '📞', label: 'Voice Call',         color: '#E17055' },
  video_call:       { emoji: '📹', label: 'Video Call',         color: '#E17055' },
  boost:            { emoji: '🚀', label: 'Profile Boost',      color: '#6C5CE7' },
  purchase:         { emoji: '💳', label: 'Coin Purchase',      color: '#00B894' },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function TxRow({ tx }: { tx: CoinTransaction }) {
  const config = REASON_CONFIG[tx.reason] ?? { emoji: '💰', label: tx.reason, color: '#FDCB6E' };
  const isEarn = tx.amount > 0;
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: `${config.color}15` }]}>
        <Text style={styles.txEmoji}>{config.emoji}</Text>
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txLabel}>{config.label}</Text>
        <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isEarn ? colors.success : colors.error }]}>
        {isEarn ? '+' : ''}{tx.amount}
      </Text>
    </View>
  );
}

export default function CoinHistoryScreen() {
  const navigation = useNavigation();
  const { firebaseUser, userProfile } = useAuthStore();
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', firebaseUser.uid, 'coinTransactions'),
        orderBy('createdAt', 'desc'),
        limit(50),
      );
      const snap = await getDocs(q);
      setTransactions(snap.docs.map((d) => d.data() as CoinTransaction));
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Coin History</Text>
          <Text style={styles.headerSub}>Balance: {userProfile?.coins ?? 0} 💰</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* How to earn */}
      <View style={styles.earnCard}>
        <Text style={styles.earnTitle}>How to earn free coins</Text>
        <View style={styles.earnRow}>
          <Text style={styles.earnItem}>☀️ +10 daily login</Text>
          <Text style={styles.earnItem}>🔥 +75 at 7-day streak</Text>
          <Text style={styles.earnItem}>🏆 +300 at 30-day streak</Text>
          <Text style={styles.earnItem}>🤝 +20 first connection</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              emoji="💰"
              title="No transactions yet"
              subtitle="Login daily and connect with people to start earning Drift Coins."
            />
          }
          renderItem={({ item }) => <TxRow tx={item} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  backText: { fontSize: 20, color: colors.text },
  headerTitle: { ...typography.heading, color: colors.text, textAlign: 'center' },
  headerSub: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },

  earnCard: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#FDCB6E10',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FDCB6E30',
  },
  earnTitle: { ...typography.caption, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  earnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  earnItem: { ...typography.small, color: colors.textSecondary },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  txIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  txEmoji: { fontSize: 20 },
  txInfo: { flex: 1 },
  txLabel: { ...typography.body, fontWeight: '600', color: colors.text },
  txDate: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  txAmount: { ...typography.body, fontWeight: '700', fontSize: 16 },
});
