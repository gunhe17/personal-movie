/**
 * 아바타 고르기 바텀시트 — 등록/수정 화면의 카메라 배지(시안 793:9792)에서 연다.
 *
 * 기본 이미지는 서버가 내려준 URL을 그대로 그린다(앱에 번들하지 않아 S3와 어긋나지 않는다).
 * 성별로 거르지 않는 이유: 시안 순서가 아바타 → … → 성별이라 아바타를 고르는 시점엔
 * 성별이 아직 비어 있을 수 있다. 이미 골랐으면 그 성별을 앞에 놓기만 한다.
 */
import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { BottomSheet, Button, LoadingView, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useDefaultAvatars } from '../hooks';
import type { DefaultAvatar } from '../types';

/** 한 줄 4개 — 시안 폭(343)에서 68px 원이 12 간격으로 딱 맞는다 */
const COLUMNS = 4;
const ITEM = s(68);

interface ProfileAvatarSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 이미 고른 아바타 URL — 테두리로 표시 */
  selectedUrl?: string | null;
  /** 성별을 이미 골랐으면 그 성별을 앞에 놓는다 */
  gender?: string | null;
  onPickDefault: (avatar: DefaultAvatar) => void;
  onPickFromLibrary: () => void;
}

export function ProfileAvatarSheet({
  visible,
  onClose,
  selectedUrl,
  gender,
  onPickDefault,
  onPickFromLibrary,
}: ProfileAvatarSheetProps) {
  const avatarsQuery = useDefaultAvatars(visible);
  const avatars = avatarsQuery.data ?? [];

  const ordered = gender
    ? [...avatars].sort((a, b) => {
        const rank = (item: DefaultAvatar) => (item.gender === gender ? 0 : 1);
        return rank(a) - rank(b);
      })
    : avatars;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="프로필 사진 고르기"
      titleVariant="title-01"
      footer={
        <Button
          label="앨범에서 고르기"
          variant="assistive"
          size="xl"
          onPress={onPickFromLibrary}
        />
      }
    >
      {avatarsQuery.isLoading ? (
        <LoadingView className="py-10" />
      ) : ordered.length === 0 ? (
        <Typography
          variant="body-03"
          className="py-10 text-center"
          style={{ color: COLORS.text.caption.default }}
        >
          고를 수 있는 기본 이미지가 없어요
        </Typography>
      ) : (
        <View
          className="flex-row flex-wrap"
          style={{ columnGap: s(12), rowGap: s(12) }}
        >
          {ordered.map((avatar) => {
            const selected = !!selectedUrl && selectedUrl === avatar.url;
            return (
              <Pressable
                key={avatar.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onPickDefault(avatar)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View
                  className="items-center justify-center overflow-hidden"
                  style={{
                    width: ITEM,
                    height: ITEM,
                    borderRadius: ITEM / 2,
                    backgroundColor: COLORS.action['primary-subtle'],
                    borderWidth: selected ? 2 : 0,
                    borderColor: COLORS.button.primary.bg,
                  }}
                >
                  <Image
                    source={{ uri: avatar.url }}
                    style={{ width: ITEM, height: ITEM }}
                    resizeMode="cover"
                  />
                </View>
              </Pressable>
            );
          })}
          {/* 마지막 줄이 4개 미만일 때 왼쪽 정렬을 유지하는 자리 채움 */}
          {Array.from({ length: (COLUMNS - (ordered.length % COLUMNS)) % COLUMNS }).map(
            (_, i) => (
              <View key={`filler-${i}`} style={{ width: ITEM }} />
            ),
          )}
        </View>
      )}
    </BottomSheet>
  );
}
