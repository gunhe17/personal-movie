/**
 * 검사 배송 스테퍼 — 검사 실시 → 결과 준비 중 → 결과지 도착.
 *
 * 검사는 여정이 아니라 '기다림과 도착' — task에 순서가 없어 트랙 대신 배송 추적 문법.
 * 준비 기간 약속 문구("보통 N일") 금지 — 센터별로 다르다.
 */
import React from 'react';
import { View } from 'react-native';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const STEPS = ['검사 실시', '결과 준비 중', '결과지 도착'] as const;

const TEAL = COLORS.tag.teal.fg;

interface AssessmentStepperProps {
  /** 현재 위치 — 0 실시 · 1 결과 준비 · 2 도착 */
  step: 0 | 1 | 2;
}

export function AssessmentStepper({ step }: AssessmentStepperProps) {
  return (
    <View style={{ marginTop: s(14) }}>
      <View className="flex-row items-center">
        {STEPS.map((_, i) => {
          const done = i < step;
          const now = i === step;
          return (
            <React.Fragment key={i}>
              {i > 0 ? (
                <View
                  className="flex-1"
                  style={{
                    height: s(3),
                    borderRadius: s(1.5),
                    backgroundColor: i <= step ? TEAL : COLORS.gray[100],
                  }}
                />
              ) : null}
              <View
                style={{
                  width: s(22),
                  height: s(22),
                  borderRadius: s(11),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done ? TEAL : now ? COLORS.white : COLORS.gray[100],
                  borderWidth: now ? s(3) : 0,
                  borderColor: TEAL,
                }}
              >
                {done ? (
                  <Typography variant="caption-01" weight="semibold" style={{ color: COLORS.white }}>
                    ✓
                  </Typography>
                ) : null}
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View className="mt-1.5 flex-row">
        {STEPS.map((label, i) => (
          <Typography
            key={label}
            variant="caption-01"
            weight={i === step ? 'semibold' : 'regular'}
            className="flex-1"
            style={{
              color: i <= step ? COLORS.text.title.default : COLORS.gray[400],
              textAlign: i === 0 ? 'left' : i === STEPS.length - 1 ? 'right' : 'center',
            }}
          >
            {label}
          </Typography>
        ))}
      </View>
    </View>
  );
}

/** 표면 검사 카드용 축약 스테퍼 — 점 3개 + 연결선 */
export function MiniStepper({ step }: AssessmentStepperProps) {
  return (
    <View className="flex-row items-center" style={{ columnGap: s(3) }}>
      {STEPS.map((_, i) => {
        const done = i < step;
        const now = i === step;
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <View
                style={{
                  width: s(10),
                  height: s(2),
                  backgroundColor: i <= step ? TEAL : COLORS.gray[200],
                }}
              />
            ) : null}
            <View
              style={{
                width: now ? s(9) : s(8),
                height: now ? s(9) : s(8),
                borderRadius: s(5),
                backgroundColor: done ? TEAL : COLORS.white,
                borderWidth: done ? 0 : s(2),
                borderColor: now ? TEAL : COLORS.gray[200],
              }}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
}
