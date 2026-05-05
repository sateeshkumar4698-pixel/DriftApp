import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme, AppColors, spacing, radius, typography } from '../utils/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
}: ButtonProps) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? C.primary : '#fff'}
          size="small"
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text` as const], textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    base: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    primary: {
      backgroundColor: C.primary,
    },
    secondary: {
      backgroundColor: C.secondary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: C.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    disabled: {
      opacity: 0.5,
    },
    text: {
      ...typography.body,
      fontWeight: '600',
    },
    primaryText:   { color: '#fff' },
    secondaryText: { color: '#fff' },
    outlineText:   { color: C.primary },
    ghostText:     { color: C.primary },
  });
}
