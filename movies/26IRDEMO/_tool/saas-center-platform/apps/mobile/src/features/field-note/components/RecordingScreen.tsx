import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Animated,
  Keyboard,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import RAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as REasing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';
import { DK } from '../theme';
import { useDarkNavBarWhileMounted } from '../useFieldNoteNavBar';
import { s } from '@/shared/utils/scale';
import { TAG_CATEGORY_LABELS, TAG_CATEGORY_COLORS } from '../constants';
import { StopRecordingSheet } from './StopRecordingSheet';
import { LiveTranscriptSheet } from './LiveTranscriptSheet';
import { WaveformBars } from './WaveformBars';
import type { RecordingTimelineItem } from '../useRecordingTimeline';
import type { RecordingHandlers } from '../useRecordingHandlers';
import type { TagCategory } from '../types';

export interface RecordingScreenProps {
  sessionInfo: string;
  isQuickMode: boolean;
  // Recorder/Timer
  isRecording: boolean;
  isPaused: boolean;
  timerFormatted: string;
  // Waveform — WaveformBars가 자체적으로 buffer 관리
  meteringRef: React.MutableRefObject<number>;
  recOpacity: Animated.Value;
  // Timeline
  recordingTimeline: RecordingTimelineItem[];
  recordingScrollRef: React.RefObject<FlatList<RecordingTimelineItem> | null>;
  // Handlers
  handlers: RecordingHandlers;
  // Mutation states
  isRecommending: boolean;
  // Navigation
  onBack: () => void;
}

export function RecordingScreen({
  isRecording,
  isPaused,
  timerFormatted,
  meteringRef,
  recOpacity,
  recordingTimeline,
  recordingScrollRef,
  handlers,
  onBack,
}: RecordingScreenProps) {
  useDarkNavBarWhileMounted();
  const insets = useSafeAreaInsets();
  // Reanimated SharedValue — 키보드 애니메이션과 부드럽게 동기화
  const { height: kbHeightSV } = useReanimatedKeyboardAnimation();
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  const memoText = handlers.memoText;
  const canSend = memoText.trim().length > 0;

  const handleSubmitMemo = () => {
    if (!canSend) return;
    handlers.handleAddMemo();
  };

  const animatedKbStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, -kbHeightSV.value - insets.bottom),
  }));

  // bottomArea의 padding — 항상 동일. 키보드 보정은 외부 RAnimated.View가 담당.
  const bottomPad = insets.bottom + s(12);

  return (
    <LinearGradient
      colors={[DK.surface, DK.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* RAnimated.View로 키보드와 부드럽게 동기화되는 paddingBottom 적용 */}
        <RAnimated.View style={[styles.flex1, animatedKbStyle]}>
          {/* subtle back button */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={s(24)} color={DK.textSec} />
            </TouchableOpacity>
          </View>

          {/* 입력 외 영역 탭 시 키보드 닫힘 */}
          <Pressable
            style={styles.dismissArea}
            onPress={() => Keyboard.dismiss()}
          >
          {/* main area — upper (centered content) */}
          <View style={styles.main}>
            {/* recording badge */}
            <Animated.View style={[styles.recBadge, { opacity: recOpacity }]}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>
                {isPaused ? '일시정지됨' : '녹음이 진행중이에요'}
              </Text>
            </Animated.View>

            {/* timer */}
            <Text style={styles.timer}>{timerFormatted}</Text>

            {/* pause + stop */}
            <View style={styles.controls}>
              <TouchableOpacity
                onPress={isPaused ? handlers.handleResume : handlers.handlePause}
                style={styles.pauseBtn}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isPaused ? 'play' : 'pause'}
                  size={s(20)}
                  color={DK.textSec}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handlers.handleStop}
                style={styles.stopBtn}
                activeOpacity={0.85}
              >
                <View style={styles.stopInner} />
              </TouchableOpacity>
            </View>
          </View>

          {/* waveform */}
          <WaveformBars
            meteringRef={meteringRef}
            isRecording={isRecording}
            isPaused={isPaused}
          />

          {/* 인라인 전사 프리뷰 — 파형과 하단 영역 사이 */}
          <TranscriptPreview
            timeline={recordingTimeline}
            isRecording={isRecording}
            isPaused={isPaused}
          />
          </Pressable>

          {/* bottom: transcript pill + memo input. 키보드 회피는 외부 KeyboardAvoidingView가 담당.
              padding은 키보드 상태에 따라 동적으로 — system UI/keyboard 위에 일정한 visible gap 유지 */}
          <View
            style={[
              styles.bottomArea,
              { paddingBottom: bottomPad },
            ]}
          >
            <TouchableOpacity
              onPress={() => setTranscriptOpen(true)}
              activeOpacity={0.85}
              style={[styles.transcriptPillWrap, styles.transcriptPill]}
            >
              <Text style={styles.transcriptPillText}>실시간 기록</Text>
              <Ionicons name="chevron-up" size={s(14)} color={DK.textSec} />
            </TouchableOpacity>

            <View style={styles.memoPill}>
              <TextInput
                value={memoText}
                onChangeText={handlers.setMemoText}
                placeholder="메모 내용을 입력해주세요"
                placeholderTextColor={DK.textMuted}
                style={styles.memoInput}
                returnKeyType="send"
                onSubmitEditing={handleSubmitMemo}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={handleSubmitMemo}
                activeOpacity={0.85}
                disabled={!canSend}
                style={[styles.sendBtn, !canSend && { opacity: 0.4 }]}
              >
                <Ionicons name="arrow-up" size={s(18)} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </RAnimated.View>
      </SafeAreaView>

      <LiveTranscriptSheet
        visible={transcriptOpen}
        onClose={() => setTranscriptOpen(false)}
        timeline={recordingTimeline}
        scrollRef={recordingScrollRef}
      />

      <StopRecordingSheet
        mode={handlers.stopSheet}
        onClose={handlers.handleStopSheetClose}
        onConfirm={handlers.handleStopConfirm}
        onSaveOnly={handlers.handleStopSaveOnly}
        onDelete={handlers.handleStopDelete}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  topBar: {
    height: s(44),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(8),
  },
  backBtn: {
    width: s(40),
    height: s(40),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissArea: {
    flex: 1,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingBottom: s(24),
  },
  // lowerSpacer replaced by previewArea styles below
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: s(14),
  },
  recDot: {
    width: s(8),
    height: s(8),
    borderRadius: s(4),
    backgroundColor: COLORS.error,
  },
  recText: {
    fontSize: s(13),
    color: DK.textSec,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  timer: {
    fontSize: s(52),
    fontWeight: '200',
    color: DK.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
    marginBottom: s(20),
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(20),
    marginBottom: s(32),
  },
  pauseBtn: {
    width: s(48),
    height: s(48),
    borderRadius: s(24),
    backgroundColor: DK.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DK.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  stopBtn: {
    width: s(52),
    height: s(52),
    borderRadius: s(26),
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  stopInner: {
    width: s(18),
    height: s(18),
    borderRadius: 3,
    backgroundColor: COLORS.white,
  },
  bottomArea: {
    paddingHorizontal: SPACING.md,
    gap: s(10),
  },
  transcriptPillWrap: {
    alignSelf: 'center',
    borderRadius: 100,
  },
  transcriptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: s(16),
    height: 48,
    borderRadius: 100,
    backgroundColor: DK.elevated,
  },
  transcriptPillText: {
    fontSize: s(13),
    color: DK.text,
    fontWeight: '600',
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  memoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingLeft: s(18),
    paddingRight: s(8),
    backgroundColor: DK.elevated,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: DK.border,
  },
  memoInput: {
    flex: 1,
    fontSize: s(14),
    color: DK.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    padding: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.fieldnote,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Transcript Preview ---
  previewArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingTop: s(8),
    paddingBottom: s(8),
    maxHeight: s(130),
  },
  previewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmptyText: {
    fontSize: s(13),
    color: DK.textSec,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  previewScroll: {
    flexGrow: 0,
  },
  previewScrollContent: {
    gap: s(6),
  },
  previewItem: {
    gap: s(2),
  },
  previewTimestamp: {
    fontSize: s(11),
    color: DK.textSec,
    fontVariant: ['tabular-nums'],
    letterSpacing: TYPOGRAPHY.letterSpacing,
    paddingLeft: s(4),
  },
  previewBubble: {
    backgroundColor: DK.surface,
    borderRadius: 12,
    paddingHorizontal: s(14),
    paddingVertical: s(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  previewBubbleMemo: {
    backgroundColor: 'rgba(185,139,255,0.16)',
  },
  previewBubbleText: {
    fontSize: s(14),
    color: DK.text,
    lineHeight: s(20),
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  previewBubblePlaceholder: {
    fontStyle: 'italic',
    color: DK.textSec,
  },
  previewBubbleSilent: {
    fontStyle: 'italic',
    color: DK.textSec,
  },
});

/* ─── Inline Transcript Preview ─── */

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s_ = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s_).padStart(2, '0')}`;
}

function TranscriptPreview({
  timeline,
  isRecording,
  isPaused,
}: {
  timeline: RecordingTimelineItem[];
  isRecording: boolean;
  isPaused: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const fadeIn = useSharedValue(0);
  const prevLength = useRef(0);

  const recentItems = timeline.slice(-2);

  useEffect(() => {
    if (timeline.length > 0 && prevLength.current === 0) {
      fadeIn.value = withTiming(1, { duration: 300, easing: REasing.bezier(0, 0, 0.2, 1) });
    }
    prevLength.current = timeline.length;
  }, [timeline.length]);

  useEffect(() => {
    if (timeline.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [timeline.length]);

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  if (recentItems.length === 0) {
    return (
      <View style={styles.previewArea}>
        <View style={styles.previewEmpty}>
          <Text style={styles.previewEmptyText}>
            {isPaused ? '일시정지됐어요' : '잘 듣고 있어요'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <RAnimated.View style={[styles.previewArea, fadeStyle]}>
      <ScrollView
        ref={scrollRef}
        style={styles.previewScroll}
        contentContainerStyle={styles.previewScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {recentItems.map((item, i) => {
          if (item.kind === 'transcript') {
            return (
              <View key={`t-${item.chunkIndex}`} style={styles.previewItem}>
                <Text style={styles.previewTimestamp}>
                  {formatSeconds(item.seconds)}
                </Text>
                <View style={[
                  styles.previewBubble,
                  item.isSilent && { backgroundColor: 'rgba(0,0,0,0.03)' },
                ]}>
                  <Text
                    style={[
                      styles.previewBubbleText,
                      item.isPlaceholder && styles.previewBubblePlaceholder,
                      item.isSilent && styles.previewBubbleSilent,
                    ]}
                    numberOfLines={2}
                  >
                    {item.text}
                  </Text>
                </View>
              </View>
            );
          }
          const entry = item.entry;
          const isMemo = entry.entry_type === 'memo';
          const isTag = entry.entry_type === 'tag';
          const tagColor = isTag
            ? TAG_CATEGORY_COLORS[entry.tag_category as TagCategory] ?? TAG_CATEGORY_COLORS.other
            : null;

          return (
            <View key={`e-${entry.id}`} style={styles.previewItem}>
              <Text style={styles.previewTimestamp}>
                {formatSeconds(item.seconds)}
              </Text>
              <View style={[
                styles.previewBubble,
                isMemo && styles.previewBubbleMemo,
                isTag && tagColor && { backgroundColor: tagColor.bg },
              ]}>
                <Text
                  style={[
                    styles.previewBubbleText,
                    isTag && tagColor && { color: tagColor.text },
                  ]}
                  numberOfLines={2}
                >
                  {isTag
                    ? `#${TAG_CATEGORY_LABELS[entry.tag_category as TagCategory] ?? entry.tag_category} ${entry.content}`
                    : entry.content}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </RAnimated.View>
  );
}
