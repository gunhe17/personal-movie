import React, { useState, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { formatTime, formatDateKo, parseDate } from '@/shared/utils/date';
import { COLORS, TYPOGRAPHY } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { BottomSheet } from '@/shared/components/ui/BottomSheet';
import { s } from '@/shared/utils/scale';
import {
  useScheduleRange,
  SCHEDULE_TYPE_LABELS,
  SCHEDULE_TYPE_COLORS,
  type ScheduleListItem,
} from '@/features/schedule';
import {
  useLinkSchedule,
  useFieldNoteStatuses,
  useLinkTask,
  useLinkableAssessmentTasks,
} from '../hooks';
import type { FieldNoteStatus, LinkableAssessmentTask } from '../types';

// 필드노트 다크 정체성 토큰 (상세/홈과 동일 결)
const FN = COLORS.fieldnoteDark;
const FN_SHEET = FN.bg; // 시트 표면 — 딥 잉크 (카드 FN.card 와 대비)
const FN_HANDLE = 'rgba(255,255,255,0.2)';
const FN_DIM = '#6B6485'; // 비활성/연결됨 텍스트
const FN_SURFACE_2 = 'rgba(255,255,255,0.08)'; // 검색바·뱃지 표면

export interface LinkScheduleSheetProps {
  visible: boolean;
  centerId: string | null;
  fieldNoteId: string | null;
  onSuccess: (scheduleId: string) => void;
  /** 검사 task 연결 성공 — 라우트 아웃 없이(다크 톤 유지) 시트 닫고 토스트. */
  onTaskSuccess?: (taskId: string) => void;
  onClose: () => void;
}

export function LinkScheduleSheet({
  visible,
  centerId,
  fieldNoteId,
  onSuccess,
  onTaskSuccess,
  onClose,
}: LinkScheduleSheetProps) {
  const [searchText, setSearchText] = useState('');

  const today = new Date();
  const startDate = subDays(today, 6);

  const { data: schedules, isLoading } = useScheduleRange(
    centerId,
    startDate,
    today,
  );
  const linkMutation = useLinkSchedule(centerId, fieldNoteId);
  const linkTaskMutation = useLinkTask(centerId, fieldNoteId);
  const { data: linkableTasks, isLoading: tasksLoading } =
    useLinkableAssessmentTasks(centerId);

  const filteredTasks = useMemo(() => {
    const list = linkableTasks ?? [];
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) =>
        t.client_name?.toLowerCase().includes(q) ||
        t.assessment_kor_name?.toLowerCase().includes(q) ||
        t.case_code?.toLowerCase().includes(q),
    );
  }, [linkableTasks, searchText]);

  const handleSelectTask = async (task: LinkableAssessmentTask) => {
    try {
      await linkTaskMutation.mutateAsync(task.task_id);
      if (onTaskSuccess) onTaskSuccess(task.task_id);
      else onClose();
    } catch (error) {
      console.error('Failed to link task:', error);
    }
  };

  const filteredSchedules = useMemo(() => {
    if (!schedules) return [];

    // 검사는 task 단위로 따로 연결(아래 검사 항목 섹션) — 여기 schedule 목록은 상담 회기만.
    let result = schedules.filter((s) => s.schedule_type === 'counseling');

    if (searchText.trim()) {
      const query = searchText.trim().toLowerCase();
      result = result.filter((s) => {
        const clientNames = s.client_names.join(' ').toLowerCase();
        const programName = s.program_name?.toLowerCase() || '';
        const title = s.title?.toLowerCase() || '';
        return (
          clientNames.includes(query) ||
          programName.includes(query) ||
          title.includes(query)
        );
      });
    }

    const startDateTime = startDate.getTime();
    result = result.filter((s) => {
      const scheduleDate = parseDate(s.start).getTime();
      return scheduleDate >= startDateTime;
    });

    result.sort(
      (a, b) => parseDate(b.start).getTime() - parseDate(a.start).getTime(),
    );

    return result;
  }, [schedules, searchText, startDate]);

  const scheduleIds = useMemo(
    () => filteredSchedules.map((s) => s.id),
    [filteredSchedules],
  );
  const { data: fieldNoteStatuses } = useFieldNoteStatuses(
    centerId,
    scheduleIds,
  );
  const linkedScheduleMap = useMemo(() => {
    const map = new Map<string, FieldNoteStatus>();
    if (fieldNoteStatuses) {
      for (const item of fieldNoteStatuses) {
        if (item.schedule_id) map.set(item.schedule_id, item.status);
      }
    }
    return map;
  }, [fieldNoteStatuses]);

  const handleSelectSchedule = async (schedule: ScheduleListItem) => {
    if (linkedScheduleMap.has(schedule.id)) return;
    try {
      await linkMutation.mutateAsync(schedule.id);
      onSuccess(schedule.id);
    } catch (error) {
      console.error('Failed to link schedule:', error);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      fullHeight
      surfaceColor={FN_SHEET}
      handleColor={FN_HANDLE}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons
            name="link-outline"
            size={s(18)}
            color={FN.accent}
          />
          <Typography
            variant="title-01"
            weight="semibold"
            style={{ color: FN.text }}
          >
            회기 연결
          </Typography>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={s(22)} color={FN.sub} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={s(16)} color={FN.sub} />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="내담자명, 프로그램명으로 검색해주세요"
            placeholderTextColor={FN_DIM}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchText('')}
              hitSlop={8}
            >
              <Ionicons
                name="close-circle"
                size={s(16)}
                color={FN.sub}
              />
            </TouchableOpacity>
          )}
        </View>
        <Typography variant="label-02" className="mt-1.5" style={{ color: FN.sub }}>
          최근 7일 일정만 표시돼요
        </Typography>
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isLoading || tasksLoading ? (
          <View style={styles.centerArea}>
            <ActivityIndicator size="large" color={FN.accent} />
          </View>
        ) : filteredSchedules.length === 0 && filteredTasks.length === 0 ? (
          <View style={styles.centerArea}>
            <Ionicons
              name="calendar-outline"
              size={s(40)}
              color={FN_DIM}
            />
            <Typography variant="body-02" className="mt-3" style={{ color: FN.sub }}>
              {searchText.trim()
                ? '검색 결과가 없어요'
                : '최근 7일 상담 일정·진행중 검사가 없어요'}
            </Typography>
          </View>
        ) : (
          <>
          {filteredSchedules.length > 0 && (
            <Typography variant="label-01" weight="semibold" style={styles.sectionHeader}>
              상담 회기
            </Typography>
          )}
          {filteredSchedules.map((schedule) => {
            const isLinked = linkedScheduleMap.has(schedule.id);
            const dateLabel = formatDateKo(schedule.start);
            const accent =
              SCHEDULE_TYPE_COLORS[schedule.schedule_type] ?? COLORS.gray[400];

            return (
              <TouchableOpacity
                key={schedule.id}
                style={[
                  styles.item,
                  isLinked && styles.itemDisabled,
                ]}
                onPress={() => handleSelectSchedule(schedule)}
                disabled={linkMutation.isPending || isLinked}
                activeOpacity={isLinked ? 1 : 0.7}
              >
                <View
                  style={[
                    styles.itemAccent,
                    {
                      backgroundColor: isLinked ? FN_DIM : accent,
                    },
                  ]}
                />
                <View style={styles.itemBody}>
                  <View style={styles.itemTopRow}>
                    <Typography
                      variant="label-01"
                      weight="medium"
                      style={{ color: isLinked ? FN_DIM : FN.sub }}
                    >
                      {dateLabel}
                    </Typography>
                    <Typography
                      variant="label-02"
                      style={{ color: isLinked ? FN_DIM : FN.sub }}
                    >
                      {formatTime(schedule.start)} – {formatTime(schedule.end)}
                    </Typography>
                    {isLinked && (
                      <View style={styles.linkedBadge}>
                        <Ionicons
                          name="mic"
                          size={s(9)}
                          color={FN.sub}
                        />
                        <Typography
                          variant="label-02"
                          weight="medium"
                          style={{ color: FN.sub }}
                        >
                          기록됨
                        </Typography>
                      </View>
                    )}
                  </View>

                  <Typography
                    variant="body-01"
                    weight="semibold"
                    className="mt-1"
                    style={{ color: isLinked ? FN.sub : FN.text }}
                    numberOfLines={1}
                  >
                    {schedule.client_names.join(', ') ||
                      schedule.title ||
                      '(이름 없음)'}
                  </Typography>

                  <View style={styles.itemMetaRow}>
                    <Typography
                      variant="label-02"
                      weight="medium"
                      style={{ color: isLinked ? FN_DIM : accent }}
                    >
                      {SCHEDULE_TYPE_LABELS[schedule.schedule_type]}
                    </Typography>
                    {schedule.program_name && (
                      <>
                        <View style={styles.metaDot} />
                        <Typography
                          variant="label-02"
                          style={{ color: isLinked ? FN_DIM : FN.sub }}
                          numberOfLines={1}
                        >
                          {schedule.program_name}
                        </Typography>
                      </>
                    )}
                    {schedule.room_name && (
                      <>
                        <View style={styles.metaDot} />
                        <Typography
                          variant="label-02"
                          style={{ color: isLinked ? FN_DIM : FN.sub }}
                          numberOfLines={1}
                        >
                          {schedule.room_name}
                        </Typography>
                      </>
                    )}
                  </View>
                </View>

                {!isLinked && (
                  <Ionicons
                    name="chevron-forward"
                    size={s(18)}
                    color={FN.sub}
                  />
                )}
              </TouchableOpacity>
            );
          })}
          {filteredTasks.length > 0 && (
            <Typography variant="label-01" weight="semibold" style={styles.sectionHeader}>
              검사 항목
            </Typography>
          )}
          {filteredTasks.map((task) => (
            <TouchableOpacity
              key={task.task_id}
              style={styles.item}
              onPress={() => handleSelectTask(task)}
              disabled={linkTaskMutation.isPending}
              activeOpacity={0.7}
            >
              <View style={[styles.itemAccent, { backgroundColor: COLORS.assessment }]} />
              <View style={styles.itemBody}>
                <Typography
                  variant="body-01"
                  weight="semibold"
                  style={{ color: FN.text }}
                  numberOfLines={1}
                >
                  {task.client_name || '(이름 없음)'}
                </Typography>
                <View style={styles.itemMetaRow}>
                  <Typography variant="label-02" weight="medium" style={{ color: COLORS.assessment }}>
                    검사
                  </Typography>
                  {task.assessment_kor_name && (
                    <>
                      <View style={styles.metaDot} />
                      <Typography variant="label-02" style={{ color: FN.sub }} numberOfLines={1}>
                        {task.assessment_kor_name}
                      </Typography>
                    </>
                  )}
                  {task.case_code && (
                    <>
                      <View style={styles.metaDot} />
                      <Typography variant="label-02" style={{ color: FN.sub }} numberOfLines={1}>
                        {task.case_code}
                      </Typography>
                    </>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={s(18)} color={FN.sub} />
            </TouchableOpacity>
          ))}
          </>
        )}
      </ScrollView>

      {(linkMutation.isPending || linkTaskMutation.isPending) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={FN.accent} />
          <Typography variant="body-02" weight="medium" style={{ color: COLORS.white }}>
            연결 중...
          </Typography>
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: s(12),
    borderBottomWidth: 1,
    borderBottomColor: FN.line,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
  },
  closeBtn: {
    width: s(36),
    height: s(36),
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingTop: s(12),
    paddingBottom: s(8),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    backgroundColor: FN_SURFACE_2,
    borderRadius: 10,
    paddingHorizontal: s(12),
    height: s(44),
  },
  searchInput: {
    flex: 1,
    fontSize: s(15),
    color: FN.text,
    padding: 0,
    letterSpacing: TYPOGRAPHY.letterSpacing,
    // 텍스트 박스 높이 고정 + 중앙 정렬: 타이핑 시 높이 변화/하단 쏠림 방지
    // (lineHeight 는 미설정 — iOS 하단 쏠림 방지)
    height: s(24),
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  list: {
    flex: 1,
    marginTop: s(4),
  },
  sectionHeader: {
    color: FN.sub,
    marginTop: s(6),
    marginBottom: s(2),
  },
  listContent: {
    paddingTop: s(4),
    paddingBottom: s(16),
    gap: s(10),
  },
  centerArea: {
    alignItems: 'center',
    paddingTop: s(60),
    gap: s(8),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FN.card,
    borderRadius: 16,
    paddingVertical: s(12),
    paddingRight: s(12),
    paddingLeft: 0,
  },
  itemDisabled: {
    opacity: 0.55,
  },
  itemAccent: {
    width: 3,
    alignSelf: 'stretch',
    minHeight: s(50),
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    marginRight: s(12),
  },
  itemBody: {
    flex: 1,
    gap: s(4),
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(8),
    flexWrap: 'wrap',
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
    marginTop: s(2),
  },
  metaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(3),
    backgroundColor: FN_SURFACE_2,
    paddingHorizontal: s(6),
    paddingVertical: s(2),
    borderRadius: 10,
    marginLeft: 'auto',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s(12),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
