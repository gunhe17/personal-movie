/**
 * 일정 상세 — 피그마 414:4531.
 *
 * 목록 카드에서 넘어온 값을 params로 받아 보여주는 표시 전용 화면(단일 일정 조회 API
 * 없음 → 카드가 가진 값 그대로 전달). 취소는 확인 모달 → 상담 회기 취소(가족·담당자·센터 알림).
 * 변경 요청 백엔드는 아직 없어 안내 알럿으로 폴백.
 */
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  useCancelSchedule,
  useRequestScheduleChange,
} from '@/features/schedule';
import { CancelScheduleSheet } from '@/features/schedule/components/CancelScheduleSheet';
import { ChangeScheduleSheet } from '@/features/schedule/components/ChangeScheduleSheet';
import { getErrorMessage } from '@/shared/api/client';
import {
  Badge,
  Button,
  Toast,
  Typography,
  type BadgeColor,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { toKst } from '@/shared/utils/date';
import CenterIcon20 from '@assets/icons/20/CenterIcon20.svg';
import InfoIcon20 from '@assets/icons/20/InfoIcon20.svg';
import VoucherIcon20 from '@assets/icons/20/VoucherIcon20.svg';
import ArrowRightIcon20 from '@assets/icons/20/ArrowRightIcon20.svg';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start" style={{ columnGap: s(21) }}>
      <Typography
        variant="body-02"
        style={{ width: s(40), color: COLORS.text.body.default }}
      >
        {label}
      </Typography>
      <Typography
        variant="body-02"
        weight="medium"
        className="flex-1"
        style={{ color: COLORS.text.body.strong }}
      >
        {value}
      </Typography>
    </View>
  );
}

export default function ScheduleDetailScreen() {
  const router = useRouter();
  const p = useLocalSearchParams<{
    scheduleId?: string;
    kind?: string;
    status?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    centerName?: string;
    roomName?: string;
    counselorName?: string;
    memo?: string;
    pendingRequestStart?: string;
    voucherName?: string;
    profileName?: string;
    profileColor?: string;
  }>();

  // 서버 UTC naive → KST 벽시계(shared/utils/date.ts). 아래 시간 연산은 둘 다
  // 같은 만큼 옮겨진 값이라 차이 계산이 그대로 맞는다.
  const start = p.startTime ? toKst(p.startTime) : null;
  const end = p.endTime ? toKst(p.endTime) : null;

  const cancelMutation = useCancelSchedule();
  const changeMutation = useRequestScheduleChange();
  const [cancelVisible, setCancelVisible] = useState(false);
  const [changeVisible, setChangeVisible] = useState(false);
  // 목록에서 받아온 대기 요청 — 있으면 재요청 대신 검토 중 상태를 보여준다
  const [pendingStart, setPendingStart] = useState<string | null>(
    p.pendingRequestStart ?? null,
  );
  const [toastVisible, setToastVisible] = useState(false);

  // 앱에서 손댈 수 있는 건 예정된 상담 회기뿐 — 검사·취소·완료 회기는 서버가 막는다
  const actionable =
    p.kind === 'counseling' && (p.status ?? 'scheduled') === 'scheduled';

  // 변경 요청 중이면 요청한 시각을 보여준다 — 아직 확정이 아니라는 건 상단 배너가 말한다
  const requested = pendingStart ? toKst(pendingStart) : null;
  const shownStart = requested ?? start;
  const shownEnd =
    requested && start && end
      ? new Date(requested.getTime() + (end.getTime() - start.getTime()))
      : end;
  const dateTime =
    shownStart && shownEnd
      ? `${format(shownStart, 'M월 d일 EEE', { locale: ko })}   ${format(shownStart, 'HH:mm')} - ${format(shownEnd, 'HH:mm')}`
      : '';

  const sheetDateTime =
    start && end
      ? `${format(start, 'yyyy. M. d EEE', { locale: ko })} ${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`
      : '';

  const handleCancel = (reason: string) => {
    if (!p.scheduleId) return;
    cancelMutation.mutate(
      { scheduleId: p.scheduleId, reason },
      {
        onSuccess: () => {
          setCancelVisible(false);
          router.back();
        },
        onError: (err) => {
          setCancelVisible(false);
          Alert.alert(
            '취소하지 못했어요',
            getErrorMessage(err, '잠시 후 다시 시도해 주세요.'),
          );
        },
      },
    );
  };

  const handleChangeRequest = (startTime: string) => {
    if (!p.scheduleId) return;
    changeMutation.mutate(
      { scheduleId: p.scheduleId, startTime },
      {
        onSuccess: () => {
          setChangeVisible(false);
          setPendingStart(startTime);
          setToastVisible(true);
        },
        onError: (err) => {
          Alert.alert(
            '요청하지 못했어요',
            getErrorMessage(err, '잠시 후 다시 시도해 주세요.'),
          );
        },
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View className="h-12 flex-row items-center px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <Typography
          variant="title-01"
          weight="semibold"
          className="ml-1"
          style={{ color: COLORS.text.title.default }}
        >
          일정
        </Typography>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: s(16), rowGap: s(16) }}
      >
        {/* 상태 배너 — 변경 요청 중이면 위 일시가 "요청한 시각"임을 여기서 밝힌다 */}
        <View
          className="flex-row items-center"
          style={{
            columnGap: s(8),
            padding: s(12),
            borderRadius: s(12),
            backgroundColor: pendingStart
              ? 'rgba(49,164,247,0.08)'
              : 'rgba(25,191,141,0.08)',
          }}
        >
          <InfoIcon20 width={20} height={20} />
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.body.default }}
          >
            {pendingStart
              ? '변경 요청한 시간이에요 · 선생님 확인 후 확정돼요'
              : '센터와 예약이 확정된 일정이에요'}
          </Typography>
        </View>

        {/* 제목 섹션 */}
        <View style={{ rowGap: s(12) }}>
          {p.profileName ? (
            <View className="flex-row">
              <Badge
                label={p.profileName}
                color={(p.profileColor as BadgeColor) ?? 'gray'}
                shape="rect"
                size="md"
              />
            </View>
          ) : null}
          <View style={{ rowGap: s(8) }}>
            <Typography
              variant="headline-02"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              {p.title}
            </Typography>
            <Typography
              variant="body-01"
              weight="medium"
              style={{ color: COLORS.text.body.default }}
            >
              {dateTime}
            </Typography>
          </View>
        </View>

        {/* 상세 카드 */}
        <View
          className="bg-surface"
          style={{ borderRadius: s(16), padding: s(16), rowGap: s(16) }}
        >
          {p.centerName ? (
            <View className="flex-row items-center" style={{ columnGap: s(4) }}>
              <CenterIcon20 width={20} height={20} />
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.text.label.default }}
              >
                {p.centerName}
              </Typography>
            </View>
          ) : null}

          <View style={{ height: 1, backgroundColor: COLORS.border.default }} />

          <View style={{ rowGap: s(12) }}>
            {p.roomName ? <DetailRow label="장소" value={p.roomName} /> : null}
            {p.counselorName ? (
              <DetailRow label="담당자" value={p.counselorName} />
            ) : null}
            {p.memo ? <DetailRow label="메모" value={p.memo} /> : null}
          </View>

          {/* 바우처 칩 — 이 회기가 청구된 제도(바우처 청구 있을 때만) */}
          {p.voucherName ? (
            <View
              className="flex-row items-center"
              style={{
                columnGap: s(4),
                padding: s(10),
                borderRadius: s(8),
                backgroundColor: COLORS.bg.base,
              }}
            >
              <VoucherIcon20 width={20} height={20} />
              <Typography
                variant="body-03"
                weight="medium"
                className="flex-1"
                style={{ color: COLORS.text.body.default }}
              >
                {p.voucherName}
              </Typography>
              <ArrowRightIcon20 width={20} height={20} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* 하단 고정 요청 버튼 */}
      <View
        className="flex-row bg-background"
        style={{
          columnGap: s(8),
          paddingHorizontal: s(16),
          paddingTop: s(16),
          paddingBottom: s(16),
        }}
      >
        <View className="flex-1">
          <Button
            label="일정 취소"
            variant="danger"
            size="xl"
            disabled={!p.scheduleId || !actionable}
            onPress={() => setCancelVisible(true)}
          />
        </View>
        <View className="flex-1">
          <Button
            label={pendingStart ? '변경 요청 검토 중' : '일정 변경 요청'}
            variant="primary"
            size="xl"
            disabled={!p.scheduleId || !!pendingStart || !actionable}
            onPress={() => setChangeVisible(true)}
          />
        </View>
      </View>

      {start ? (
        <ChangeScheduleSheet
          visible={changeVisible}
          onClose={() => setChangeVisible(false)}
          onConfirm={handleChangeRequest}
          loading={changeMutation.isPending}
          scheduleId={p.scheduleId ?? ''}
          currentStart={start}
        />
      ) : null}

      <Toast
        // 하단 고정 액션 바(패딩 16 + 버튼 52 + 패딩 16) 위로
        bottomOffset={s(84)}
        visible={toastVisible}
        message="일정 변경 요청이 완료되었어요"
        description="확정되면 알림으로 알려드릴게요"
        onHide={() => setToastVisible(false)}
      />

      <CancelScheduleSheet
        visible={cancelVisible}
        onClose={() => setCancelVisible(false)}
        onConfirm={handleCancel}
        loading={cancelMutation.isPending}
        title={p.title ?? ''}
        profileName={p.profileName}
        profileColor={(p.profileColor as BadgeColor) ?? 'gray'}
        dateTimeText={sheetDateTime}
        centerName={p.centerName}
        counselorName={
          p.counselorName ? `${p.counselorName} 선생님` : undefined
        }
      />
    </SafeAreaView>
  );
}
