import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/useTheme';

interface Props {
  count: number;
  city: string;
  onPress?: () => void;
}

export default function LiveActivityBar({ count, city, onPress }: Props) {
  const { C } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (count === 0) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [count]);

  if (count === 0) return null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.8 : 1} style={styles.wrap}>
      <LinearGradient
        colors={['#FF4B6E18', '#6C5CE718']}
        style={styles.bar}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      >
        <View style={styles.left}>
          <Animated.View style={[styles.dot, { transform: [{ scale: pulse }] }]} />
          <Text style={[styles.text, { color: C.text }]}>
            <Text style={styles.count}>{count}</Text>
            {` ${count === 1 ? 'person' : 'people'} active in `}
            <Text style={[styles.city, { color: C.primary }]}>{city}</Text>
            {' now'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={C.textSecondary} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginVertical: 6 },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: '#FF4B6E30',
  },
  left:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4B6E' },
  text:  { fontSize: 13, fontWeight: '500' },
  count: { fontWeight: '800' },
  city:  { fontWeight: '700' },
});
