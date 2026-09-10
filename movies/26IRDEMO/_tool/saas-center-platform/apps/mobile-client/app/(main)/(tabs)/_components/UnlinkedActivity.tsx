/**
 * 미연결 활동 — 센터 연결 전(게스트 포함)의 활동 탭.
 *
 * 가짜 이름·숫자를 넣지 않는다 (§7-2 판정 금지 — 실제 데이터로 오인될 표면을 만들지 않는다).
 * 회색 골격 프리뷰도 쓰지 않는다: 스켈레톤은 "곧 데이터가 온다"는 신호인데
 * 미연결 상태엔 올 데이터가 없어 멈춘 로딩으로 읽힌다(실제 로딩은 LoadingView 스피너).
 * CTA는 /(link)/code 하나 — 미인증이면 (link)/_layout이 가입으로 보낸다.
 */
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

/** 피그마 shadow/floating — UnlinkedHome 히어로와 같은 카드 언어 */
const FLOATING_SHADOW = {
  shadowColor: '#000B14',
  shadowOffset: { width: 0, height: -1 },
  shadowOpacity: 0.08,
  shadowRadius: 7.9,
  elevation: 4,
} as const;

export function UnlinkedActivity() {
  const router = useRouter();

  return (
    <View className="px-4" style={{ rowGap: s(24) }}>
      <View
        className="items-center rounded-2xl bg-surface px-5 py-7"
        style={FLOATING_SHADOW}
      >
        <Typography
          variant="headline-02"
          weight="semibold"
          className="text-center"
          style={{ color: COLORS.text.headline }}
        >
          아이의 상담과 검사를{'\n'}한곳에서 볼 수 있어요
        </Typography>
        <Typography
          variant="body-02"
          className="mt-2 text-center"
          style={{ color: COLORS.text.body.default }}
        >
          다니는 센터와 연결하면 회기 진행과 검사 현황이{'\n'}자동으로 들어와요
        </Typography>
      </View>

      <View style={{ rowGap: s(8) }}>
        <Button
          label="초대 코드 입력하기"
          variant="primary"
          size="xl"
          onPress={() => router.push('/(link)/code')}
        />
        <Typography
          variant="body-03"
          className="text-center"
          style={{ color: COLORS.text.caption.default }}
        >
          코드는 다니는 센터에서 받을 수 있어요
        </Typography>
      </View>
    </View>
  );
}
