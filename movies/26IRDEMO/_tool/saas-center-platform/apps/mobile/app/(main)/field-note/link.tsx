import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCenterStore } from '@/features/center';
import {
  useScheduleList,
  SCHEDULE_TYPE_LABELS,
  SCHEDULE_TYPE_COLORS,
  type ScheduleListItem,
} from '@/features/schedule';
import { useLinkSchedule, useFieldNoteStatuses, type FieldNoteStatus } from '@/features/field-note';
import { useDarkNavBarOnFocus } from '@/features/field-note/useFieldNoteNavBar';
import { COLORS, TYPOGRAPHY, RADIUS, SPACING } from '@/shared/constants/theme';
import { formatTime as formatTimeKst } from '@/shared/utils/date';
import { format, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';

// 필드노트 다크 정체성 토큰 — 목록/홈/상세와 동일 결.
const FN = COLORS.fieldnoteDark;

export default function LinkScheduleScreen() {
  useDarkNavBarOnFocus();
  const { fieldNoteId } = useLocalSearchParams<{ fieldNoteId: string }>();
  const router = useRouter();
  const centerId = useCenterStore((s) => s.centerId);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data: schedules, isLoading } = useScheduleList(centerId, selectedDate);
  const linkMutation = useLinkSchedule(centerId, fieldNoteId ?? null);

  // 상담/검사만 표시 (meeting, block 제외)
  const filteredSchedules = useMemo(
    () => (schedules ?? []).filter((s) => s.schedule_type === 'counseling' || s.schedule_type === 'assessment'),
    [schedules],
  );

  // 이미 필드노트가 연결된 일정 조회
  const scheduleIds = useMemo(
    () => filteredSchedules.map((s) => s.id),
    [filteredSchedules],
  );
  const { data: fieldNoteStatuses } = useFieldNoteStatuses(centerId, scheduleIds);
  const linkedScheduleMap = useMemo(() => {
    const map = new Map<string, FieldNoteStatus>();
    if (fieldNoteStatuses) {
      for (const item of fieldNoteStatuses) {
        if (item.schedule_id) map.set(item.schedule_id, item.status);
      }
    }
    return map;
  }, [fieldNoteStatuses]);

  const handleSelectSchedule = useCallback(
    (schedule: ScheduleListItem) => {
      Alert.alert(
        '회기 연결',
        `이 일정에 필드노트를 연결하시겠습니까?\n\n${formatScheduleInfo(schedule)}`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '연결',
            onPress: async () => {
              try {
                await linkMutation.mutateAsync(schedule.id);
                Alert.alert('완료', '회기가 연결되었습니다.', [
                  { text: '확인', onPress: () => router.back() },
                ]);
              } catch {
                Alert.alert('오류', '회기 연결에 실패했습니다. 이미 필드노트가 있는 일정일 수 있습니다.');
              }
            },
          },
        ],
      );
    },
    [linkMutation, router],
  );

  // 7일 date strip
  const dateStrip = useMemo(() => {
    const dates: Date[] = [];
    for (let i = -3; i <= 3; i++) {
      dates.push(i >= 0 ? addDays(selectedDate, i) : subDays(selectedDate, -i));
    }
    return dates;
  }, [selectedDate]);

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <StatusBar style="light" />
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={24} color={FN.text} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>회기 연결</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={st.description}>
        녹음을 연결할 회기를 선택해주세요
      </Text>

      {/* Date strip */}
      <View style={st.dateStripWrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.dateStrip}
      >
        {dateStrip.map((date) => {
          const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          return (
            <TouchableOpacity
              key={date.toISOString()}
              style={[st.dateItem, isSelected && st.dateItemSelected]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[st.dateDow, isSelected && st.dateTextSelected]}>
                {format(date, 'EEE', { locale: ko })}
              </Text>
              <Text style={[st.dateDay, isSelected && st.dateTextSelected, isToday && !isSelected && st.dateToday]}>
                {format(date, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </View>

      {/* Schedule list */}
      <ScrollView style={st.list} contentContainerStyle={st.listContent}>
        {isLoading ? (
          <ActivityIndicator size="large" color={FN.accent} style={{ marginTop: 40 }} />
        ) : filteredSchedules.length === 0 ? (
          <View style={st.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={FN.sub} />
            <Text style={st.emptyText}>해당 날짜에 상담/검사 일정이 없습니다</Text>
          </View>
        ) : (
          filteredSchedules.map((schedule) => {
            const isLinked = linkedScheduleMap.has(schedule.id);
            return (
              <TouchableOpacity
                key={schedule.id}
                style={[st.scheduleItem, isLinked && st.scheduleItemLinked]}
                onPress={() => handleSelectSchedule(schedule)}
                disabled={linkMutation.isPending || isLinked}
                activeOpacity={isLinked ? 1 : 0.7}
              >
                <View style={[st.scheduleIndicator, { backgroundColor: isLinked ? FN.sub : SCHEDULE_TYPE_COLORS[schedule.schedule_type] }]} />
                <View style={st.scheduleInfo}>
                  <View style={st.scheduleRow}>
                    <Text style={[st.scheduleType, isLinked && { color: FN.sub }]}>
                      {SCHEDULE_TYPE_LABELS[schedule.schedule_type]}
                    </Text>
                    <Text style={st.scheduleTime}>
                      {formatTime(schedule.start)} - {formatTime(schedule.end)}
                    </Text>
                    {isLinked && (
                      <View style={st.linkedBadge}>
                        <Ionicons name="mic" size={10} color={FN.sub} />
                        <Text style={st.linkedBadgeText}>기록됨</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[st.scheduleClients, isLinked && { color: FN.sub }]} numberOfLines={1}>
                    {schedule.client_names.join(', ') || schedule.title || '(이름 없음)'}
                  </Text>
                  {schedule.program_name && (
                    <Text style={[st.scheduleProgram, isLinked && { color: FN.sub }]} numberOfLines={1}>
                      {schedule.program_name}
                    </Text>
                  )}
                  {schedule.room_name && (
                    <Text style={st.scheduleMeta}>
                      {schedule.room_name}
                      {schedule.counselor_name ? ` · ${schedule.counselor_name}` : ''}
                    </Text>
                  )}
                </View>
                {!isLinked && <Ionicons name="chevron-forward" size={18} color={FN.sub} />}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {linkMutation.isPending && (
        <View style={st.overlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={st.overlayText}>연결 중...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// 백엔드 UTC-naive 문자열을 KST로 해석하기 위해 shared util 사용
const formatTime = (iso: string) => formatTimeKst(iso)

function formatScheduleInfo(schedule: ScheduleListItem): string {
  const type = SCHEDULE_TYPE_LABELS[schedule.schedule_type];
  const clients = schedule.client_names.join(', ') || schedule.title || '';
  const time = `${formatTime(schedule.start)} - ${formatTime(schedule.end)}`;
  return [type, clients, time].filter(Boolean).join(' · ');
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
  description: {
    fontSize: 14,
    color: FN.sub,
    paddingHorizontal: SPACING.md,
    paddingTop: 16,
    paddingBottom: 12,
  },

  // Date strip
  dateStripWrapper: {
    flexShrink: 0,
  },
  dateStrip: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  dateItem: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: FN.card,
    borderWidth: 1,
    borderColor: FN.line,
    minWidth: 52,
  },
  dateItemSelected: {
    backgroundColor: COLORS.fieldnote,
    borderColor: COLORS.fieldnote,
  },
  dateDow: {
    fontSize: 12,
    color: FN.sub,
    marginBottom: 2,
  },
  dateDay: {
    fontSize: 16,
    fontWeight: '600',
    color: FN.text,
  },
  dateTextSelected: {
    color: COLORS.white,
  },
  dateToday: {
    color: FN.accent,
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 24,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FN.card,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 8,
  },
  scheduleIndicator: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  scheduleInfo: {
    flex: 1,
    gap: 2,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleType: {
    fontSize: 12,
    fontWeight: '600',
    color: FN.accent,
  },
  scheduleTime: {
    fontSize: 12,
    color: FN.sub,
    fontVariant: ['tabular-nums'],
  },
  scheduleClients: {
    fontSize: 15,
    fontWeight: '500',
    color: FN.text,
  },
  scheduleProgram: {
    fontSize: 13,
    color: FN.sub,
  },
  scheduleMeta: {
    fontSize: 12,
    color: FN.sub,
  },
  scheduleItemLinked: {
    opacity: 0.55,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginLeft: 'auto',
  },
  linkedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: FN.sub,
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: FN.sub,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
  },
});
