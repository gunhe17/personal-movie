import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DK } from '../theme';
import { formatSeconds } from '../utils';
import { getSpeakerColor, getSpeakerLabel, TAG_CATEGORY_COLORS, type TimelineItem } from '..';

export interface DarkTimelineRowProps {
  item: TimelineItem;
  speakerMap?: Record<string, string> | null;
  onSpeakerPress?: (speaker: string) => void;
  isActive?: boolean;
  onSeek?: (seconds: number) => void;
}

export const DarkTimelineRow = React.forwardRef<View, DarkTimelineRowProps>(
  function DarkTimelineRow({ item, speakerMap, onSpeakerPress, isActive, onSeek }, ref) {
    const activeStyle = isActive ? styles.tlRowActive : undefined;

    const handlePress = () => {
      const sec = 'startSeconds' in item ? item.startSeconds : item.timestampSeconds;
      onSeek?.(sec);
    };

    switch (item.type) {
      case 'speaker': {
        const color = getSpeakerColor(item.speaker);
        const label = getSpeakerLabel(item.speaker, speakerMap);
        const hasCustomName = !!speakerMap?.[item.speaker];
        return (
          <TouchableOpacity ref={ref as React.Ref<any>} style={[styles.tlRow, activeStyle]} onPress={handlePress} activeOpacity={0.7}>
            <Text style={styles.tlTime}>{formatSeconds(item.startSeconds)}</Text>
            <View style={[styles.tlSpeakerDot, { backgroundColor: color.text }]} />
            <View style={styles.tlBody}>
              <TouchableOpacity
                style={styles.tlSpeakerLabelRow}
                onPress={() => onSpeakerPress?.(item.speaker)}
                activeOpacity={0.6}
              >
                <Text style={[styles.tlSpeakerLabel, { color: color.text }]}>{label}</Text>
                <Ionicons name="pencil" size={10} color={color.text} style={{ opacity: 0.7 }} />
              </TouchableOpacity>
              <Text style={[styles.tlText, isActive && styles.tlTextActive]}>{item.text}</Text>
            </View>
          </TouchableOpacity>
        );
      }
      case 'transcript':
        return (
          <TouchableOpacity ref={ref as React.Ref<any>} style={[styles.tlRow, activeStyle]} onPress={handlePress} activeOpacity={0.7}>
            <Text style={styles.tlTime}>{formatSeconds(item.startSeconds)}</Text>
            <View style={styles.tlTranscriptDot} />
            <Text style={[styles.tlBody, styles.tlText, isActive && styles.tlTextActive]}>{item.text}</Text>
          </TouchableOpacity>
        );
      case 'memo':
        return (
          <View ref={ref} style={[styles.tlRow, styles.tlMemoRow, activeStyle]}>
            <Text style={styles.tlTime}>{formatSeconds(item.timestampSeconds)}</Text>
            <Ionicons name="document-text" size={11} color={DK.accent} style={{ marginTop: 3 }} />
            <Text style={styles.tlMemoText}>{item.content}</Text>
          </View>
        );
      case 'tag': {
        const tagColor = TAG_CATEGORY_COLORS[item.category] ?? TAG_CATEGORY_COLORS.other;
        return (
          <View ref={ref} style={[styles.tlRow, styles.tlTagRow, activeStyle]}>
            <Text style={styles.tlTime}>{formatSeconds(item.timestampSeconds)}</Text>
            <View style={[styles.tlTagChip, { backgroundColor: tagColor.text + '20' }]}>
              <Text style={[styles.tlTagText, { color: tagColor.text }]}>#{item.label}</Text>
            </View>
          </View>
        );
      }
    }
  },
);

const styles = StyleSheet.create({
  tlRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: DK.borderSub,
  },
  tlRowActive: {
    backgroundColor: DK.accentDim + '18',
    borderRadius: 6,
    borderBottomColor: 'transparent',
  },
  tlTextActive: {
    color: DK.accent,
  },
  tlTime: {
    fontSize: 12,
    color: DK.textMuted,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingTop: 2,
    minWidth: 38,
  },
  tlBody: {
    flex: 1,
  },
  tlText: {
    fontSize: 15,
    lineHeight: 22,
    color: DK.text,
    letterSpacing: 0.1,
  },
  tlSpeakerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  tlTranscriptDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DK.textMuted,
    marginTop: 6,
  },
  tlSpeakerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  tlSpeakerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tlSpeakerHint: {
    fontSize: 10,
    color: DK.textMuted,
    marginLeft: 2,
  },
  tlMemoRow: {
    backgroundColor: DK.elevated,
    borderRadius: 6,
    marginVertical: 2,
    paddingHorizontal: 8,
    borderBottomWidth: 0,
  },
  tlMemoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: DK.accent,
    fontStyle: 'italic',
  },
  tlTagRow: {
    borderBottomWidth: 0,
    marginVertical: 1,
  },
  tlTagChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tlTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
