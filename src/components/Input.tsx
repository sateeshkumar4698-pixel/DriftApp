import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useTheme, AppColors, spacing, radius, typography } from '../utils/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export default function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const { C } = useTheme();
  const styles = makeStyles(C);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.focused,
          error ? styles.error : null,
          style,
        ]}
        placeholderTextColor={C.textSecondary}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function makeStyles(C: AppColors) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      ...typography.caption,
      color: C.textSecondary,
      marginBottom: spacing.xs,
      fontWeight: '500',
    },
    input: {
      backgroundColor: C.surface,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      ...typography.body,
      color: C.text,
      borderWidth: 1.5,
      borderColor: C.border,
    },
    focused: {
      borderColor: C.primary,
      backgroundColor: C.background,
    },
    error: {
      borderColor: C.error,
    },
    errorText: {
      ...typography.small,
      color: C.error,
      marginTop: spacing.xs,
    },
  });
}
