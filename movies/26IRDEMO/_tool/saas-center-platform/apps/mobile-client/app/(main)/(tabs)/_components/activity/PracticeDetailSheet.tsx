/**
 * 연습 활동 상세 시트 — 피그마 928:7300.
 *
 * 목록 행을 탭하면 열린다. 제목이 시트 헤더가 아니라 본문 안에 뱃지와 함께
 * 놓이는 시안이라 BottomSheet의 `title`은 쓰지 않는다.
 * 층: 뱃지+이름 → 소요시간·준비물 2칸 → 이렇게 해보세요(번호 단계) → 팁.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Badge, BottomSheet, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import type { PracticeItem } from './summaryData';
import TimeIcon16 from '@assets/icons/16/TimeIcon16.svg';
import KitIcon16 from '@assets/icons/16/KitIcon16.svg';
import TipIcon20 from '@assets/icons/20/TipIcon20.svg';

interface PracticeDetailSheetProps {
  item: PracticeItem | null;
  onClose: () => void;
}

export function PracticeDetailSheet({
  item,
  onClose,
}: PracticeDetailSheetProps) {
  // 닫는 애니메이션이 끝날 때까지 마지막 내용을 붙들고 있는다 — 즉시 비우면
  // 시트가 슬라이드아웃하면서 높이까지 접혀 내려간다(BottomSheet의 LinearTransition)
  const [shown, setShown] = useState<PracticeItem | null>(item);
  useEffect(() => {
    if (item) setShown(item);
  }, [item]);

  return (
    <BottomSheet visible={item != null} onClose={onClose}>
      {shown ? (
        <View style={{ paddingTop: s(16), paddingBottom: s(8), rowGap: s(20) }}>
          <View style={{ rowGap: s(16) }}>
            <View style={{ rowGap: s(4) }}>
              <View className="self-start">
                <Badge shape="rect" color={shown.domainColor} label={shown.domain} />
              </View>
              <Typography
                variant="title-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                {shown.title}
              </Typography>
            </View>

            <View className="flex-row" style={{ columnGap: s(8) }}>
              <MetaCard
                icon={<TimeIcon16 width={16} height={16} />}
                label="소요시간"
                value={shown.duration}
              />
              <MetaCard
                icon={<KitIcon16 width={16} height={16} />}
                label="준비물"
                value={shown.materials}
              />
            </View>
          </View>

          <View style={{ rowGap: s(20) }}>
            <View style={{ rowGap: s(12) }}>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.text.title.subtle }}
              >
                이렇게 해보세요
              </Typography>

              <View style={{ rowGap: s(14) }}>
                {shown.steps.map((step, index) => (
                  <View
                    key={step.text}
                    className="flex-row items-center"
                    style={{ columnGap: s(12) }}
                  >
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: s(20),
                        height: s(20),
                        backgroundColor: COLORS.brand[500],
                      }}
                    >
                      <Typography
                        variant="caption-01"
                        weight="medium"
                        style={{ color: COLORS.white }}
                      >
                        {index + 1}
                      </Typography>
                    </View>
                    <View className="flex-1" style={{ rowGap: s(4) }}>
                      <Typography
                        variant="body-02-reading"
                        style={{ color: COLORS.text.body.default }}
                      >
                        {step.text}
                      </Typography>
                      {step.note ? (
                        <Typography
                          variant="body-03"
                          style={{ color: COLORS.text.body.subtle }}
                        >
                          {step.note}
                        </Typography>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View
              className="flex-row items-center rounded-xl"
              style={{
                padding: s(12),
                columnGap: s(11),
                backgroundColor: COLORS.bg.selected,
              }}
            >
              <TipIcon20 width={20} height={20} />
              <Typography
                variant="body-03"
                weight="medium"
                className="flex-1"
                style={{ color: COLORS.brand[600] }}
              >
                {shown.tip}
              </Typography>
            </View>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

function MetaCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View
      className="flex-1 rounded-xl"
      style={{ padding: s(12), rowGap: s(12), backgroundColor: COLORS.bg.base }}
    >
      <View className="flex-row items-center" style={{ columnGap: s(4) }}>
        {icon}
        <Typography
          variant="label-01"
          weight="medium"
          style={{ color: COLORS.text.body.subtle }}
        >
          {label}
        </Typography>
      </View>
      <Typography
        variant="body-01"
        weight="medium"
        style={{ color: COLORS.text.title.default }}
      >
        {value}
      </Typography>
    </View>
  );
}
