import { View, TouchableOpacity } from 'react-native';
import { Typography } from '@/shared/components/ui/Typography';
import { s } from '@/shared/utils/scale';
import type { ClientVariantKey } from './types';

/**
 * 내담자 시안 비교용 세그먼트 탭 — 디자인 톤 & 매너(§0)에 따른 3가지 시안 전환.
 * 디자이너 검토 단계에서만 표시하며, 정식 출시 시 제거 또는 dev flag 처리.
 */
interface TabItem {
  key: ClientVariantKey;
  label: string;
  sub: string;
}

const TABS: TabItem[] = [
  { key: 'A', label: '친절', sub: '한 줄 스캔' },
  { key: 'C', label: '친근', sub: '명함 카드' },
  { key: 'E', label: '재미', sub: '그리드' },
];

interface Props {
  value: ClientVariantKey;
  onChange: (key: ClientVariantKey) => void;
}

export function VariantTabs({ value, onChange }: Props) {
  return (
    <View
      style={{ paddingHorizontal: s(16), paddingVertical: s(8) }}
      className="bg-surface"
    >
      <View
        style={{ padding: s(4), gap: s(4) }}
        className="flex-row rounded-md bg-gray-50"
      >
        {TABS.map((tab) => {
          const active = tab.key === value;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              activeOpacity={0.7}
              style={{ paddingVertical: s(8) }}
              className={`flex-1 items-center justify-center rounded-sm ${
                active ? 'bg-surface' : 'bg-transparent'
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${tab.label} 시안 — ${tab.sub}`}
            >
              <Typography
                variant="label-01"
                weight={active ? 'semibold' : 'medium'}
                className={active ? 'text-title-default' : 'text-body-subtle'}
              >
                {tab.label}
              </Typography>
              <Typography
                variant="caption-01"
                weight="regular"
                className={active ? 'text-body-subtle' : 'text-placeholder'}
                style={{ marginTop: s(2) }}
              >
                {tab.sub}
              </Typography>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
