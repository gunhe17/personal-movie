import React from 'react';
import { View } from 'react-native';
import { BottomSheet, EmptyView, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { DirectoryCenterCard } from './DirectoryCenterCard';
import type { DirectoryCenter } from '../types';

interface DirectoryCenterListSheetProps {
  visible: boolean;
  onClose: () => void;
  centers: DirectoryCenter[];
  onSelect: (id: string) => void;
  /** 시트 상단의 세이프에어리어 아래 오프셋 — 지도 검색바를 남기는 높이 */
  topOffset?: number;
}

export function DirectoryCenterListSheet({
  visible,
  onClose,
  centers,
  onSelect,
  topOffset,
}: DirectoryCenterListSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="주변 센터"
      titleAccessory={
        <Typography variant="body-03" style={{ color: COLORS.gray[500] }}>
          {centers.length}곳
        </Typography>
      }
      fullHeight
      topOffset={topOffset}
    >
      {centers.length === 0 ? (
        <EmptyView title="이 지역엔 등록된 센터가 없어요" />
      ) : (
        centers.map((center, i) => (
          <View key={center.id}>
            {i > 0 ? (
              <View
                className="mx-4"
                style={{ height: 1, backgroundColor: COLORS.border.subtle }}
              />
            ) : null}
            <DirectoryCenterCard center={center} onPress={() => onSelect(center.id)} />
          </View>
        ))
      )}
    </BottomSheet>
  );
}
