import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, AppColors, spacing, typography } from '../utils/useTheme';

interface EmptyStateProps {
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  iconGrad?: readonly [string, string];
  emoji?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function EmptyState({
  iconName,
  iconGrad,
  emoji,
  title,
  subtitle,
  children,
}: EmptyStateProps) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const grad: readonly [string, string] = iconGrad ?? [`${C.primary}40`, `${C.secondary}20`];

  return (
    <View style={styles.container}>
      {iconName ? (
        <LinearGradient colors={grad} style={styles.iconCircle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name={iconName} size={36} color="#fff" />
        </LinearGradient>
      ) : (
        <Text style={styles.emoji}>{emoji ?? '✨'}</Text>
      )}
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
      gap: spacing.sm,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emoji: {
      fontSize: 56,
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.heading,
      color: C.text,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.body,
      color: C.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
  });
}
