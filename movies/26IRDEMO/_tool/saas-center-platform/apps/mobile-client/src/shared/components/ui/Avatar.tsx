/**
 * 공용 Avatar — 프로필 이미지(연결 Client의 image_url, 기본아바타 포함) 원형 표시.
 * uri 없으면 UserIcon20 폴백. 크기는 호출부가 지정.
 */
import React from 'react';
import { Image, View } from 'react-native';
import { COLORS } from '@/shared/constants/theme';
import UserIcon20 from '@assets/icons/20/UserIcon20.svg';

export function Avatar({ uri, size }: { uri?: string | null; size: number }) {
  return (
    <View
      className="items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: COLORS.action['primary-subtle'],
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <UserIcon20 width={size * 0.5} height={size * 0.5} />
      )}
    </View>
  );
}
