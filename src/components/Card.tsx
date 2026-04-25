import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius, shadows } from '../utils/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
});
