import React, { useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import type { ListRenderItem } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';

// 필드노트 다크 정체성 — 다크 RecordingSheet 위에 뜨는 시트이므로 동일 결.
const FND = COLORS.fieldnoteDark;
import { formatSeconds } from '../utils';
import { TAG_CATEGORY_LABELS, TAG_CATEGORY_COLORS } from '../constants';
import type { RecordingTimelineItem } from '../useRecordingTimeline';
import type { TagCategory } from '../types';
import { StreamingText } from './StreamingText';

export interface LiveTranscriptSheetProps {
  visible: boolean;
  onClose: () => void;
  timeline: RecordingTimelineItem[];
  scrollRef: React.RefObject<FlatList<RecordingTimelineItem> | null>;
}

/** 전사 1줄 — primitive props 로 메모이즈 (timeline 재생성 시 변경된 행만 재렌더). */
const TranscriptRow = React.memo(function TranscriptRow({
  seconds,
  endSeconds,
  text,
  chunkIndex,
  isPlaceholder,
  animatedChunksRef,
}: {
  seconds: number;
  endSeconds: number;
  text: string;
  chunkIndex: number;
  isPlaceholder: boolean;
  animatedChunksRef: React.MutableRefObject<Set<number>>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.timestamp}>
        {formatSeconds(seconds)}~{formatSeconds(endSeconds)}
      </Text>
      {isPlaceholder ? (
        <Text style={[styles.transcriptText, styles.processing]}>{text}</Text>
      ) : (
        <StreamingText
          text={text}
          chunkIndex={chunkIndex}
          animatedChunksRef={animatedChunksRef}
          textStyle={styles.transcriptText}
          wrapStyle={styles.transcriptWrap}
        />
      )}
    </View>
  );
});

/** 메모/태그 1줄 — primitive props 로 메모이즈. */
const EntryRow = React.memo(function EntryRow({
  entryType,
  tagCategory,
  content,
  seconds,
}: {
  entryType: 'memo' | 'tag';
  tagCategory?: string | null;
  content: string;
  seconds: number;
}) {
  const isTag = entryType === 'tag' && !!tagCategory;
  const tagColor = isTag
    ? TAG_CATEGORY_COLORS[tagCategory as TagCategory] || TAG_CATEGORY_COLORS.other
    : null;
  return (
    <View
      style={[
        styles.row,
        isTag && tagColor ? { backgroundColor: tagColor.bg } : null,
      ]}
    >
      <Text style={styles.timestamp}>{formatSeconds(seconds)}</Text>
      <Text
        style={[
          styles.entryText,
          isTag && tagColor ? { color: tagColor.text } : null,
        ]}
      >
        {isTag
          ? `#${TAG_CATEGORY_LABELS[tagCategory as TagCategory] || tagCategory} `
          : ''}
        {content}
      </Text>
    </View>
  );
});

export function LiveTranscriptSheet({
  visible,
  onClose,
  timeline,
  scrollRef,
}: LiveTranscriptSheetProps) {
  const animatedChunksRef = useRef<Set<number>>(new Set());

  const keyExtractor = useCallback(
    (item: RecordingTimelineItem) =>
      item.kind === 'transcript' ? `t-${item.chunkIndex}` : item.entry.id,
    [],
  );

  const renderItem = useCallback<ListRenderItem<RecordingTimelineItem>>(
    ({ item }) => {
      if (item.kind === 'transcript') {
        return (
          <TranscriptRow
            seconds={item.seconds}
            endSeconds={item.endSeconds}
            text={item.text}
            chunkIndex={item.chunkIndex}
            isPlaceholder={item.isPlaceholder}
            animatedChunksRef={animatedChunksRef}
          />
        );
      }
      return (
        <EntryRow
          entryType={item.entry.entry_type}
          tagCategory={item.entry.tag_category}
          content={item.entry.content}
          seconds={item.entry.timestamp_seconds}
        />
      );
    },
    [],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <Text style={styles.title}>실시간 기록</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={22} color={FND.sub} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={scrollRef}
            data={timeline}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            initialNumToRender={12}
            windowSize={11}
            ListEmptyComponent={
              <Text style={styles.placeholder}>
                녹음된 내용이 아직 없어요{'\n'}전사가 완료되면 여기에 표시됩니다
              </Text>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: FND.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: FND.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: 8,
  },
  placeholder: {
    textAlign: 'center',
    fontSize: 14,
    color: FND.sub,
    lineHeight: 22,
    paddingVertical: 48,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: FND.card,
  },
  timestamp: {
    fontSize: 12,
    color: FND.sub,
    fontVariant: ['tabular-nums'],
    paddingTop: 2,
    minWidth: 72,
  },
  transcriptText: {
    flex: 1,
    fontSize: 14,
    color: FND.text,
    lineHeight: 20,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  transcriptWrap: {
    flex: 1,
  },
  processing: {
    color: FND.sub,
    fontStyle: 'italic',
  },
  entryText: {
    flex: 1,
    fontSize: 14,
    color: FND.text,
    lineHeight: 20,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
});
