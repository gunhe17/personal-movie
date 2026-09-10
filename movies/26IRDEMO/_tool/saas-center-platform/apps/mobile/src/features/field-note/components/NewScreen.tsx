import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';
import { DK } from '../theme';

export interface NewScreenProps {
  sessionInfo: string;
  isQuickMode: boolean;
  onStart: () => void;
  isStarting: boolean;
  onBack: () => void;
}

export function NewScreen({ sessionInfo, isQuickMode, onStart, isStarting, onBack }: NewScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={DK.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>필드노트</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={styles.center}>
        <Ionicons name="mic-outline" size={64} color={DK.textMuted} />
        <Text style={styles.title}>녹음을 시작하세요</Text>
        {isQuickMode ? (
          <Text style={styles.sub}>녹음 후 회기를 연결할 수 있습니다</Text>
        ) : sessionInfo ? (
          <Text style={styles.sub}>{sessionInfo}</Text>
        ) : null}
        <TouchableOpacity
          style={styles.startBtn}
          onPress={onStart}
          disabled={isStarting}
        >
          {isStarting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="mic" size={22} color={COLORS.white} />
              <Text style={styles.startBtnText}>녹음 시작</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DK.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: DK.surface,
    borderBottomWidth: 1,
    borderBottomColor: DK.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: DK.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 80,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: DK.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  sub: {
    fontSize: 15,
    color: DK.textSec,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DK.accentDim,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    marginTop: 12,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
