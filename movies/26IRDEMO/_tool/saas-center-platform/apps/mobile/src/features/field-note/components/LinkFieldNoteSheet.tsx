import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { Typography } from '@/shared/components/ui/Typography';
import { COLORS } from '@/shared/constants/theme';
import { parseDate } from '@/shared/utils/date';
import { useUnlinkedFieldNotes } from '../hooks';
import { linkSchedule } from '../api';
import { formatSeconds } from '../utils';
import type { FieldNoteResponse } from '../types';

// 필드노트 다크 정체성 토큰 (상세/홈과 동일 결)
const FN = COLORS.fieldnoteDark;
const FN_SHEET = FN.bg; // 시트 표면 — 딥 잉크(카드 FN.card 보다 어두워 row 와 대비)
const FN_HANDLE = 'rgba(255,255,255,0.2)';
const FN_BRAND = COLORS.fieldnote; // 연결 버튼 (보라 브랜드)
const FN_BTN_DISABLED = 'rgba(255,255,255,0.08)';

interface LinkFieldNoteSheetProps {
  visible: boolean;
  centerId: string | null;
  scheduleId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function LinkFieldNoteSheet({
  visible,
  centerId,
  scheduleId,
  onSuccess,
  onClose,
}: LinkFieldNoteSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: notes, isLoading } = useUnlinkedFieldNotes(
    visible ? centerId : null,
  );
  const queryClient = useQueryClient();

  // 시트 닫힐 때 선택 상태 초기화
  useEffect(() => {
    if (!visible) {
      setSelectedId(null);
      setIsSubmitting(false);
    }
  }, [visible]);

  // 최신순 정렬
  const items = useMemo(() => {
    if (!notes) return [];
    return [...notes].sort(
      (a, b) => parseDate(b.created_at).getTime() - parseDate(a.created_at).getTime(),
    );
  }, [notes]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleConfirm = async () => {
    if (!selectedId || !centerId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await linkSchedule(centerId, selectedId, scheduleId);
      queryClient.invalidateQueries({
        queryKey: ['fieldNote'],
        exact: false,
      });
      onSuccess();
      onClose();
    } catch {
      Alert.alert('오류', '필드노트 연결 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canConfirm = !!selectedId && !isSubmitting;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      fullHeight
      surfaceColor={FN_SHEET}
      handleColor={FN_HANDLE}
    >
      {/* 헤더 */}
      <View className="mb-4 flex-row items-center justify-center">
        <Typography variant="title-01" weight="semibold" style={{ color: FN.text }}>
          필드노트 연결
        </Typography>
      </View>

      {/* 카운트 */}
      <Typography variant="label-01" weight="medium" className="mb-2" style={{ color: FN.sub }}>
        총 {items.length}개
      </Typography>

      {/* 리스트 영역 */}
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color={FN.accent} />
          </View>
        ) : items.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Typography variant="body-03" style={{ color: FN.sub }}>
              회기 미지정 필드노트가 없어요.
            </Typography>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 8, gap: 8 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <FieldNoteRow
                note={item}
                selected={selectedId === item.id}
                onSelect={handleSelect}
              />
            )}
          />
        )}
      </View>

      {/* 푸터 버튼 */}
      <TouchableOpacity
        onPress={handleConfirm}
        disabled={!canConfirm}
        activeOpacity={0.85}
        className="mt-4 items-center justify-center rounded-md py-3.5"
        style={{ backgroundColor: canConfirm ? FN_BRAND : FN_BTN_DISABLED }}
        accessibilityLabel="연결하기"
        accessibilityRole="button"
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Typography
            variant="body-02"
            weight="semibold"
            style={{ color: canConfirm ? COLORS.white : FN.sub }}
          >
            연결하기
          </Typography>
        )}
      </TouchableOpacity>
    </BottomSheet>
  );
}

const FieldNoteRow = memo(function FieldNoteRow({
  note,
  selected,
  onSelect,
}: {
  note: FieldNoteResponse;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const dateStr = useMemo(() => {
    try {
      return format(parseDate(note.created_at), 'yyyy. MM. dd EEE HH:mm', {
        locale: ko,
      });
    } catch {
      return note.created_at;
    }
  }, [note.created_at]);
  const durationLabel = formatSeconds(note.total_duration);
  const body =
    note.summary ??
    note.refined_transcript ??
    (note.processing_status === 'processing' ? '처리 중...' : '녹음 완료');

  // 선택 상태에 따라 부드럽게 색·체크 트랜지션 (190ms).
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, { duration: 190 });
  }, [selected, progress]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [FN.card, 'rgba(185,139,255,0.16)'],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(185,139,255,0)', FN.accent],
    ),
  }));
  const checkAnimStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.6 + 0.4 * progress.value }],
  }));

  const handlePress = useCallback(
    () => onSelect(note.id),
    [onSelect, note.id],
  );

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`필드노트 ${dateStr}, ${selected ? '선택됨' : '선택하기'}`}
    >
      <Animated.View
        style={[
          {
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderWidth: 1,
          },
          cardAnimStyle,
        ]}
      >
        <View className="flex-row items-start">
          <View className="flex-1 pr-3">
            <Typography variant="label-01" style={{ color: FN.sub }}>
              {dateStr}
            </Typography>
            <Typography
              variant="body-02"
              weight="semibold"
              className="mt-0.5"
              style={{ color: FN.text }}
            >
              필드노트 · {durationLabel}
            </Typography>
            <Typography
              variant="body-03"
              className="mt-1"
              style={{ color: FN.sub }}
              numberOfLines={1}
            >
              {body}
            </Typography>
          </View>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.2)',
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: -1.5,
                  right: -1.5,
                  top: -1.5,
                  bottom: -1.5,
                  borderRadius: 12,
                  backgroundColor: FN.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                checkAnimStyle,
              ]}
            >
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});
