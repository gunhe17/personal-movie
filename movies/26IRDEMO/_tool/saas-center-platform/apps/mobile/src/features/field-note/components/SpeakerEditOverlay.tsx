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
import { getSpeakerColor, getSpeakerLabel } from '..';

export interface SpeakerEditOverlayProps {
  speaker: string | null;
  nameInput: string;
  onChangeNameInput: (text: string) => void;
  onSave: () => void;
  onClose: () => void;
  inputRef: React.RefObject<TextInput | null>;
}

export function SpeakerEditOverlay({
  speaker,
  nameInput,
  onChangeNameInput,
  onSave,
  onClose,
  inputRef,
}: SpeakerEditOverlayProps) {
  if (!speaker) return null;

  const color = getSpeakerColor(speaker);

  return (
    <Pressable style={styles.overlay} onPress={() => { Keyboard.dismiss(); onClose(); }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlayInner}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={[styles.dot, { backgroundColor: color.text }]} />
            <Text style={styles.title}>
              {getSpeakerLabel(speaker)} 이름 설정
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={DK.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={nameInput}
              onChangeText={onChangeNameInput}
              placeholder="이름을 입력하세요 (예: 홍길동)"
              placeholderTextColor={DK.textMuted}
              returnKeyType="done"
              onSubmitEditing={onSave}
            />
            <TouchableOpacity style={styles.send} onPress={onSave}>
              <Ionicons name="checkmark" size={20} color={COLORS.white} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  title: {
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
});
