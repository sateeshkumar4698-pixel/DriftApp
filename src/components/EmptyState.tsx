import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, AppColors, spacing, typography } from '../utils/useTheme';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function EmptyState({ emoji = '✨', title, subtitle, children }: EmptyStateProps) {
  const { C } = useTheme();
  const styles = makeStyles(C);

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {children}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xxl,
    },
    emoji: {
      fontSize: 56,
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.heading,
      color: C.text,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
  });
}
