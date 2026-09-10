/**
 * 메인 탭 공통 상단 헤더 — 피그마 1286:10261 (Header).
 *
 * 48h · 좌우 16 · 내부 28h 컨테이너를 `items-center`로 대체(시안 py-10 + 28 = 48).
 * 좌측 Title_02/Normal-Semibold(18) [+ arrow_down 20, gap 6] · 우측 Icon_24/Alarm_new.
 *
 * 5개 탭이 같은 마크업(`h-12 flex-row items-center px-4`)을 각자 들고 있던 걸 한 곳으로
 * 모았다 — 여백·아이콘이 탭마다 갈라지지 않게 한다.
 *
 * 좌측이 단순 타이틀이 아닌 탭(활동 = 프로필 스위처)은 `children`으로 대체한다.
 */
import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUnreadCount } from '@/features/notification';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import ArrowDownIcon20 from '@assets/icons/20/ArrowDownIcon20.svg';
import AlarmIcon24 from '@assets/icons/24/AlarmIcon24.svg';

/** 우측 알림 벨 — 미읽음이 있으면 카운트 배지를 겹친다(시안엔 없는 기능 요소). */
function NotificationBell() {
  const router = useRouter();
  const { data: unreadCount = 0 } = useUnreadCount();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="알림"
      onPress={() => router.push('/(main)/notifications')}
      hitSlop={8}
    >
      <AlarmIcon24 width={24} height={24} />
      {unreadCount > 0 ? (
        <View
          className="absolute items-center justify-center rounded-full"
          style={{
            top: -2,
            right: -4,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            backgroundColor: COLORS.status.danger,
          }}
        >
          <Typography
            variant="caption-01"
            weight="semibold"
            style={{ color: COLORS.white }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Typography>
        </View>
      ) : null}
    </Pressable>
  );
}

export interface TabHeaderProps {
  /** 좌측 타이틀 — `children`을 주면 무시된다 */
  title?: string;
  /** 타이틀 옆 arrow_down (시안 gap 6) */
  chevron?: boolean;
  /** 좌측 영역을 통째로 대체 (활동 탭 프로필 스위처) */
  children?: React.ReactNode;
  /** 좌측 영역 누름 — 주면 Pressable로 감싼다 */
  onPress?: () => void;
  /** onPress가 있을 때의 접근성 라벨 */
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function TabHeader({
  title,
  chevron = false,
  children,
  onPress,
  accessibilityLabel,
  disabled = false,
}: TabHeaderProps) {
  const left = children ?? (
    <View className="flex-row items-center" style={{ columnGap: 6 }}>
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {title}
      </Typography>
      {chevron ? <ArrowDownIcon20 width={20} height={20} /> : null}
    </View>
  );

  return (
    <View className="h-12 flex-row items-center justify-between px-4">
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? title}
          disabled={disabled}
          onPress={onPress}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          {left}
        </Pressable>
      ) : (
        left
      )}
      <NotificationBell />
    </View>
  );
}
