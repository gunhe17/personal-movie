/**
 * 케어보드(라우트명 activity) — 연동 센터의 상담·검사 케이스 축(일정 탭은 날짜 축).
 * 탭 라벨은 시안 Menu(174:1364) 기준 '케어보드'. 화면 구조 개편은 별도 기획
 * (docs/client-app/케어보드-메인-시안-v1.html) — 아래 두 탭 구성은 아직 옛 '활동' 그대로다.
 *
 * 표면 = 밑줄 탭 2개 (피그마 913:5939):
 *   · 활동 요약   — 발달 지표 레이더 · 특성 키워드 · 추천 활동 (ActivitySummary)
 *   · 진행중인 활동 — 여정 허브: 새 소식 → 요약 3칩 → 행동 우선 아코디언 (CaseHub)
 * 아이 선택은 헤더의 "{이름}의 케어보드 ▾" 시트로 (아이가 둘 이상일 때만 노출, §7-5).
 * 케이스 탭 → 상담/검사 케이스 상세 push 페이지 (L1).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/features/auth';
import { useProfileProgress } from '@/features/progress';
import {
  Avatar,
  EmptyView,
  ErrorView,
  LoadingView,
  Tabs,
  Typography,
  type TabOption,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useTabBarClearance } from '@/shared/hooks/useTabBarClearance';
import {
  refetchIfFetched,
  useRefreshControl,
} from '@/shared/hooks/useRefreshControl';
import { TabHeader } from './_components/TabHeader';
import { CaseHub } from './_components/hub/CaseHub';
import { UnlinkedActivity } from './_components/UnlinkedActivity';
import { ActivitySummary } from './_components/activity/ActivitySummary';
import {
  ProfileSwitchSheet,
  type SwitchableProfile,
} from './_components/activity/ProfileSwitchSheet';
import ArrowDownIcon20 from '@assets/icons/20/ArrowDownIcon20.svg';

type ActivityTab = 'summary' | 'ongoing';

const TABS: TabOption<ActivityTab>[] = [
  { value: 'summary', label: '활동 요약' },
  { value: 'ongoing', label: '진행중인 활동' },
];

export default function ActivityScreen() {
  const router = useRouter();
  const meQuery = useMe();
  const me = meQuery.data;
  const tabClearance = useTabBarClearance();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ActivityTab>('summary');
  const [sheetOpen, setSheetOpen] = useState(false);

  // 진행 현황 쿼리는 자식(LinkedActivity)에 있어 키로 새로고침한다 (활성 쿼리만)
  const refreshControl = useRefreshControl(() =>
    Promise.all([
      refetchIfFetched(meQuery),
      queryClient.refetchQueries({ queryKey: ['profile-progress'] }),
    ]),
  );

  const activeLinks = useMemo(
    () => me?.links.filter((link) => link.status === 'active') ?? [],
    [me],
  );
  const isLinked = activeLinks.length > 0;

  const linkedProfiles = useMemo<SwitchableProfile[]>(() => {
    if (!me) return [];
    const linkedProfileIds = new Set(activeLinks.map((link) => link.profile_id));
    return me.profiles
      .filter((profile) => linkedProfileIds.has(profile.id))
      .map((profile) => ({
        id: profile.id,
        name: profile.display_name,
        imageUrl: profile.image_url,
      }));
  }, [me, activeLinks]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 최초 로드·프로필 목록 갱신으로 선택이 사라진 경우 첫 프로필로 복귀
  useEffect(() => {
    if (linkedProfiles.length === 0) return;
    if (!selectedId || !linkedProfiles.some((p) => p.id === selectedId)) {
      setSelectedId(linkedProfiles[0].id);
    }
  }, [linkedProfiles, selectedId]);

  const selected =
    linkedProfiles.find((profile) => profile.id === selectedId) ?? null;
  const canSwitch = linkedProfiles.length > 1;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {isLinked && selected ? (
        // 좌측 = 프로필 스위처(아바타 + "{이름}의 케어보드" + arrow_down, 시안 gap 6)
        <TabHeader
          onPress={() => setSheetOpen(true)}
          disabled={!canSwitch}
          accessibilityLabel={canSwitch ? '아이 선택' : `${selected.name}의 케어보드`}
        >
          <View className="flex-row items-center" style={{ columnGap: s(8) }}>
            <Avatar uri={selected.imageUrl} size={s(20)} />
            <View className="flex-row items-center" style={{ columnGap: 6 }}>
              <Typography
                variant="title-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                {`${selected.name}의 케어보드`}
              </Typography>
              {canSwitch ? <ArrowDownIcon20 width={20} height={20} /> : null}
            </View>
          </View>
        </TabHeader>
      ) : (
        <TabHeader title="케어보드" />
      )}

      {isLinked ? (
        <Tabs options={TABS} value={tab} onChange={setTab} />
      ) : null}

      {meQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : meQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => meQuery.refetch()} />
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={refreshControl}
          contentContainerStyle={{
            paddingTop: s(isLinked && tab === 'summary' ? 24 : 16),
            paddingBottom: tabClearance,
          }}
        >
          {!isLinked ? (
            <UnlinkedActivity />
          ) : tab === 'summary' ? (
            <View className="px-4">
              <ActivitySummary
                childName={selected?.name ?? ''}
                onOpenIndicatorGuide={() =>
                  router.push({
                    pathname: '/(main)/coming-soon',
                    params: { title: '발달 지표 안내' },
                  })
                }
              />
            </View>
          ) : (
            <OngoingActivity profileId={selectedId} />
          )}
        </ScrollView>
      )}

      <ProfileSwitchSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        profiles={linkedProfiles}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </SafeAreaView>
  );
}

function OngoingActivity({ profileId }: { profileId: string | null }) {
  const router = useRouter();
  const progressQuery = useProfileProgress(profileId);
  const progress = progressQuery.data;
  const isEmpty =
    progress &&
    progress.counseling.length === 0 &&
    progress.assessments.length === 0;

  if (progressQuery.isLoading) return <LoadingView className="py-16" />;
  if (progressQuery.isError)
    return <ErrorView className="py-16" onRetry={() => progressQuery.refetch()} />;
  if (!progress || isEmpty)
    return (
      <View className="mx-4 rounded-xl bg-surface">
        <EmptyView
          title="아직 시작된 상담이나 검사가 없어요"
          description="센터에서 상담이나 검사가 접수되면 여기에 들어와요"
          className="py-10"
        />
      </View>
    );

  return (
    <View className="px-4">
      <CaseHub
        progress={progress}
        onOpenCounseling={(caseId) =>
          router.push(
            `/(main)/counseling-case/${caseId}?profileId=${profileId ?? ''}`,
          )
        }
        onOpenAssessment={(caseId) =>
          router.push(
            `/(main)/assessment-case/${caseId}?profileId=${profileId ?? ''}`,
          )
        }
      />
    </View>
  );
}
