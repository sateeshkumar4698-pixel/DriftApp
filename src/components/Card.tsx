import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme, AppColors, spacing, radius, shadows } from '../utils/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: CardProps) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  return <View style={[styles.card, style]}>{children}</View>;
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.background,
      borderRadius: radius.md,
      padding: spacing.md,
      ...shadows.card,
    },
  });
}
