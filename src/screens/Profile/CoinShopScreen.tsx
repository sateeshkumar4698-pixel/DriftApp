import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { hapticSuccess, hapticError, hapticMedium } from '../../utils/haptics';
import { useTheme, AppColors } from '../../utils/useTheme';
import { spacing, radius, typography } from '../../utils/theme';
import { spendCoins, COIN_PACKS, SPEND_ITEMS, PREMIUM_MONTHLY_PRICE_INR, CoinPack, SpendItem } from '../../services/coinService';
import { setUserProfile } from '../../utils/firestore-helpers';

// ─── Revenue model summary ────────────────────────────────────────────────────
//
//  1. Coin Packs (IAP ready) — users buy virtual coin bundles with real money.
//     RevShare: Apple/Google take 15–30%, we keep 70–85%.
//
//  2. Drift Premium — ₹149/month subscription. Users can pay with coins (500 coins)
//     or real money (via in-app subscription, coming in Phase 2).
//     Benefits: unlimited boosts, super likes, read receipts always on, no ads.
//
//  3. Boost & Super Like — impulse spend items. Boosts drive DAU × session length;
//     super likes drive connection rate. Both create positive feedback loops.
//
//  4. Referral flywheel — earning 100 coins per invite makes organic growth free;
//     those coins get spent, driving revenue.

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text, C }: { text: string; C: AppColors }) {
  return (
    <Text style={[sl.text, { color: C.textSecondary }]}>{text}</Text>
  );
}
const sl = StyleSheet.create({
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },
});

function CoinPackCard({ pack, onBuy, C }: { pack: CoinPack; onBuy: (p: CoinPack) => void; C: AppColors }) {
  const isPopular = pack.tag === 'Popular';
  const isBest    = pack.tag === 'Best Value';

  return (
    <TouchableOpacity
      style={[
        packStyles.card,
        { backgroundColor: C.surface, borderColor: isPopular ? '#FF4B6E' : isBest ? '#00B894' : C.border },
        (isPopular || isBest) && { borderWidth: 2 },
      ]}
      onPress={() => onBuy(pack)}
      activeOpacity={0.85}
    >
      {(isPopular || isBest || pack.tag === 'Mega Pack') && (
        <LinearGradient
          colors={isPopular ? ['#FF4B6E', '#C2185B'] : isBest ? ['#00B894', '#007A63'] : ['#6C5CE7', '#4834D4']}
          style={packStyles.tag}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <Text style={packStyles.tagText}>{pack.tag}</Text>
        </LinearGradient>
      )}
      <View style={packStyles.coinRow}>
        <Ionicons name="flash" size={28} color="#D4A017" />
        <Text style={[packStyles.coinCount, { color: C.text }]}>{pack.coins.toLocaleString()}</Text>
        {pack.bonus ? (
          <View style={packStyles.bonusBadge}>
            <Text style={packStyles.bonusText}>+{pack.bonus} bonus</Text>
          </View>
        ) : null}
      </View>
      <Text style={[packStyles.totalCoins, { color: C.textSecondary }]}>
        {pack.bonus ? `${(pack.coins + pack.bonus).toLocaleString()} total coins` : 'Drift Coins'}
      </Text>
      <LinearGradient
        colors={isPopular ? ['#FF4B6E', '#C2185B'] : isBest ? ['#00B894', '#007A63'] : ['#6C5CE7', '#4834D4']}
        style={packStyles.buyBtn}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        <Text style={packStyles.buyBtnText}>{pack.priceLabel}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const packStyles = StyleSheet.create({
  card: {
    borderRadius: radius.lg, borderWidth: 1, padding: spacing.md,
    alignItems: 'center', gap: spacing.xs, width: '47%',
    position: 'relative', overflow: 'hidden',
  },
  tag: {
    position: 'absolute', top: 0, right: 0,
    paddingHorizontal: 8, paddingVertical: 3, borderBottomLeftRadius: 8,
  },
  tagText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  coinCount: { fontSize: 26, fontWeight: '900' },
  bonusBadge: { backgroundColor: '#00B89420', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  bonusText: { fontSize: 10, fontWeight: '700', color: '#00B894' },
  totalCoins: { fontSize: 12 },
  buyBtn: { paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radius.full, marginTop: spacing.xs, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  buyBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});

function PremiumCard({ isPremium, coins, onSubscribe, C }: { isPremium: boolean; coins: number; onSubscribe: () => void; C: AppColors }) {
  return (
    <LinearGradient
      colors={['#1A0A2E', '#2D1B69', '#0D1744']}
      style={premStyles.card}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
    >
      <View style={premStyles.topRow}>
        <View style={premStyles.titleRow}>
          <Ionicons name="star" size={22} color="#FFD700" />
          <Text style={premStyles.title}>Drift Premium</Text>
        </View>
        {isPremium && (
          <View style={premStyles.activeBadge}>
            <Text style={premStyles.activeBadgeText}>ACTIVE</Text>
          </View>
        )}
      </View>

      <View style={premStyles.benefitsGrid}>
        {[
          { icon: 'rocket-outline' as const, text: 'Unlimited boosts' },
          { icon: 'star-outline'  as const, text: 'Unlimited super likes' },
          { icon: 'eye-off-outline' as const, text: 'Invisible browsing' },
          { icon: 'checkmark-done-outline' as const, text: 'Read receipts always on' },
          { icon: 'flag-outline' as const, text: 'Priority support' },
          { icon: 'ban-outline' as const, text: 'No ads' },
        ].map((b) => (
          <View key={b.text} style={premStyles.benefit}>
            <Ionicons name={b.icon} size={14} color="#FFD700" />
            <Text style={premStyles.benefitText}>{b.text}</Text>
          </View>
        ))}
      </View>

      {!isPremium && (
        <View style={premStyles.buyRow}>
          <TouchableOpacity style={premStyles.realMoneyBtn} onPress={onSubscribe} activeOpacity={0.85}>
            <Text style={premStyles.realMoneyText}>₹{PREMIUM_MONTHLY_PRICE_INR}/month</Text>
          </TouchableOpacity>
          <View style={premStyles.divider}>
            <Text style={premStyles.dividerText}>or</Text>
          </View>
          <TouchableOpacity
            style={[premStyles.coinsBtn, { borderColor: '#FFD70060' }]}
            onPress={onSubscribe}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={14} color="#FFD700" />
            <Text style={premStyles.coinsBtnText}>500 coins</Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

const premStyles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { fontSize: 20, fontWeight: '900', color: '#FFD700' },
  activeBadge: { backgroundColor: '#00B894', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  activeBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  benefitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: spacing.md },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '46%' },
  benefitText: { fontSize: 12, color: '#E0E0E0', fontWeight: '500' },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  realMoneyBtn: {
    flex: 1, backgroundColor: '#FFD700', paddingVertical: 12,
    borderRadius: radius.full, alignItems: 'center', minHeight: 44, justifyContent: 'center',
  },
  realMoneyText: { fontSize: 14, fontWeight: '800', color: '#000' },
  divider: { paddingHorizontal: 4 },
  dividerText: { color: '#888', fontSize: 12 },
  coinsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: radius.full, borderWidth: 1.5, minHeight: 44, justifyContent: 'center',
  },
  coinsBtnText: { fontSize: 13, fontWeight: '700', color: '#FFD700' },
});

function SpendCard({ item, coins, onSpend, C }: { item: SpendItem; coins: number; onSpend: (i: SpendItem) => void; C: AppColors }) {
  const canAfford = coins >= item.cost;
  return (
    <View style={[spendStyles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
      <View style={[spendStyles.emojiBox, { backgroundColor: `${item.color}15` }]}>
        <Text style={spendStyles.emoji}>{item.emoji}</Text>
      </View>
      <View style={spendStyles.info}>
        <Text style={[spendStyles.label, { color: C.text }]}>{item.label}</Text>
        <Text style={[spendStyles.desc, { color: C.textSecondary }]}>{item.description}</Text>
        <View style={spendStyles.costRow}>
          <Ionicons name="flash" size={12} color="#D4A017" />
          <Text style={spendStyles.costText}>{item.cost} coins</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[spendStyles.btn, { backgroundColor: canAfford ? item.color : `${item.color}30` }]}
        onPress={() => canAfford ? onSpend(item) : Alert.alert('Not enough coins', `You need ${item.cost} coins. Earn more by logging in daily or buy a coin pack!`)}
        activeOpacity={0.85}
      >
        <Text style={[spendStyles.btnText, { color: canAfford ? '#fff' : `${item.color}80` }]}>
          {canAfford ? 'Use' : 'Need more'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const spendStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm,
  },
  emojiBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  info: { flex: 1 },
  label: { fontSize: 15, fontWeight: '700' },
  desc: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  costText: { fontSize: 12, fontWeight: '700', color: '#D4A017' },
  btn: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.full, minHeight: 44, justifyContent: 'center' },
  btnText: { fontSize: 13, fontWeight: '700' },
});

// ─── Earn ways ────────────────────────────────────────────────────────────────

const EARN_WAYS = [
  { emoji: '☀️', label: '+10 daily login',        desc: 'Open the app every day' },
  { emoji: '🔥', label: '+75 at 7-day streak',    desc: 'Seven consecutive logins' },
  { emoji: '🏆', label: '+300 at 30-day streak',  desc: 'Stay consistent for a month' },
  { emoji: '🤝', label: '+20 first connection',   desc: 'Connect with someone new' },
  { emoji: '🎉', label: '+50 welcome bonus',      desc: 'One-time signup reward' },
  { emoji: '✅', label: '+30 profile complete',   desc: 'Fill out your full profile' },
  { emoji: '🎮', label: '+15 game win',           desc: 'Win a Drift game with friends' },
  { emoji: '📅', label: '+10 event check-in',     desc: 'Attend a Drift event' },
  { emoji: '👥', label: '+100 invite a friend',   desc: 'Share your referral link' },
  { emoji: '📞', label: '+5 voice call',          desc: 'Every call with a connection' },
  { emoji: '📹', label: '+10 video call',         desc: 'Every video call' },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CoinShopScreen() {
  const navigation = useNavigation();
  const { C, isDark } = useTheme();
  const { firebaseUser, userProfile, setUserProfile: setStoreProfile } = useAuthStore();
  const styles = makeStyles(C);
  const [spending, setSpending] = useState<string | null>(null);

  const coins = userProfile?.coins ?? 0;
  const isPremium = !!userProfile?.isPremium;

  function handleBuyPack(pack: CoinPack) {
    Alert.alert(
      `Buy ${pack.coins}${pack.bonus ? ` + ${pack.bonus} bonus` : ''} Coins`,
      `${pack.priceLabel} — In-app purchase will open the store. (Coming soon — IAP integration via RevenueCat/Expo IAP)`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => Alert.alert('Coming Soon', 'Coin purchases will be live in the next update. Stay tuned!') },
      ],
    );
  }

  function handlePremium() {
    if (isPremium) {
      Alert.alert('Drift Premium', 'Your Premium subscription is active. Enjoy unlimited features!');
      return;
    }
    Alert.alert(
      'Drift Premium',
      `₹${PREMIUM_MONTHLY_PRICE_INR}/month — Unlimited boosts, super likes, invisible browsing, no ads, and priority support.\n\nPay with coins (500) or start a monthly subscription.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Use 500 Coins',
          onPress: async () => {
            if (!firebaseUser || !userProfile) return;
            if (coins < 500) { hapticError(); Alert.alert('Not enough coins', 'You need 500 coins to unlock Premium for 1 month.'); return; }
            try {
              await spendCoins(firebaseUser.uid, 500, 'premium_month');
              const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
              await setUserProfile(firebaseUser.uid, { isPremium: true, premiumExpiresAt: expiresAt } as any);
              setStoreProfile({ ...userProfile, isPremium: true, premiumExpiresAt: expiresAt, coins: coins - 500 } as any);
              hapticSuccess();
              Alert.alert('Drift Premium Activated!', 'Enjoy unlimited features for 30 days.');
            } catch {
              hapticError();
              Alert.alert('Error', 'Could not activate Premium. Please try again.');
            }
          },
        },
        {
          text: '₹149/month',
          onPress: () => Alert.alert('Coming Soon', 'Monthly subscription via Google Play / App Store is coming in the next update.'),
        },
      ],
    );
  }

  async function handleSpend(item: SpendItem) {
    if (!firebaseUser || !userProfile) return;
    Alert.alert(
      `Use ${item.label}?`,
      `Spend ${item.cost} coins to ${item.description.toLowerCase()}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Spend ${item.cost} coins`,
          onPress: async () => {
            setSpending(item.id);
            try {
              const newBalance = await spendCoins(firebaseUser.uid, item.cost, item.id as any);
              setStoreProfile({ ...userProfile, coins: newBalance } as any);
              hapticMedium();
              Alert.alert('Done!', item.id === 'boost'
                ? 'Your profile is now boosted to the top of Discover for 30 minutes!'
                : item.id === 'super_like'
                ? 'Super like sent! They\'ll see it at the top of their queue.'
                : 'Story highlight pinned to your profile for 7 days!');
            } catch (err: any) {
              Alert.alert('Error', err?.message ?? 'Could not process the request.');
            } finally {
              setSpending(null);
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
            <Text style={[styles.headerTitle, { color: C.text }]}>Coin Shop</Text>
            <Text style={[styles.headerSub, { color: C.textSecondary }]}>Earn, spend, and level up</Text>
          </View>
          {/* Balance pill */}
          <View style={[styles.balancePill, { backgroundColor: '#FDCB6E15', borderColor: '#FDCB6E40' }]}>
            <Ionicons name="flash" size={14} color="#D4A017" />
            <Text style={styles.balanceText}>{coins}</Text>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Balance hero */}
          <LinearGradient
            colors={isDark ? ['#1A0A2E', '#2D1B69'] : ['#F0EDFF', '#E8E4FF']}
            style={styles.balanceHero}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            <Ionicons name="flash" size={36} color="#D4A017" />
            <Text style={[styles.heroCoins, { color: C.text }]}>{coins}</Text>
            <Text style={[styles.heroLabel, { color: C.textSecondary }]}>Drift Coins</Text>
            {isPremium && (
              <View style={styles.premiumActivePill}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.premiumActivePillText}>Premium Active</Text>
              </View>
            )}
          </LinearGradient>

          {/* Drift Premium */}
          <SectionLabel text="Drift Premium" C={C} />
          <PremiumCard isPremium={isPremium} coins={coins} onSubscribe={handlePremium} C={C} />

          {/* Buy Coins */}
          <SectionLabel text="Buy Coin Packs" C={C} />
          <Text style={[styles.packNote, { color: C.textSecondary }]}>
            Coins never expire · Secure payment via Google Play / App Store
          </Text>
          <View style={styles.packsGrid}>
            {COIN_PACKS.map((pack) => (
              <CoinPackCard key={pack.id} pack={pack} onBuy={handleBuyPack} C={C} />
            ))}
          </View>

          {/* Spend Coins */}
          <SectionLabel text="Spend Coins" C={C} />
          {spending && <ActivityIndicator color={C.primary} style={{ marginBottom: spacing.sm }} />}
          {SPEND_ITEMS.map((item) => (
            <SpendCard key={item.id} item={item} coins={coins} onSpend={handleSpend} C={C} />
          ))}

          {/* How to earn free coins */}
          <SectionLabel text="How to Earn Free Coins" C={C} />
          <View style={[styles.earnCard, { backgroundColor: C.surface, borderColor: C.border }]}>
            {EARN_WAYS.map((w, i) => (
              <View
                key={w.label}
                style={[
                  styles.earnRow,
                  { borderBottomColor: C.border },
                  i === EARN_WAYS.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={styles.earnEmoji}>{w.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.earnLabel, { color: C.text }]}>{w.label}</Text>
                  <Text style={[styles.earnDesc, { color: C.textSecondary }]}>{w.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Referral CTA */}
          <TouchableOpacity
            style={[styles.referralCard, { backgroundColor: `${C.primary}10`, borderColor: `${C.primary}30` }]}
            onPress={() => Alert.alert('Invite Friends', 'Share your referral link with friends. You earn 100 coins when they sign up and complete their profile.\n\nReferral link sharing coming soon!')}
            activeOpacity={0.85}
          >
            <View style={styles.referralLeft}>
              <Ionicons name="people-outline" size={24} color={C.primary} />
              <View>
                <Text style={[styles.referralTitle, { color: C.text }]}>Invite Friends</Text>
                <Text style={[styles.referralSub, { color: C.textSecondary }]}>Earn 100 coins per friend who joins</Text>
              </View>
            </View>
            <LinearGradient
              colors={['#FF4B6E', '#C2185B']}
              style={styles.referralBtn}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <Text style={styles.referralBtnText}>Invite</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle:  { fontSize: 18, fontWeight: '700' },
    headerSub:    { fontSize: 12, marginTop: 1 },
    balancePill:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
    balanceText:  { fontSize: 14, fontWeight: '800', color: '#D4A017' },

    scroll: { padding: spacing.lg, paddingBottom: 80 },

    balanceHero: {
      borderRadius: radius.xl, alignItems: 'center', paddingVertical: spacing.xl,
      gap: 4, marginBottom: spacing.sm,
    },
    heroCoins:   { fontSize: 52, fontWeight: '900', letterSpacing: -1 },
    heroLabel:   { fontSize: 14 },
    premiumActivePill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: '#FFD70020', paddingHorizontal: 12, paddingVertical: 5,
      borderRadius: radius.full, marginTop: 4,
    },
    premiumActivePillText: { fontSize: 12, fontWeight: '700', color: '#D4A017' },

    packNote:  { fontSize: 12, marginBottom: spacing.sm },
    packsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },

    earnCard: { borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
    earnRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    earnEmoji:{ fontSize: 20, width: 28, textAlign: 'center' },
    earnLabel:{ fontSize: 14, fontWeight: '600' },
    earnDesc: { fontSize: 12, marginTop: 1 },

    referralCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginTop: spacing.sm,
    },
    referralLeft:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
    referralTitle:  { fontSize: 15, fontWeight: '700' },
    referralSub:    { fontSize: 12, marginTop: 1 },
    referralBtn:    { paddingHorizontal: 14, paddingVertical: 11, borderRadius: radius.full, minHeight: 44, justifyContent: 'center' },
    referralBtnText:{ fontSize: 13, fontWeight: '800', color: '#fff' },
  });
}
