import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/shared/constants/theme';
import { DK } from '../theme';
import type { RecentMemo } from '../types';

export interface MemoOverlayProps {
  visible: boolean;
  memoText: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  inputRef: React.RefObject<TextInput | null>;
  recentMemo: RecentMemo | null;
}

export function MemoOverlay({ visible, memoText, onChangeText, onSubmit, onClose, inputRef, recentMemo }: MemoOverlayProps) {
  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={() => { Keyboard.dismiss(); onClose(); }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlayInner}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.cardHeader}>
            <Ionicons name="create" size={16} color={DK.accent} />
            <Text style={styles.cardTitle}>메모 추가</Text>
            <TouchableOpacity onPress={() => { Keyboard.dismiss(); onClose(); }} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={DK.textMuted} />
            </TouchableOpacity>
          </View>

          {recentMemo && (
            <View style={styles.recentMemoContainer}>
              <View style={styles.recentMemoHeader}>
                <Ionicons name="checkmark-circle" size={14} color={DK.accent} />
                <Text style={styles.recentMemoLabel}>방금 추가됨</Text>
                <Text style={styles.recentMemoTime}>{recentMemo.timestamp}</Text>
              </View>
              <Text style={styles.recentMemoContent} numberOfLines={2}>
                {recentMemo.content}
              </Text>
            </View>
          )}

          <View style={styles.row}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={memoText}
              onChangeText={onChangeText}
              placeholder="메모를 입력하세요..."
              placeholderTextColor={DK.textMuted}
              returnKeyType="send"
              onSubmitEditing={onSubmit}
              multiline
            />
            <TouchableOpacity
              style={[styles.send, !memoText.trim() && { opacity: 0.4 }]}
              onPress={onSubmit}
              disabled={!memoText.trim()}
            >
              <Ionicons name="send" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  overlayInner: {
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: DK.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: DK.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: DK.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: DK.elevated,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: DK.text,
    borderWidth: 1,
    borderColor: DK.border,
    maxHeight: 100,
  },
  send: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DK.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  recentMemoContainer: {
    backgroundColor: DK.elevated,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: DK.accent + '30',
  },
  recentMemoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  recentMemoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: DK.accent,
    flex: 1,
  },
  recentMemoTime: {
    fontSize: 12,
    fontWeight: '500',
    color: DK.textMuted,
  },
  recentMemoContent: {
    fontSize: 13,
    color: DK.text,
    lineHeight: 18,
  },
});
