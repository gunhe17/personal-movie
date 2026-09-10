/**
 * 자녀 추가 전 안내 바텀시트 — 시안 793:8085(793:7960 오버레이).
 *
 * 센터 연동 없이 추가하면 '개인 기록'으로 시작한다는 걸 표로 대비시켜 알린다.
 * 막는 게 아니라 알리는 화면이라 CTA는 하나('확인 했어요')뿐이고, 끄면 다음부터 건너뛴다.
 * 공용 BottomSheet 재사용 — 핸들바·딤·드래그로 닫기는 시트가 이미 갖고 있다.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  BottomSheet,
  Button,
  Checkbox,
  Typography,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import CheckIcon20 from '@assets/icons/20/CheckIcon20.svg';
import CheckMutedIcon20 from '@assets/icons/20/CheckMutedIcon20.svg';
import InfoIcon20 from '@assets/icons/20/InfoIcon20.svg';

/** 대비표 한 줄 — 개인 기록 칸은 체크(가능) 또는 줄표(불가). 센터 연동 칸은 전부 가능. */
const COMPARE_ROWS = [
  { label: '활동 기록', personal: true },
  { label: '일정 확인·알림', personal: false },
  { label: '상담 기록 확인', personal: false },
  { label: '검사 결과 열람', personal: false },
  { label: '센터와 기록 공유', personal: false },
] as const;

/** 표 열 폭 — 시안 793:9547 (라벨 130 / 개인 기록 101 / 센터 연동 나머지) */
const COL_LABEL = s(130);
const COL_PERSONAL = s(101);

/** 불가 표시 — 6px 짧은 줄(시안 793:9622). 글리프가 아니라 선이라 에셋 없이 그린다. */
function Dash() {
  return <View style={{ width: s(6), height: 1, backgroundColor: COLORS.gray[400] }} />;
}

function CompareRow({
  label,
  personal,
  last,
}: {
  label: string;
  personal: boolean;
  last: boolean;
}) {
  return (
    <View
      className="flex-row items-center"
      style={{
        height: s(44),
        ...(last
          ? null
          : { borderBottomWidth: 1, borderBottomColor: COLORS.border.default }),
      }}
    >
      <View className="items-center justify-center" style={{ width: COL_LABEL }}>
        <Typography variant="label-01" style={{ color: COLORS.text.body.default }}>
          {label}
        </Typography>
      </View>
      <View className="items-center justify-center" style={{ width: COL_PERSONAL }}>
        {personal ? <CheckMutedIcon20 width={s(20)} height={s(20)} /> : <Dash />}
      </View>
      <View className="flex-1 items-center justify-center">
        <CheckIcon20 width={s(20)} height={s(20)} />
      </View>
    </View>
  );
}

interface ProfileAddNoticeSheetProps {
  visible: boolean;
  onClose: () => void;
  /** '확인 했어요' — dontShowAgain이 true면 다음부터 이 시트를 건너뛴다 */
  onConfirm: (dontShowAgain: boolean) => void;
}

export function ProfileAddNoticeSheet({
  visible,
  onClose,
  onConfirm,
}: ProfileAddNoticeSheetProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="자녀 추가 전 확인해주세요!"
      titleVariant="title-01"
      footer={
        <Button
          label="확인 했어요"
          variant="primary"
          size="xl"
          onPress={() => onConfirm(dontShowAgain)}
        />
      }
    >
      <View style={{ rowGap: s(24) }}>
        <View style={{ rowGap: s(16) }}>
          {/* 안내 카드 — 시안 793:9760 */}
          <View
            className="rounded-xl bg-background"
            style={{ padding: s(12), rowGap: s(8) }}
          >
            <View className="flex-row items-center" style={{ columnGap: s(4) }}>
              <InfoIcon20 width={s(20)} height={s(20)} />
              <Typography
                variant="body-03"
                weight="medium"
                className="flex-1"
                style={{ color: COLORS.text.title.default }}
              >
                지금 추가하면 개인 기록으로 시작해요
              </Typography>
            </View>
            <Typography
              variant="body-03-reading"
              style={{ color: COLORS.text.body.default }}
            >
              센터와 연동하면 일정과 상담·검사 정보를 확인하고, 작성한 기록도 공유할 수
              있어요. 자녀를 추가한 뒤에도 언제든 연동할 수 있어요.
            </Typography>
          </View>

          {/* 개인 기록 vs 센터 연동 대비표 — 시안 793:9547 */}
          <View
            className="overflow-hidden rounded-xl"
            style={{ borderWidth: 1, borderColor: COLORS.border.default }}
          >
            <View
              className="flex-row items-center bg-background"
              style={{
                height: s(40),
                borderBottomWidth: 1,
                borderBottomColor: COLORS.border.default,
              }}
            >
              <View style={{ width: COL_LABEL }} />
              <View
                className="items-center justify-center"
                style={{ width: COL_PERSONAL }}
              >
                <Typography
                  variant="label-01"
                  style={{ color: COLORS.text.body.default }}
                >
                  개인 기록
                </Typography>
              </View>
              <View className="flex-1 items-center justify-center">
                <Typography
                  variant="label-01"
                  weight="medium"
                  style={{ color: COLORS.text.body.strong }}
                >
                  센터 연동
                </Typography>
              </View>
            </View>

            {COMPARE_ROWS.map((row, i) => (
              <CompareRow
                key={row.label}
                label={row.label}
                personal={row.personal}
                last={i === COMPARE_ROWS.length - 1}
              />
            ))}
          </View>
        </View>

        {/* 다시 보지 않기 — 라벨까지 누를 수 있게 행 전체를 표적으로 */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: dontShowAgain }}
          onPress={() => setDontShowAgain((prev) => !prev)}
          className="flex-row items-center self-center"
          style={{ columnGap: s(4) }}
        >
          <Checkbox checked={dontShowAgain} onChange={setDontShowAgain} />
          <Typography
            variant="body-02"
            weight="medium"
            style={{ color: COLORS.text.body.default }}
          >
            다시 표시 안할게요
          </Typography>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
