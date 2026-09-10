import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Animated as RNAnimated,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useCenterStore } from '@/features/center';
import { GENDER_LABELS } from '@/features/client';
import {
  useInfiniteMyNotes,
  CounselingNoteSheet,
  type MyCounselingNoteItem,
  type NoteSheetParticipant,
} from '@/features/counseling/note';
import {
  useFieldNote,
  useCounselingNoteGenerationComplete,
} from '@/features/field-note';
import { useToastStore } from '@/features/toast';
import { COLORS } from '@/shared/constants/theme';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { SearchField } from '@/shared/components/ui/SearchField';
import { Icon } from '@/shared/components/icons';
import { useDelayedSkeleton } from '@/shared/components/ui/Skeleton';
import { NotesListSkeleton } from './_components/NotesListSkeleton';
import { parseDate } from '@/shared/utils/date';
import { s } from '@/shared/utils/scale';
import NoteRecommend from '@assets/NoteRecommend.svg';

type FilterKey = 'all' | 'written' | 'missing';

/** 회기 시간 범위 — "14:00 - 15:00" (end가 없으면 start만 "14:00") */
function formatSessionTimeRange(
  startIso: string | null,
  endIso: string | null,
): string | null {
  if (!startIso) return null;
  try {
    const start = format(parseDate(startIso), 'HH:mm');
    if (!endIso) return start;
    const end = format(parseDate(endIso), 'HH:mm');
    return `${start} - ${end}`;
  } catch {
    return null;
  }
}

/** 회기 그룹 헤더용 — 홈 미작성 일지와 동일 형식 "5월 15일 (목)" */
function formatGroupDate(iso: string | null): string {
  if (!iso) return '날짜 미정';
  try {
    return format(parseDate(iso), 'M월 d일 (E)', { locale: ko });
  } catch {
    return '날짜 미정';
  }
}

/** 날짜 헤더 비교용 — 같은 날 묶음 키 (yyyy-MM-dd) */
function dateKey(iso: string | null): string {
  if (!iso) return 'none';
  try {
    return format(parseDate(iso), 'yyyy-MM-dd');
  } catch {
    return 'none';
  }
}

/** 같은 회기(counseling_session_id) 의 일지 묶음 */
interface SessionGroup {
  sessionId: string;
  sessionStart: string | null;
  sessionEnd: string | null;
  programName: string | null;
  roomName: string | null;
  scheduleId: string | null;
  notes: MyCounselingNoteItem[];
}

interface SheetTarget {
  sessionId: string;
  clientId: string;
  clientName?: string;
  sessionStart?: string;
  scheduleId?: string;
  participants?: NoteSheetParticipant[];
}

export default function CounselingNotesScreen() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: string }>();
  const centerId = useCenterStore((s) => s.centerId);
  // 진입 파라미터로 초기 탭 결정 (예: 홈 '미작성 일지' 시그널 → 미작성 탭). 이후 사용자 전환 가능.
  const [filter, setFilter] = useState<FilterKey>(
    status === 'missing' || status === 'written' ? status : 'all',
  );
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);

  // C: 필드노트로 상담일지 자동 생성 — 진행 중인 필드노트를 폴링하다 완료 시 목록 갱신
  const [genFieldNoteId, setGenFieldNoteId] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.show);
  const genFieldNote = useFieldNote(centerId, genFieldNoteId);
  useCounselingNoteGenerationComplete(genFieldNote.data?.note_status, {
    onComplete: () => {
      showToast({ type: 'success', message: '상담일지 초안을 만들었어요' });
      setGenFieldNoteId(null);
    },
    onFailed: () => {
      showToast({
        type: 'error',
        message: '상담일지 생성에 실패했어요. 다시 시도해 주세요',
      });
      setGenFieldNoteId(null);
    },
  });

  // status·내담자명 모두 서버 측 처리 (내담자 목록과 동일 무한스크롤 패턴)
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMyNotes(centerId, { status: filter, keyword: debouncedSearch });
  const showSkeleton = useDelayedSkeleton(isLoading);

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );
  // 필터 칩 카운트 — 키워드/활성탭과 무관한 고정 총계. 각 status별 별도 조회.
  // (활성 필터 + 검색 없음일 때는 위 메인 쿼리와 queryKey가 같아 자동 dedupe됨)
  const allCountQuery = useInfiniteMyNotes(centerId, { status: 'all' });
  const writtenCountQuery = useInfiniteMyNotes(centerId, { status: 'written' });
  const missingQuery = useInfiniteMyNotes(centerId, { status: 'missing' });
  const allTotal = allCountQuery.data?.pages[0]?.total ?? 0;
  const writtenTotal = writtenCountQuery.data?.pages[0]?.total ?? 0;
  const missingTotal = missingQuery.data?.pages[0]?.total ?? 0;
  // Hero 노출: '전체' 탭 + 검색 중 아님 + 미작성이 있을 때. 탭하면 '미작성'으로 모아 보기.
  const showHero = filter === 'all' && !debouncedSearch && missingTotal > 0;

  /**
   * 같은 회기(=counseling_session_id) 의 일지를 한 카드로 묶기.
   *  - 페이지 로드 순서 보존 (서버측 정렬 그대로)
   *  - 그룹 등장 순서는 첫 항목 등장 순으로
   */
  const sessionGroups = useMemo<SessionGroup[]>(() => {
    const map = new Map<string, SessionGroup>();
    const order: string[] = [];
    for (const it of items) {
      let g = map.get(it.counseling_session_id);
      if (!g) {
        g = {
          sessionId: it.counseling_session_id,
          sessionStart: it.session_start,
          sessionEnd: it.session_end ?? null,
          programName: it.program_name,
          roomName: it.room_name ?? null,
          scheduleId: it.schedule_id,
          notes: [],
        };
        map.set(it.counseling_session_id, g);
        order.push(it.counseling_session_id);
      }
      g.notes.push(it);
    }
    return order.map((id) => map.get(id)!);
  }, [items]);

  const onChangeSearch = useCallback((text: string) => {
    setSearchInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text.trim()), 300);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDebouncedSearch('');
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openSheet = useCallback(
    (item: MyCounselingNoteItem, groupNotes: MyCounselingNoteItem[]) => {
      setSheetTarget({
        sessionId: item.counseling_session_id,
        clientId: item.client_id,
        clientName: item.client_name ?? undefined,
        sessionStart: item.session_start ?? undefined,
        scheduleId: item.schedule_id ?? undefined,
        // 같은 회기 참여 내담자 전체 — 그룹이면 시트 상단 칩으로 전환
        participants: groupNotes.map((n) => ({
          clientId: n.client_id,
          clientName: n.client_name,
          isWritten: n.is_written,
        })),
      });
      setSheetVisible(true);
    },
    [],
  );

  const renderGroup = useCallback(
    ({ item, index }: { item: SessionGroup; index: number }) => {
      const prev = index > 0 ? sessionGroups[index - 1] : null;
      const showDateHeader =
        !prev || dateKey(prev.sessionStart) !== dateKey(item.sessionStart);

      // 헤더 탭 → 회기 상세로 직접 이동.
      // schedule/[id]는 리다이렉트 전용 화면(마운트 후 replace)이라 거치면 전환이
      // 2번 일어난다. 목록이 이미 counseling_session_id를 갖고 있으므로 회기 상세로 바로 push.
      const goDetail = item.sessionId
        ? () =>
            router.push({
              pathname: '/(main)/counseling/session/[id]',
              params: {
                id: item.sessionId,
                ...(item.scheduleId ? { scheduleId: item.scheduleId } : {}),
              },
            })
        : undefined;

      const timeRange = formatSessionTimeRange(item.sessionStart, item.sessionEnd);

      return (
        // 간격(marginBottom)은 일반 View가 소유 — reanimated entering이 걸린 뷰에
        // margin을 직접 주면 enter 애니메이션 처리 중 레이아웃에서 소실되어
        // 카드 간 갭이 사라지는 문제가 있어 분리한다.
        <View style={{ marginBottom: s(16) }}>
        <Animated.View
          entering={FadeIn.delay(Math.min(index, 8) * 40).duration(260)}
        >
          {showDateHeader && (
            <View style={{ marginBottom: s(12), paddingHorizontal: s(4) }}>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.gray[600] }}
              >
                {formatGroupDate(item.sessionStart)}
              </Typography>
            </View>
          )}

          {/* 회기 카드 — 흰 카드(페이지 배경 대비로 분리, 보더 없음) */}
          <View
            style={{
              backgroundColor: COLORS.white,
              borderRadius: s(16),
              paddingVertical: s(16),
              paddingHorizontal: s(16),
            }}
          >
            {/* 헤더 — 탭하면 회기 상세로. 좌측에 시간+프로그램 세로 스택,
                우측 chevron은 그 블록 기준 세로 중앙(items-center) */}
            <Pressable
              onPress={goDetail}
              disabled={!goDetail}
              accessibilityRole={goDetail ? 'button' : undefined}
              accessibilityLabel={goDetail ? '회기 상세 보기' : undefined}
              style={({ pressed }) => ({ opacity: pressed && goDetail ? 0.6 : 1 })}
            >
              <View className="flex-row items-center" style={{ gap: s(6) }}>
                <View style={{ flex: 1 }}>
                  {timeRange && (
                    <Typography variant="body-01" weight="semibold" className="text-gray-900">
                      {timeRange}
                    </Typography>
                  )}
                  {(item.programName || item.roomName) && (
                    <View
                      className="flex-row items-center"
                      style={{ marginTop: s(3), gap: s(6) }}
                    >
                      {item.programName && (
                        <Typography
                          variant="body-03"
                          weight="regular"
                          style={{ color: COLORS.gray[500] }}
                          numberOfLines={1}
                        >
                          {item.programName}
                        </Typography>
                      )}
                      {item.programName && item.roomName && (
                        <View
                          style={{ width: 1, height: s(10), backgroundColor: COLORS.gray[300] }}
                        />
                      )}
                      {item.roomName && (
                        <Typography
                          variant="body-03"
                          weight="regular"
                          style={{ color: COLORS.gray[500] }}
                          numberOfLines={1}
                        >
                          {item.roomName}
                        </Typography>
                      )}
                    </View>
                  )}
                </View>
                {goDetail && (
                  <Icon name="arrow-right-20" size={s(20)} color={COLORS.gray[400]} />
                )}
              </View>
            </Pressable>

            {/* divider — 위 정보(시간·프로그램) ↔ 내담자 목록 사이, 위아래 16px */}
            <View
              style={{
                height: 1,
                backgroundColor: COLORS.gray[100],
                marginTop: 16,
                marginBottom: 16,
              }}
            />

            {/* 내담자 row stack */}
            {item.notes.map((note) => (
              <NoteRow
                key={`${note.counseling_session_id}:${note.client_id}`}
                note={note}
                onPress={() => openSheet(note, item.notes)}
              />
            ))}
          </View>
        </Animated.View>
        </View>
      );
    },
    [openSheet, sessionGroups, router],
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      {/* 헤더 */}
      <View className="h-[52px] flex-row items-center gap-1.5 bg-surface px-5">
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </TouchableOpacity>
        <Typography variant="headline-02" weight="bold" className="text-gray-900">
          상담일지
        </Typography>
      </View>

      {/* 검색바 */}
      <View
        style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(20) }}
      >
        <SearchField
          value={searchInput}
          onChangeText={onChangeSearch}
          onClear={clearSearch}
          placeholder="내담자 이름으로 검색해주세요"
          height={44}
          blurOnSubmit={false}
        />
      </View>

      {/* 회색 영역: 필터 + 카운트 + 리스트 */}
      <View className="flex-1 bg-background">
        <View
          className="flex-row"
          style={{ paddingHorizontal: s(20), paddingTop: s(16), paddingBottom: s(8), gap: s(8) }}
        >
          {(
            [
              { key: 'all', label: '전체', count: allTotal },
              { key: 'written', label: '작성', count: writtenTotal },
              { key: 'missing', label: '미작성', count: missingTotal },
            ] as { key: FilterKey; label: string; count: number }[]
          ).map((tab) => {
            const isActive = filter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.7}
                accessibilityLabel={`${tab.label} 필터`}
                accessibilityRole="button"
                className="flex-row items-center gap-1 rounded-full"
                style={{
                  height: s(32),
                  paddingHorizontal: s(12),
                  backgroundColor: isActive ? COLORS.gray[700] : 'transparent',
                  borderWidth: 1,
                  borderColor: isActive ? COLORS.gray[700] : COLORS.gray[300],
                }}
              >
                <Typography
                  variant="body-03"
                  weight="medium"
                  style={{ color: isActive ? '#FFFFFF' : COLORS.gray[600] }}
                >
                  {tab.label}
                </Typography>
                <Typography
                  variant="label-02"
                  weight="regular"
                  style={{ color: isActive ? '#FFFFFF' : COLORS.gray[600] }}
                >
                  {tab.count}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        {showSkeleton ? (
          <NotesListSkeleton />
        ) : isLoading ? (
          <View className="flex-1" />
        ) : isError ? (
          <View className="flex-1 items-center justify-center gap-2 py-16">
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.gray[300]} />
            <Typography variant="body-03" className="text-gray-400">
              일지를 불러오지 못했어요
            </Typography>
            <TouchableOpacity
              onPress={() => refetch()}
              activeOpacity={0.7}
              accessibilityLabel="다시 시도"
              accessibilityRole="button"
              className="mt-2 rounded-md bg-primary px-5 py-2"
            >
              <Typography variant="body-03" weight="semibold" className="text-white">
                다시 시도
              </Typography>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={sessionGroups}
            keyExtractor={(g) => g.sessionId}
            renderItem={renderGroup}
            contentContainerStyle={{
              paddingHorizontal: s(20),
              paddingTop: s(4),
              paddingBottom: s(40),
            }}
            ListHeaderComponent={
              showHero ? (
                <MissingHero
                  count={missingTotal}
                  onPress={() => setFilter('missing')}
                />
              ) : null
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={1.5}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={COLORS.primary}
              />
            }
            ListFooterComponent={
              isFetchingNextPage ? (
                <View style={{ paddingVertical: s(20) }}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View
                style={{ paddingVertical: s(48), gap: s(8) }}
                className="items-center"
              >
                <Ionicons
                  name={debouncedSearch ? 'search-outline' : 'document-text-outline'}
                  size={s(40)}
                  color={COLORS.gray[300]}
                />
                <Typography variant="body-02" weight="semibold" className="text-gray-600">
                  {debouncedSearch
                    ? '검색 결과가 없어요'
                    : filter === 'missing'
                      ? '미작성 일지가 없어요'
                      : filter === 'written'
                        ? '작성한 일지가 없어요'
                        : '작성된 일지가 없어요'}
                </Typography>
                {!debouncedSearch && filter !== 'missing' && (
                  <Typography variant="body-03" className="text-gray-400">
                    상담 후 일지를 기록해 두면 다음 상담에 도움이 돼요
                  </Typography>
                )}
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <CounselingNoteSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        centerId={centerId}
        sessionId={sheetTarget?.sessionId ?? null}
        clientId={sheetTarget?.clientId ?? null}
        clientName={sheetTarget?.clientName}
        sessionStart={sheetTarget?.sessionStart}
        scheduleId={sheetTarget?.scheduleId ?? null}
        onGenerateStarted={setGenFieldNoteId}
        participants={sheetTarget?.participants}
      />
    </SafeAreaView>
  );
}

/**
 * 회기 카드 안의 내담자별 일지 row.
 *
 * 레이아웃: [상태칩] 이름 · 성별/나이 ........ 액션 텍스트(작성하기/보기)
 *  - 작성 완료: green `작성` 칩 + 우측 회색 `보기`
 *  - 미작성:    gray `미작성` 칩 + 우측 primary `작성하기`
 *
 * row 전체 탭 → CounselingNoteSheet 진입 (작성·보기 자동 분기).
 */
function NoteRow({
  note,
  onPress,
}: {
  note: MyCounselingNoteItem;
  onPress: () => void;
}) {
  const isWritten = note.is_written;
  const name = note.client_name ?? '내담자';
  const genderLabel = note.client_gender
    ? GENDER_LABELS[note.client_gender] ?? note.client_gender
    : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} 상담일지 ${isWritten ? '보기' : '작성'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
        {/* 간격(paddingVertical)은 일반 View가 소유 — 실기기에서 Pressable 함수형
            style이 반영 안 되는 케이스가 있어 여기서 제어한다.
            행간 = 위아래 6 → 정확히 12px (스케일 없이 고정) */}
        <View className="flex-row items-center" style={{ gap: s(8), paddingVertical: 6 }}>
          <StatusChip isWritten={isWritten} />
          <Typography
            variant="body-02"
            weight="semibold"
            className="text-gray-900"
            numberOfLines={1}
          >
            {name}
          </Typography>
          {/* 메타: 성별 ㅣ 나이 — 공용 GenderAgeMeta */}
          <GenderAgeMeta genderLabel={genderLabel} age={note.client_age} />
          <View style={{ flex: 1 }} />
          <Typography
            variant="label-01"
            weight="medium"
            style={{ color: isWritten ? COLORS.gray[500] : '#4486FF' }}
          >
            {isWritten ? '보기' : '작성하기'}
          </Typography>
        </View>
    </Pressable>
  );
}

/* ─── 작성/미작성 상태 칩 — 최소너비 43 · 높이 22 · radius 4 ─── */
function StatusChip({ isWritten }: { isWritten: boolean }) {
  return (
    <View
      style={{
        minWidth: 43,
        height: 22,
        borderRadius: 4,
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isWritten ? '#00BF4014' : COLORS.gray[100],
      }}
    >
      <Typography
        variant="label-02"
        weight="semibold"
        style={{ color: isWritten ? '#0A9D44' : COLORS.gray[500] }}
      >
        {isWritten ? '작성' : '미작성'}
      </Typography>
    </View>
  );
}

/* ─── 미작성 안내 배너 ───
 * 부드러운 블루 그라데이션 카드 + 우측 노트 일러스트 + spring drop-in.
 * 탭하면 '미작성' 필터로 모아 보기. (친근·재미 톤)
 * 색은 디자인 시스템 primary(블루) 톤 — 카테고리색이 아닌 안내 강조용 배너.
 */
function MissingHero({ count, onPress }: { count: number; onPress: () => void }) {
  const translateY = useRef(new RNAnimated.Value(-16)).current;
  const opacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(translateY, {
        toValue: 0,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      RNAnimated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start();
  }, [translateY, opacity]);

  return (
    <RNAnimated.View style={{ transform: [{ translateY }], opacity, marginBottom: s(16) }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`작성이 필요한 상담일지 ${count}건 모아 보기`}
        style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      >
        {/* 시각 스타일은 일반 View가 소유 — 회기 카드와 동일 패턴(실기기에서 Pressable
            함수형 style이 적용 안 되는 케이스 회피).
            카드 높이 76px 고정. 일러스트(NoteRecommend.svg, 투명 배경)는 98×66,
            상단 10px·우측 16px 배치 → 10+66=76 으로 카드에 정확히 맞음. */}
        <View
          style={{
            borderRadius: s(16),
            backgroundColor: '#C8E8FF',
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: s(20),
            height: s(76),
            overflow: 'hidden',
          }}
        >
          <View style={{ flex: 1, paddingVertical: s(14) }}>
            <Typography variant="title-01" weight="semibold" style={{ color: '#0D86FF' }}>
              기억이 생생할 때 기록해보세요
            </Typography>
            <Typography
              variant="body-02"
              weight="regular"
              style={{ color: COLORS.gray[600], marginTop: s(2) }}
            >
              작성이 필요한 상담일지가 {count}건 있어요
            </Typography>
          </View>
          <NoteRecommend
            width={s(98)}
            height={s(66)}
            style={{
              marginLeft: s(8),
              marginRight: s(16),
              alignSelf: 'flex-start',
              marginTop: s(10),
            }}
          />
        </View>
      </Pressable>
    </RNAnimated.View>
  );
}
