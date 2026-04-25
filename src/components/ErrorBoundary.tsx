import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '../utils/theme';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>💫</Text>
          <Text style={styles.title}>Something drifted off course</Text>
          <Text style={styles.subtitle}>An unexpected error occurred. Restart the app to continue.</Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, errorMessage: '' })}
          >
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
  },
  emoji: { fontSize: 64, marginBottom: spacing.lg },
  title: { ...typography.title, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: spacing.xl },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.lg,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  btnText: { ...typography.body, color: '#fff', fontWeight: '700' },
});
