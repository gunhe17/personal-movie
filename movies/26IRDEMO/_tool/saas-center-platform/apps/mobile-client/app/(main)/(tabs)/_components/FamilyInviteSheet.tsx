/**
 * 가족 초대 코드 시트 — 시안 1531:16264. 열릴 때 코드를 발급하고 6자리를 보여준다.
 *
 * 재발급하면 이전 코드가 서버에서 무효화되므로(§초대 규약), 시트를 열 때마다
 * 새로 발급하지 않고 최초 1회만 발급한다.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useIssueFamilyInvitation } from '@/features/family';
import { getErrorMessage } from '@/shared/api/client';
import {
  BottomSheet,
  Button,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import CopyIcon20 from '@assets/icons/20/CopyIcon20.svg';

/** 코드 표기 — 시안 1531:16314 (28 semibold · 자간 3) */
const CODE_TRACKING = 3;

/**
 * expo-clipboard는 네이티브 모듈이라 재빌드 전 개발 빌드엔 없다.
 * 정적 import면 시트를 여는 것만으로 죽으므로, 없으면 복사 버튼을 감춘다.
 */
const Clipboard: typeof import('expo-clipboard') | null = (() => {
  try {
    return require('expo-clipboard');
  } catch {
    return null;
  }
})();

interface FamilyInviteSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function FamilyInviteSheet({ visible, onClose }: FamilyInviteSheetProps) {
  const issueMutation = useIssueFamilyInvitation();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) {
      setCode(null);
      setError(null);
      setCopied(false);
      return;
    }
    if (code !== null) return;

    issueMutation.mutate(undefined, {
      onSuccess: (invitation) => setCode(invitation.code),
      onError: (err) =>
        setError(getErrorMessage(err, '코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.')),
    });
    // 시트가 열린 시점에 1회만 — code/mutation을 넣으면 재발급 루프가 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleCopy = async () => {
    if (!code || !Clipboard) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
  };

  const handleShare = () => {
    if (!code) return;
    Share.share({
      message: `마인드스코프 가족 초대 코드예요.\n\n${code}\n\n앱에서 마이 > 가족관계 > 코드 입력하기에 입력하면 아이의 일정과 소식을 함께 볼 수 있어요. (48시간 유효)`,
    });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="가족에게 초대 코드를 공유할게요"
      titleVariant="title-01"
      subtitle="아래 코드를 입력하면 아이의 일정과 소식을 함께 확인할 수 있어요"
      footer={
        <Button label="공유하기" onPress={handleShare} disabled={code === null} />
      }
    >
      {error ? (
        <Typography
          variant="body-03"
          className="py-6 text-center"
          style={{ color: COLORS.status.danger }}
        >
          {error}
        </Typography>
      ) : code === null ? (
        <LoadingView className="py-10" />
      ) : (
        <View
          className="items-center bg-background"
          style={{
            paddingTop: s(16),
            paddingBottom: s(20),
            paddingHorizontal: s(16),
            rowGap: s(8),
            borderRadius: s(12),
          }}
        >
          <View className="w-full flex-row items-center">
            <Typography
              variant="body-03"
              weight="medium"
              className="flex-1"
              style={{ color: COLORS.text.title.subtle }}
            >
              {copied ? '복사했어요' : '초대 코드'}
            </Typography>
            {Clipboard ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="초대 코드 복사"
                onPress={handleCopy}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <CopyIcon20 width={s(20)} height={s(20)} />
              </Pressable>
            ) : null}
          </View>
          <Typography
            variant="headline-large"
            weight="semibold"
            style={{ color: COLORS.text.body.strong, letterSpacing: s(CODE_TRACKING) }}
          >
            {code}
          </Typography>
          <Typography variant="label-01" style={{ color: COLORS.text.caption.default }}>
            48시간 동안 쓸 수 있어요
          </Typography>
        </View>
      )}
    </BottomSheet>
  );
}
