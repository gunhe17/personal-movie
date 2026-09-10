import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useCenterStore } from '@/features/center';
import { useUnlinkedFieldNotes, useDeleteFieldNote, type FieldNoteResponse } from '@/features/field-note';
import { useDarkNavBarOnFocus } from '@/features/field-note/useFieldNoteNavBar';
import { FieldNoteListSkeleton } from '@/features/field-note/components/FieldNoteListSkeleton';
import { Segment } from '@/shared/components/ui/Segment';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { parseDate } from '@/shared/utils/date';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// 필드노트 다크 정체성 토큰 — 홈/노트탭과 톤 통일.
const FN = COLORS.fieldnoteDark;

type DateHeader = { type: 'header'; dateKey: string; label: string; count: number };
type FieldNoteRow = { type: 'item'; data: FieldNoteResponse };
type ListRow = DateHeader | FieldNoteRow;

const DATE_GROUPING_THRESHOLD = 2;

type FilterKey = 'all' | 'completed' | 'processing' | 'unanalyzed' | 'failed';

const FILTER_OPTIONS: { value: FilterKey; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'completed', label: '분석완료' },
  { value: 'processing', label: '분석중' },
  { value: 'unanalyzed', label: '녹음만' },
  { value: 'failed', label: '실패' },
];

function getDateKey(iso: string): string {
  try {
    return format(parseDate(iso), 'yyyy-MM-dd');
  } catch {
    return 'unknown';
  }
}

function formatDateHeader(iso: string): string {
  try {
    return format(parseDate(iso), 'M월 d일 (E)', { locale: ko });
  } catch {
    return '날짜 미정';
  }
}

function buildGroupedRows(items: FieldNoteResponse[]): ListRow[] {
  const groups = new Map<string, { label: string; items: FieldNoteResponse[] }>();

  for (const item of items) {
    const key = getDateKey(item.created_at);
    if (!groups.has(key)) {
      groups.set(key, { label: formatDateHeader(item.created_at), items: [] });
    }
    groups.get(key)!.items.push(item);
  }

  const rows: ListRow[] = [];
  for (const [dateKey, group] of groups) {
    rows.push({ type: 'header', dateKey, label: group.label, count: group.items.length });
    for (const data of group.items) {
      rows.push({ type: 'item', data });
    }
  }
  return rows;
}

export default function UnlinkedFieldNoteListScreen() {
  useDarkNavBarOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const centerId = useCenterStore((s) => s.centerId);
  const [filter, setFilter] = useState<FilterKey>('all');
  const filterParam = filter === 'all' ? undefined : { analysis_state: filter };
  const { data: fieldNotes, isLoading, refetch, isRefetching } = useUnlinkedFieldNotes(centerId, filterParam);
  const deleteMutation = useDeleteFieldNote(centerId);
  // 콜드 로딩만 스켈레톤(캐시 재방문 시 isLoading=false). 깜빡임 방지 게이트(§6.2).
  const showSkeleton = useDelayedSkeleton(isLoading);
  // 행별 "최초 등장"만 stagger — 스크롤 재진입 시 반복 재생 방지.
  const seenRowsRef = useRef<Set<string>>(new Set());

  const { rows, isGrouped } = useMemo(() => {
    const items = fieldNotes ?? [];
    if (items.length === 0) return { rows: [] as ListRow[], isGrouped: false };

    const dateCounts = new Map<string, number>();
    for (const item of items) {
      const key = getDateKey(item.created_at);
      dateCounts.set(key, (dateCounts.get(key) ?? 0) + 1);
    }
    const hasMultipleOnSameDay = [...dateCounts.values()].some(
      (c) => c >= DATE_GROUPING_THRESHOLD,
    );

    return {
      rows: hasMultipleOnSameDay
        ? buildGroupedRows(items)
        : items.map((data): FieldNoteRow => ({ type: 'item', data })),
      isGrouped: hasMultipleOnSameDay,
    };
  }, [fieldNotes]);

  const handleDelete = useCallback((fn: FieldNoteResponse) => {
    Alert.alert(
      '필드노트 삭제',
      '이 필드노트를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(fn.id),
        },
      ],
    );
  }, [deleteMutation]);

  const renderFieldNoteCard = useCallback((fn: FieldNoteResponse) => {
    const dur = fn.total_duration ?? 0;
    const mins = Math.floor(dur / 60);
    const secs = Math.floor(dur % 60);
    const durationText = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
    const isRecording = fn.status === 'recording' || fn.status === 'paused';
    const dateText = isGrouped
      ? format(parseDate(fn.created_at), 'HH:mm', { locale: ko })
      : format(parseDate(fn.created_at), 'M/d (EEE) HH:mm', { locale: ko });

    const statusLabel =
      isRecording ? '녹음중'
        : fn.processing_status === 'processing' ? '분석중'
          : fn.processing_status === 'completed' ? '분석완료'
            : fn.processing_status === 'failed' ? '실패'
              : fn.processing_status === 'skipped' ? '저장됨'
                : '대기';

    const statusColor =
      isRecording ? COLORS.error
        : fn.processing_status === 'processing' ? COLORS.warning
          : fn.processing_status === 'completed' ? COLORS.success
            : fn.processing_status === 'failed' ? COLORS.error
              : FN.sub;

    return (
      <TouchableOpacity
        style={st.card}
        onPress={() => router.push(`/(main)/field-note/_quick?fieldNoteId=${fn.id}`)}
        onLongPress={() => handleDelete(fn)}
        delayLongPress={600}
        activeOpacity={0.7}
      >
        <View style={st.cardBody}>
          <View style={st.cardRow1}>
            <View style={st.cardLeft}>
              {isRecording ? (
                <View style={st.recDot} />
              ) : (
                <Ionicons name="mic-outline" size={18} color={FN.sub} />
              )}
              <Text style={st.cardDate}>{dateText}</Text>
            </View>
            <View style={[st.statusBadge, { backgroundColor: statusColor + '15' }]}>
              <Text style={[st.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
          <View style={st.cardRow2}>
            <Text style={st.cardDuration}>
              {isRecording ? '녹음 진행중' : `녹음 시간: ${durationText}`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={st.linkBtn}
          onPress={() => router.push(`/(main)/field-note/link?fieldNoteId=${fn.id}`)}
          activeOpacity={0.7}
        >
          <Ionicons name="link-outline" size={16} color={FN.accent} />
          <Text style={st.linkBtnText}>연결</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [router, handleDelete, isGrouped]);

  const renderRow = useCallback(({ item: row, index }: { item: ListRow; index: number }) => {
    const key = row.type === 'header' ? `header:${row.dateKey}` : row.data.id;
    // 최초 등장만 위에서부터 촤르륵(stagger) — 상단 일부 행만 delay 누적(cap).
    const isFirstAppearance = !seenRowsRef.current.has(key);
    if (isFirstAppearance) seenRowsRef.current.add(key);
    const entering = isFirstAppearance
      ? FadeInDown.duration(320).delay(Math.min(index, 10) * 35)
      : undefined;

    const content =
      row.type === 'header' ? (
        <View style={[st.dateHeader, index > 0 && { paddingTop: 12 }]}>
          <Text style={st.dateHeaderLabel}>{row.label}</Text>
          <Text style={st.dateHeaderCount}>{row.count}건</Text>
        </View>
      ) : (
        renderFieldNoteCard(row.data)
      );

    return <Animated.View entering={entering}>{content}</Animated.View>;
  }, [renderFieldNoteCard]);

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <StatusBar style="light" />
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={24} color={FN.text} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>회기 미지정 필드노트</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={st.filterSection}>
        <Segment<FilterKey>
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          dark
        />
      </View>

      {/* 콜드 로딩은 스켈레톤, delay 창(빠른 로딩)은 빈 화면, 그 외 카운트+리스트(§6.2). */}
      {showSkeleton ? (
        <FieldNoteListSkeleton />
      ) : isLoading ? (
        <View style={{ flex: 1 }} />
      ) : (
        <>
          <View style={st.countSection}>
            <Text style={st.totalCount}>총 {fieldNotes?.length ?? 0}개</Text>
          </View>

          <FlatList<ListRow>
            data={rows}
            keyExtractor={(row) => row.type === 'header' ? `header:${row.dateKey}` : row.data.id}
            renderItem={renderRow}
            contentContainerStyle={st.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={FN.accent} />
            }
            ListEmptyComponent={
              // 로딩은 위 스켈레톤이 담당 — 여기는 '진짜 빈 목록'만.
              <View style={st.emptyWrap}>
                <Ionicons name="checkmark-circle-outline" size={48} color={FN.sub} />
                <Text style={st.emptyText}>회기 미지정 필드노트가 없어요</Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      )}

      {/* 하단 페이드 — 안드로이드 시스템 바와 겹치는 영역으로 새어 보이는 리스트 행이
          다크 배경(FN.bg)으로 자연스럽게 흐려지도록. 내담자 탭·필드노트 홈과 동일 패턴. */}
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', FN.bg]}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: insets.bottom + s(64),
        }}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FN.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: FN.bg,
    borderBottomWidth: 1,
    borderBottomColor: FN.line,
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
    color: FN.text,
    letterSpacing: TYPOGRAPHY.letterSpacing,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FN.card,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 10,
  },
  cardBody: {
    flex: 1,
    gap: 6,
  },
  cardRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '600',
    color: FN.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardRow2: {
    paddingLeft: 26,
  },
  cardDuration: {
    fontSize: 13,
    color: FN.sub,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(185,139,255,0.16)',
    marginLeft: 10,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: FN.accent,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 64,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: FN.sub,
  },
  filterSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: 16,
    paddingBottom: 8,
  },
  countSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 8,
    paddingTop: 4,
  },
  totalCount: {
    fontSize: 13,
    fontWeight: '400',
    color: FN.sub,
    letterSpacing: -0.41,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    gap: 6,
  },
  dateHeaderLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: FN.text,
    letterSpacing: -0.41,
  },
  dateHeaderCount: {
    fontSize: 12,
    fontWeight: '400',
    color: FN.sub,
    letterSpacing: -0.41,
  },
});
