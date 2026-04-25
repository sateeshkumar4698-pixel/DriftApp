import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, typography } from '../utils/theme';
import { getInitials } from '../utils/helpers';

interface AvatarProps {
  name: string;
  photoURL?: string;
  size?: number;
}

export default function Avatar({ name, photoURL, size = 48 }: AvatarProps) {
  const initials = getInitials(name);
  const fontSize = size * 0.35;

  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.base,
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.background,
    fontWeight: '700',
  },
});
