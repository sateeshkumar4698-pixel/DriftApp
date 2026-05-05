import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MoodPreset, MOOD_META, useMoodStore } from '../../store/moodStore';
import { useTheme, spacing, radius, typography } from '../../utils/useTheme';

const MOODS: MoodPreset[] = ['energetic', 'chill', 'creative', 'social', 'romantic', 'focused'];

// ─── MoodDial ─────────────────────────────────────────────────────────────────

export default function MoodDial() {
  const { C }  = useTheme();
  const { moodPreset, setMood, dialVisible } = useMoodStore();

  const activeIndex = MOODS.indexOf(moodPreset);

  // Slide animation when mood changes
  const slideX   = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const prevIndex = useRef(activeIndex);

  useEffect(() => {
    if (prevIndex.current === activeIndex) return;
    const direction = activeIndex > prevIndex.current ? 1 : -1;
    prevIndex.current = activeIndex;

    // Slide out old, slide in new
    slideX.setValue(0);
    fadeAnim.setValue(1);

    Animated.parallel([
      Animated.timing(slideX, {
        toValue: -direction * 40,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      slideX.setValue(direction * 40);
      Animated.parallel([
        Animated.spring(slideX, {
          toValue: 0,
          useNativeDriver: true,
          speed: 26,
          bounciness: 6,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [activeIndex]);

  // Visibility slide
  const showAnim = useRef(new Animated.Value(dialVisible ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(showAnim, {
      toValue: dialVisible ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 0,
    }).start();
  }, [dialVisible]);

  if (!dialVisible) return null;

  const meta = MOOD_META[moodPreset];

  function goNext() {
    const next = MOODS[(activeIndex + 1) % MOODS.length];
    setMood(next);
  }
  function goPrev() {
    const prev = MOODS[(activeIndex - 1 + MOODS.length) % MOODS.length];
    setMood(prev);
  }

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          borderBottomColor: C.border,
          opacity: showAnim,
          transform: [{
            translateY: showAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-12, 0],
            }),
          }],
        },
      ]}
    >
      {/* Background gradient strip that changes colour */}
      <LinearGradient
        colors={[meta.color + '22', meta.color + '08', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      />

      {/* Prev arrow */}
      <TouchableOpacity onPress={goPrev} style={styles.arrow} activeOpacity={0.6}>
        <Text style={[styles.arrowText, { color: C.textSecondary }]}>‹</Text>
      </TouchableOpacity>

      {/* Active mood display */}
      <Animated.View
        style={[
          styles.center,
          {
            transform: [{ translateX: slideX }],
            opacity: fadeAnim,
          },
        ]}
      >
        {/* Colour dot */}
        <View style={[styles.dot, { backgroundColor: meta.color }]} />

        {/* Emoji */}
        <Text style={styles.emoji}>{meta.icon}</Text>

        {/* Label + description */}
        <View style={styles.textWrap}>
          <Text style={[styles.moodName, { color: meta.color }]}>{meta.label}</Text>
          <Text style={[styles.moodDesc, { color: C.textSecondary }]} numberOfLines={1}>
            {meta.description}
          </Text>
        </View>
      </Animated.View>

      {/* Progress dots */}
      <View style={styles.dots}>
        {MOODS.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => setMood(MOODS[i])} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <View
              style={[
                styles.stepDot,
                {
                  backgroundColor: i === activeIndex ? meta.color : C.border,
                  width: i === activeIndex ? 14 : 5,
                },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Next arrow */}
      <TouchableOpacity onPress={goNext} style={styles.arrow} activeOpacity={0.6}>
        <Text style={[styles.arrowText, { color: C.textSecondary }]}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    overflow: 'hidden',
    height: 52,
  },

  arrow: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  arrowText: { fontSize: 26, fontWeight: '300', lineHeight: 30 },

  center: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },

  dot:   { width: 8, height: 8, borderRadius: 4 },
  emoji: { fontSize: 22 },

  textWrap: { flex: 1, minWidth: 0 },
  moodName: { fontSize: 13, fontWeight: '800', letterSpacing: -0.3 },
  moodDesc: { fontSize: 10, marginTop: 1 },

  // Progress indicator dots
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  stepDot: {
    height: 5,
    borderRadius: 3,
  },
});
