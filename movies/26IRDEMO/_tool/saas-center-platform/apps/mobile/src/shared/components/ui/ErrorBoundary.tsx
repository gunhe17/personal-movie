import { Component, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <Ionicons name="bug-outline" size={48} color={COLORS.gray[300]} />
          <Text style={styles.title}>오류가 발생했습니다</Text>
          <Text style={styles.message}>
            예기치 않은 오류가 발생했습니다.{'\n'}다시 시도해 주세요.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            activeOpacity={0.7}
            accessibilityLabel="다시 시도"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginTop: SPACING.sm,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  message: {
    fontSize: 14,
    color: COLORS.gray[400],
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  retryButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
