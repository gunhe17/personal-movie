/**
 * 일정 취소 바텀시트 — 피그마 421:5503.
 *
 * 전체 높이 시트 + 요약 카드(다크 툴팁 안내) + 취소 사유(라디오 3 + 기타 직접입력)
 * → 하단 고정 "취소 요청". 사유는 필수.
 * 내담자앱 공용 BottomSheet 재사용(전문가앱 시트와 별개로 이미 존재).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  BottomSheet,
  Button,
  Typography,
  type BadgeColor,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';

const PRESET_REASONS = [
  '아이가 아파요',
  '보호자가 참석이 어려워요',
  '개인 사정이 생겼어요',
] as const;
const ETC = '기타(직접 입력)';

const RADIO_ROW = {
  flexDirection: 'row',
  alignItems: 'center',
  columnGap: s(8),
} as const;

interface CancelScheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  title: string;
  profileName?: string;
  profileColor: BadgeColor;
  dateTimeText: string;
  centerName?: string;
  counselorName?: string;
}

function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      // 레이아웃은 정적 style로만 — pressed 콜백에 넣으면 실기기에서 적용이 깨져
      // 라디오와 라벨이 세로로 쌓인다 (피드백은 선택 상태 변화로 충분)
      style={RADIO_ROW}
    >
      <View
        style={{
          width: s(20),
          height: s(20),
          borderRadius: s(20),
          borderWidth: selected ? 0 : 1.5,
          borderColor: COLORS.gray[300],
          backgroundColor: selected ? COLORS.action.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? (
          <View
            style={{
              width: s(7),
              height: s(7),
              borderRadius: s(7),
              backgroundColor: COLORS.gray[0],
            }}
          />
        ) : null}
      </View>
      <Typography variant="body-01" style={{ color: COLORS.text.body.strong }}>
        {label}
      </Typography>
    </Pressable>
  );
}

/** 안내 툴팁 — 다크 버블 + 아래 꼬리 (피그마 Tooltip 37:718 패턴, 닫기 포함) */
function GuideTooltip({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void;
}) {
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <View
        className="flex-row items-center rounded-lg"
        style={{
          columnGap: s(6),
          paddingHorizontal: s(10),
          paddingVertical: s(7),
          backgroundColor: COLORS.gray[800],
        }}
      >
        <Typography
          variant="label-02"
          weight="medium"
          style={{ color: COLORS.text.state['on-primary'] }}
        >
          {label}
        </Typography>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="안내 닫기"
          onPress={onClose}
          hitSlop={8}
        >
          <Ionicons name="close" size={s(14)} color={COLORS.gray[400]} />
        </Pressable>
      </View>
      {/* 꼬리 — 45도 회전 사각형이 버블 아래로 살짝 겹친다 */}
      <View
        style={{
          width: s(10),
          height: s(10),
          marginTop: -s(6),
          marginLeft: s(14),
          backgroundColor: COLORS.gray[800],
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
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

export function CancelScheduleSheet({
  visible,
  onClose,
  onConfirm,
  loading,
  title,
  profileName,
  profileColor,
  dateTimeText,
  centerName,
  counselorName,
}: CancelScheduleSheetProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [etcText, setEtcText] = useState('');
  const [tipVisible, setTipVisible] = useState(true);

  // 시트를 다시 열면 사유·안내를 초기 상태로
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setEtcText('');
      setTipVisible(true);
    }
  }, [visible]);

  const isEtc = selected === ETC;
  const reason = isEtc ? etcText.trim() : (selected ?? '');
  const canSubmit = reason.length > 0;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="예약을 취소할까요?"
      titleAccessory={
        tipVisible ? (
          <GuideTooltip
            label="취소 전 일정을 꼭 확인해주세요"
            onClose={() => setTipVisible(false)}
          />
        ) : null
      }
      fullHeight
      footer={
        <Button
          label="취소 요청"
          variant="primary"
          size="xl"
          disabled={!canSubmit}
          loading={loading}
          onPress={() => onConfirm(reason)}
        />
      }
    >
      {/* 요약 카드 */}
      <View
        style={{
          backgroundColor: COLORS.bg['surface-sunken'],
          borderRadius: s(12),
          padding: s(16),
          rowGap: s(12),
        }}
      >
        <View className="flex-row items-center" style={{ columnGap: s(8) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
          >
            {title}
          </Typography>
          {profileName ? (
            <Badge
              label={profileName}
              color={profileColor}
              shape="rect"
              size="md"
            />
          ) : null}
        </View>
        <View style={{ rowGap: s(8) }}>
          {dateTimeText ? (
            <SummaryRow label="일시" value={dateTimeText} />
          ) : null}
          {centerName ? <SummaryRow label="센터명" value={centerName} /> : null}
          {counselorName ? (
            <SummaryRow label="담당자" value={counselorName} />
          ) : null}
        </View>
      </View>

      {/* 취소 사유 */}
      <View className="mt-5">
        <View className="flex-row items-center" style={{ columnGap: s(4) }}>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.title.subtle }}
          >
            취소 사유
          </Typography>
          <Typography
            variant="label-02"
            weight="medium"
            style={{ color: COLORS.status.danger }}
          >
            *
          </Typography>
        </View>

        <View className="mt-4" style={{ rowGap: s(16) }}>
          {PRESET_REASONS.map((r) => (
            <RadioRow
              key={r}
              label={r}
              selected={selected === r}
              onPress={() => setSelected(r)}
            />
          ))}
          <View style={{ rowGap: s(12) }}>
            <RadioRow
              label={ETC}
              selected={isEtc}
              onPress={() => setSelected(ETC)}
            />
            {isEtc ? (
              <TextInput
                value={etcText}
                onChangeText={setEtcText}
                placeholder="취소 사유를 입력해주세요"
                placeholderTextColor={COLORS.text.placeholder}
                multiline
                textAlignVertical="top"
                style={{
                  minHeight: s(80),
                  borderWidth: 1,
                  borderColor: COLORS.border.default,
                  borderRadius: s(12),
                  paddingHorizontal: s(12),
                  paddingVertical: s(8),
                  fontFamily: 'Pretendard-Regular',
                  fontSize: s(15),
                  lineHeight: s(23),
                  letterSpacing: -0.6,
                  color: COLORS.text.body.strong,
                }}
              />
            ) : null}
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
