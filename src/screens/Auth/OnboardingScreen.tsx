import React, { useEffect, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { spacing, typography, radius } from '../../utils/theme';
import { useTheme, AppColors } from '../../utils/useTheme';
import { useAuthStore } from '../../store/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_KEY = 'drift_onboarding_done';

interface Slide {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  grad: readonly [string, string];
  orb1: string;
  orb2: string;
  title: string;
  subtitle: string;
  accent: string;
  features: string[];
}

const SLIDES: Slide[] = [
  {
    id: '1',
    icon: 'compass',
    grad: ['#FF4B6E', '#FF8C42'],
    orb1: '#FF4B6E',
    orb2: '#FF8C42',
    accent: '#FF4B6E',
    title: 'Drift, don\'t swipe',
    subtitle: 'Browse real people at your own pace. Genuine connections, no endless swiping.',
    features: ['Real profiles', 'No algorithms', 'Your vibe, your pace'],
  },
  {
    id: '2',
    icon: 'people',
    grad: ['#6C5CE7', '#A855F7'],
    orb1: '#6C5CE7',
    orb2: '#A855F7',
    accent: '#6C5CE7',
    title: 'Connect with intention',
    subtitle: 'Send a personal note with every request. First impressions that actually matter.',
    features: ['Personal notes', 'Shared interests', 'Games together'],
  },
  {
    id: '3',
    icon: 'location',
    grad: ['#00B894', '#00D2FF'],
    orb1: '#00B894',
    orb2: '#00D2FF',
    accent: '#00B894',
    title: 'Meet in the real world',
    subtitle: 'Propose meetups at cafés, campus spots, or events. Drift is about real life.',
    features: ['Campus events', 'Nearby meetups', 'Group hangouts'],
  },
];

// ─── Animated Illustration ────────────────────────────────────────────────────

function SlideIllustration({ slide, active }: { slide: Slide; active: boolean }) {
  const float = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (active) {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    } else {
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, tension: 60, friction: 8 }).start();
    }

    const floatAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    floatAnim.start();
    return () => floatAnim.stop();
  }, [active]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  return (
    <Animated.View style={[styles.illusWrap, { transform: [{ scale }, { translateY }] }]}>
      {/* Outer glow ring */}
      <View style={[styles.illusOuter, { borderColor: slide.orb1 + '30' }]} />
      {/* Middle ring */}
      <View style={[styles.illusMiddle, { borderColor: slide.orb1 + '50' }]} />
      {/* Main gradient circle */}
      <LinearGradient
        colors={slide.grad}
        style={styles.illusMain}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={slide.icon} size={64} color="#fff" />
      </LinearGradient>
      {/* Floating orbs */}
      <View style={[styles.orb1, { backgroundColor: slide.orb1 + '40' }]} />
      <View style={[styles.orb2, { backgroundColor: slide.orb2 + '35' }]} />
      <View style={[styles.orb3, { backgroundColor: slide.orb1 + '25' }]} />
    </Animated.View>
  );
}

// ─── Slide View ───────────────────────────────────────────────────────────────

function SlideView({ slide, active }: { slide: Slide; active: boolean }) {
  const { C } = useTheme();
  return (
    <View style={[svStyles.container, { width: SCREEN_WIDTH }]}>
      <SlideIllustration slide={slide} active={active} />

      <Text style={[svStyles.title, { color: C.text }]}>{slide.title}</Text>
      <Text style={[svStyles.subtitle, { color: C.textSecondary }]}>{slide.subtitle}</Text>

      <View style={svStyles.features}>
        {slide.features.map((f) => (
          <View key={f} style={[svStyles.featureChip, { backgroundColor: slide.accent + '18', borderColor: slide.accent + '35' }]}>
            <Ionicons name="checkmark-circle" size={14} color={slide.accent} />
            <Text style={[svStyles.featureText, { color: slide.accent }]}>{f}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const svStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: spacing.lg,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xs,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  featureText: { fontSize: 12, fontWeight: '700' },
});

const styles = StyleSheet.create({
  illusWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illusOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  illusMiddle: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 1.5,
  },
  illusMain: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb1: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    top: 10,
    right: 18,
  },
  orb2: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    bottom: 18,
    right: 10,
  },
  orb3: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    bottom: 28,
    left: 16,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { C, isDark } = useTheme();
  const { setOnboardingDone } = useAuthStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  async function finish() {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
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
    <LinearGradient
      colors={isDark ? ['#0D0D1A', '#1A0A2E'] : [C.background, C.background]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        {/* Skip */}
        <View style={mainStyles.topRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={finish} style={mainStyles.skipBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[mainStyles.skipText, { color: C.textSecondary }]}>Skip</Text>
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
          renderItem={({ item, index }) => (
            <SlideView slide={item} active={index === activeIndex} />
          )}
          style={{ flex: 1 }}
        />

        {/* Dots */}
        <View style={mainStyles.dotsRow}>
          {SLIDES.map((slide, i) => {
            const sw = Math.max(SCREEN_WIDTH, 1);
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * sw, i * sw, (i + 1) * sw],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  mainStyles.dot,
                  {
                    width: dotWidth,
                    backgroundColor: activeIndex === i ? slide.accent : C.border,
                  },
                ]}
              />
            );
          })}
        </View>

        {/* CTA */}
        <View style={mainStyles.footer}>
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.85}
            style={{ borderRadius: radius.lg, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={activeSlide.grad}
              style={mainStyles.nextBtn}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={mainStyles.nextBtnText}>
                {isLast ? 'Get Started' : 'Next'}
              </Text>
              <Ionicons name={isLast ? 'rocket-outline' : 'arrow-forward'} size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

export { ONBOARDING_KEY };

const mainStyles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  skipBtn: { padding: spacing.xs },
  skipText: { ...typography.body, fontWeight: '600' },

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
  },
  nextBtnText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
