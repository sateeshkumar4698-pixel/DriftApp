import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography, radius } from '../../utils/theme';
import { useAuthStore } from '../../store/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_KEY = 'drift_onboarding_done';

interface Slide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  bg: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    emoji: '🌊',
    title: 'Drift, don\'t swipe',
    subtitle: 'Browse real profiles at your own pace. No swiping, no games — just genuine people worth knowing.',
    bg: '#FFF5F7',
    accent: colors.primary,
  },
  {
    id: '2',
    emoji: '🤝',
    title: 'Connect with intention',
    subtitle: 'Send a personal note with every connection request. Tell them what made you interesting — that first impression matters.',
    bg: '#F5F0FF',
    accent: '#6C5CE7',
  },
  {
    id: '3',
    emoji: '📍',
    title: 'Meet in the real world',
    subtitle: 'Propose meetups at cafés, events, or jam sessions. Drift is about real connections, not endless DMs.',
    bg: '#F0FFF8',
    accent: '#00B894',
  },
];

function SlideView({ slide }: { slide: Slide }) {
  return (
    <View style={[slideStyles.container, { width: SCREEN_WIDTH }]}>
      <View style={[slideStyles.emojiCircle, { backgroundColor: `${slide.accent}15` }]}>
        <Text style={slideStyles.emoji}>{slide.emoji}</Text>
      </View>
      <Text style={slideStyles.title}>{slide.title}</Text>
      <Text style={slideStyles.subtitle}>{slide.subtitle}</Text>
    </View>
  );
}
const slideStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emojiCircle: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emoji: { fontSize: 56 },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 36,
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 320,
  },
});

export default function OnboardingScreen() {
  const { setOnboardingDone } = useAuthStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    // Update store → RootNavigator's conditional rendering automatically
    // shows PhoneLogin. Never manually navigate to PhoneLogin.
    setOnboardingDone(true);
  }

  function handleNext() {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  }

  const isLast = activeIndex === SLIDES.length - 1;
  const activeSlide = SLIDES[activeIndex];

  return (
    <SafeAreaView style={styles.flex}>
      {/* Skip button */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={finish} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
        }}
        scrollEventThrottle={16}
        renderItem={({ item }) => <SlideView slide={item} />}
        style={{ flex: 1 }}
      />

      {/* Dots — width animates with scroll; color uses activeIndex state (avoids
           hex-string interpolation which produces NaN on some iOS versions) */}
      <View style={styles.dotsRow}>
        {SLIDES.map((slide, i) => {
          const sw = Math.max(SCREEN_WIDTH, 1); // guard against 0-width on simulator init
          const dotWidth = scrollX.interpolate({
            inputRange: [(i - 1) * sw, i * sw, (i + 1) * sw],
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const isActive = activeIndex === i;
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  backgroundColor: isActive ? slide.accent : colors.border,
                },
              ]}
            />
          );
        })}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: activeSlide.accent }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {isLast ? 'Get Started 🚀' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export { ONBOARDING_KEY };

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  skipBtn: { padding: spacing.xs },
  skipText: { ...typography.body, color: colors.textSecondary },

  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  dot: { height: 8, borderRadius: 4 },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  nextBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  nextBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
