import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getInitials } from '../utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvatarFrame = 'none' | 'glow' | 'premium' | 'rainbow';

interface AvatarProps {
  name: string;
  photoURL?: string;
  size?: number;
  frame?: AvatarFrame;
  showStatus?: boolean;
  statusColor?: string;
}

// ─── Deterministic gradient from name ────────────────────────────────────────

const GRAD_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#FF4B6E', '#FF8C42'],
  ['#6C5CE7', '#A855F7'],
  ['#0984E3', '#00B4D8'],
  ['#00B894', '#00CEC9'],
  ['#E17055', '#FDCB6E'],
  ['#FF6B81', '#C2185B'],
  ['#A29BFE', '#6C5CE7'],
  ['#55EFC4', '#00B894'],
];

function nameToGradient(name: string): readonly [string, string] {
  if (!name) return GRAD_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return GRAD_PALETTES[Math.abs(hash) % GRAD_PALETTES.length];
}

// ─── Rainbow gradient ring ────────────────────────────────────────────────────

const RAINBOW: readonly [string, string, string, string, string, string] = [
  '#FF4B6E', '#FF8C42', '#FDCB6E', '#00B894', '#6C5CE7', '#A855F7',
];

// ─── Avatar ───────────────────────────────────────────────────────────────────

export default function Avatar({
  name,
  photoURL,
  size = 48,
  frame = 'none',
  showStatus = false,
  statusColor = '#00B894',
}: AvatarProps) {
  const fadeAnim = useRef(new Animated.Value(photoURL ? 0 : 1)).current;
  const grad = nameToGradient(name);
  const initials = getInitials(name);
  const fontSize = size * 0.36;
  const borderR = size / 2;

  function onImageLoad() {
    Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }

  const ringPad = frame !== 'none' ? 3 : 0;
  const innerSize = size - ringPad * 2;
  const statusDot = Math.max(10, size * 0.22);

  return (
    <View style={{ width: size, height: size }}>
      {/* Frame ring */}
      {frame === 'glow' && (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: borderR,
              borderWidth: 2.5,
              borderColor: grad[0],
              shadowColor: grad[0],
              shadowOpacity: 0.7,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
        />
      )}
      {frame === 'premium' && (
        <LinearGradient
          colors={['#FFD700', '#FF8C00', '#FFD700']}
          style={[StyleSheet.absoluteFill, { borderRadius: borderR }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      {frame === 'rainbow' && (
        <LinearGradient
          colors={RAINBOW}
          style={[StyleSheet.absoluteFill, { borderRadius: borderR }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      {/* Inner avatar */}
      <View
        style={{
          position: 'absolute',
          top: ringPad,
          left: ringPad,
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          overflow: 'hidden',
          backgroundColor: '#eee',
        }}
      >
        {/* Gradient fallback */}
        <LinearGradient
          colors={grad}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        {/* Initials overlay (hidden when photo loads) */}
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize, fontWeight: '700', color: '#fff', letterSpacing: 0.5 }}>
            {initials}
          </Text>
        </View>
        {/* Photo fade-in */}
        {!!photoURL && (
          <Animated.Image
            source={{ uri: photoURL }}
            style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
            onLoad={onImageLoad}
          />
        )}
      </View>

      {/* Status dot */}
      {showStatus && (
        <View
          style={{
            position: 'absolute',
            bottom: ringPad,
            right: ringPad,
            width: statusDot,
            height: statusDot,
            borderRadius: statusDot / 2,
            backgroundColor: statusColor,
            borderWidth: 2,
            borderColor: '#fff',
          }}
        />
      )}
    </View>
  );
}
