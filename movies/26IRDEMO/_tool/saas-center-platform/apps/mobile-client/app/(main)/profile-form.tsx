/**
 * 자녀 프로필 등록·수정 — 시안 793:8605. 생성/수정이 같은 화면이고 문구와 버튼만 갈린다.
 *
 * 수정 모드는 값이 실제로 바뀌어야 버튼이 열린다(dirty 게이트) — 안 바꾸고 누르는
 * 무의미한 PATCH를 막는다. 센터에 연결된 프로필은 여기까지 오지 않는다(진입점에서 차단,
 * 서버도 409) — 연결된 프로필은 센터 명부의 투영이라 앱이 고칠 수 없다.
 *
 * 아바타는 카메라 배지 → 시트에서 기본 이미지를 고르거나 앨범 사진을 올린다.
 * 생성 중엔 프로필 id가 없어 고른 것을 들고 있다가, 만들어진 뒤에 붙인다
 * (기본 이미지는 생성 요청에 key로 실려 가고, 업로드 파일만 후속 호출).
 */
import React, { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMe } from '@/features/auth';
import {
  ProfileAvatarSheet,
  useCreateProfile,
  useSetProfileDefaultAvatar,
  useUpdateProfile,
  useUploadProfileImage,
  type DefaultAvatar,
} from '@/features/profile';
import { getErrorMessage } from '@/shared/api/client';
import { Button, FieldLabel, LabeledInput, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { birthDigitsToIso, birthIsoToDigits } from '@/shared/utils/format';
import ArrowLeftIcon24 from '@assets/icons/24/ArrowLeftIcon24.svg';
import CameraIcon20 from '@assets/icons/20/CameraIcon20.svg';

const AVATAR_DEFAULT = require('@assets/images/profile/avatar-default.png');
const AVATAR_SIZE = 100;
/** 카메라 배지 — 시안 793:9792 (32 원형 · bg/emphasis · 아이콘 20, 아바타 우하단) */
const BADGE = 32;

type PickedFile = { uri: string; name: string; type: string };

/**
 * expo-image-picker는 네이티브 모듈이라 재빌드 전 개발 빌드엔 들어 있지 않다.
 * 정적 import면 모듈 평가 시점에 터져 화면 진입 자체가 죽으므로, 없으면 null로 둔다
 * (기본 이미지 고르기는 네이티브 의존이 없어 그대로 쓸 수 있어야 한다).
 */
const ImagePicker: typeof import('expo-image-picker') | null = (() => {
  try {
    return require('expo-image-picker');
  } catch {
    return null;
  }
})();
const GENDER_OPTIONS = [
  { value: 'male', label: '남아', image: require('@assets/images/profile/gender-boy.png') },
  { value: 'female', label: '여아', image: require('@assets/images/profile/gender-girl.png') },
] as const;

/** 성별 선택 박스 — 44px 캐릭터 + 라벨. 선택 상태는 브랜드 테두리+틴트(시안엔 미표기). */
function GenderBox({
  label,
  image,
  selected,
  onPress,
}: {
  label: string;
  image: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-1"
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        className="items-center justify-center"
        style={{
          rowGap: s(4),
          paddingHorizontal: s(10),
          paddingVertical: s(16),
          borderRadius: 12,
          borderWidth: 1,
          borderColor: selected ? COLORS.border.active : COLORS.border.default,
          backgroundColor: selected ? COLORS.bg.selected : COLORS.surface,
        }}
      >
        <Image
          source={image}
          style={{ width: s(44), height: s(44) }}
          resizeMode="contain"
        />
        <Typography
          variant="body-03"
          weight="medium"
          style={{
            color: selected ? COLORS.text.title.default : COLORS.text.body.default,
          }}
        >
          {label}
        </Typography>
      </View>
    </Pressable>
  );
}

export default function ProfileFormScreen() {
  const router = useRouter();
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const meQuery = useMe();

  const profile = (meQuery.data?.profiles ?? []).find((p) => p.id === profileId);
  const isEdit = !!profile;

  const createMutation = useCreateProfile();
  const updateMutation = useUpdateProfile();
  const setDefaultAvatarMutation = useSetProfileDefaultAvatar();
  const uploadImageMutation = useUploadProfileImage();

  const initial = useMemo(
    () => ({
      name: profile?.display_name ?? '',
      gender: profile?.gender ?? null,
      digits: birthIsoToDigits(profile?.birth_date ?? null),
    }),
    [profile?.display_name, profile?.gender, profile?.birth_date],
  );

  const [name, setName] = useState(initial.name);
  const [gender, setGender] = useState<string | null>(initial.gender);
  const [digits, setDigits] = useState(initial.digits);
  const [error, setError] = useState<string | null>(null);

  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  // 고른 것만 담는다 — null이면 서버가 준 profile.image_url을 그린다(meQuery 도착 시점 무관)
  const [pickedAvatarUrl, setPickedAvatarUrl] = useState<string | null>(null);
  const [pendingAvatarKey, setPendingAvatarKey] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<PickedFile | null>(null);
  // 생성은 끝났는데 사진만 실패한 상태 — 다시 누르면 사진만 재시도한다
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);

  const shownAvatarUrl =
    pendingAvatarFile?.uri ?? pickedAvatarUrl ?? profile?.image_url ?? null;

  const handlePickDefault = (avatar: DefaultAvatar) => {
    setAvatarSheetVisible(false);
    setError(null);
    setPendingAvatarFile(null);
    setPickedAvatarUrl(avatar.url);

    const targetId = profile?.id ?? createdProfileId;
    if (targetId) {
      setPendingAvatarKey(null);
      setDefaultAvatarMutation.mutate(
        { id: targetId, key: avatar.key },
        { onError: (err) => setError(getErrorMessage(err, '사진을 바꾸지 못했어요.')) },
      );
      return;
    }
    // 아직 프로필이 없다 — 생성 요청에 실어 보낸다
    setPendingAvatarKey(avatar.key);
  };

  const handlePickFromLibrary = async () => {
    if (!ImagePicker) {
      setAvatarSheetVisible(false);
      setError(
        __DEV__
          ? '앨범 고르기는 네이티브 모듈이라 재빌드가 필요해요 (expo run:android).'
          : '앨범에서 고르기를 쓸 수 없어요. 앱을 최신 버전으로 업데이트해 주세요.',
      );
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAvatarSheetVisible(false);
      setError('사진 접근을 허용해야 앨범에서 고를 수 있어요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const file: PickedFile = {
      uri: asset.uri,
      name: asset.fileName ?? 'avatar.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    };
    setAvatarSheetVisible(false);
    setError(null);
    setPendingAvatarKey(null);
    setPickedAvatarUrl(null);
    setPendingAvatarFile(file);

    const targetId = profile?.id ?? createdProfileId;
    if (!targetId) return;

    uploadImageMutation.mutate(
      { id: targetId, file },
      {
        onSuccess: (updated) => {
          setPendingAvatarFile(null);
          setPickedAvatarUrl(updated.image_url);
        },
        onError: (err) => setError(getErrorMessage(err, '사진을 올리지 못했어요.')),
      },
    );
  };

  const trimmedName = name.trim();
  const birthFilled = digits.length === 6;
  const birthValid = !digits || (birthFilled && birthDigitsToIso(digits) !== null);

  const dirty =
    trimmedName !== initial.name ||
    gender !== initial.gender ||
    digits !== initial.digits;

  // 생성은 이름만 있으면 열리고, 수정은 실제로 바뀌어야 열린다
  const canSubmit =
    !!trimmedName && birthValid && (!isEdit || dirty) && !meQuery.isLoading;

  const submitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadImageMutation.isPending;

  const attachPickedFile = (profileId: string) => {
    if (!pendingAvatarFile) {
      router.back();
      return;
    }
    uploadImageMutation.mutate(
      { id: profileId, file: pendingAvatarFile },
      {
        onSuccess: () => router.back(),
        // 프로필은 이미 만들어졌다 — 되돌리지 않고 사진만 다시 시도하게 남는다
        onError: (err) =>
          setError(getErrorMessage(err, '사진만 저장하지 못했어요. 다시 시도해 주세요.')),
      },
    );
  };

  const handleSubmit = () => {
    // 생성은 끝났고 사진만 실패했던 경우 — 다시 만들지 않는다
    if (createdProfileId) {
      setError(null);
      attachPickedFile(createdProfileId);
      return;
    }

    const birthDate = digits ? birthDigitsToIso(digits) : null;
    if (digits && birthDate === null) {
      setError('생년월일을 다시 확인해 주세요.');
      return;
    }
    setError(null);

    const onSuccess = () => router.back();
    const onError = (err: unknown) =>
      setError(getErrorMessage(err, '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));

    if (isEdit && profile) {
      updateMutation.mutate(
        {
          id: profile.id,
          body: { display_name: trimmedName, birth_date: birthDate, gender },
        },
        { onSuccess, onError },
      );
      return;
    }
    createMutation.mutate(
      {
        display_name: trimmedName,
        relation: 'child',
        ...(birthDate ? { birth_date: birthDate } : {}),
        ...(gender ? { gender } : {}),
        ...(pendingAvatarKey ? { default_avatar_key: pendingAvatarKey } : {}),
      },
      {
        onSuccess: (created) => {
          setCreatedProfileId(created.id);
          attachPickedFile(created.id);
        },
        onError,
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-12 flex-row items-center px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <ArrowLeftIcon24 width={24} height={24} />
        </Pressable>
      </View>

      <KeyboardAwareScrollView
        bottomOffset={24}
        className="flex-1"
        contentContainerStyle={{
          paddingTop: s(12),
          paddingHorizontal: s(16),
          paddingBottom: s(24),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Typography
          variant="title-01"
          weight="semibold"
          className="text-center"
          style={{ color: COLORS.text.title.default }}
        >
          {isEdit ? '자녀 정보를 수정해주세요!' : '자녀 정보를 입력해주세요!'}
        </Typography>

        <View className="items-center" style={{ marginTop: s(28) }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프로필 사진 고르기"
            onPress={() => setAvatarSheetVisible(true)}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <View style={{ width: s(AVATAR_SIZE), height: s(AVATAR_SIZE) }}>
              {shownAvatarUrl ? (
                <Image
                  source={{ uri: shownAvatarUrl }}
                  style={{
                    width: s(AVATAR_SIZE),
                    height: s(AVATAR_SIZE),
                    borderRadius: s(AVATAR_SIZE / 2),
                  }}
                  resizeMode="cover"
                />
              ) : (
                <Image
                  source={AVATAR_DEFAULT}
                  style={{ width: s(AVATAR_SIZE), height: s(AVATAR_SIZE) }}
                  resizeMode="contain"
                />
              )}
              <View
                className="absolute items-center justify-center"
                style={{
                  right: 0,
                  bottom: 0,
                  width: s(BADGE),
                  height: s(BADGE),
                  borderRadius: s(BADGE / 2),
                  backgroundColor: COLORS.bg.emphasis,
                }}
              >
                <CameraIcon20 width={s(20)} height={s(20)} />
              </View>
            </View>
          </Pressable>
        </View>

        <View style={{ marginTop: s(24), rowGap: s(24) }}>
          <LabeledInput
            label="이름"
            placeholder="이름을 입력해주세요"
            value={name}
            onChangeText={setName}
            maxLength={100}
          />

          <LabeledInput
            label="생년월일"
            placeholder="생년월일 6자리를 입력해주세요"
            value={digits}
            onChangeText={(value) => setDigits(value.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            status={digits && !birthValid ? 'error' : 'default'}
            helperText={
              digits && !birthValid ? '생년월일 6자리를 확인해 주세요 (예: 200301)' : undefined
            }
          />

          <View>
            <FieldLabel label="성별" />
            <View className="flex-row" style={{ columnGap: s(8) }}>
              {GENDER_OPTIONS.map((option) => (
                <GenderBox
                  key={option.value}
                  label={option.label}
                  image={option.image}
                  selected={gender === option.value}
                  // 같은 값을 다시 누르면 해제 — 성별은 선택 항목이라 되돌릴 길이 있어야 한다
                  onPress={() =>
                    setGender((prev) => (prev === option.value ? null : option.value))
                  }
                />
              ))}
            </View>
          </View>

          {error ? (
            <Typography variant="body-03" style={{ color: COLORS.status.danger }}>
              {error}
            </Typography>
          ) : null}
        </View>
      </KeyboardAwareScrollView>

      {/* 시안(793:8638)의 상단 그림자는 뺐다 — 폼이 뷰포트에 다 들어와 스크롤이 안 생기므로
          가릴 콘텐츠가 없고, 경계선만 그어진 것처럼 보인다(2026-07-29 판정). */}
      <View
        className="bg-background"
        style={{
          paddingHorizontal: s(16),
          paddingTop: s(16),
          paddingBottom: s(16),
        }}
      >
        <Button
          label={
            createdProfileId ? '사진 다시 올리기' : isEdit ? '수정하기' : '추가하기'
          }
          onPress={handleSubmit}
          disabled={createdProfileId ? submitting : !canSubmit}
          loading={submitting}
        />
      </View>

      <ProfileAvatarSheet
        visible={avatarSheetVisible}
        onClose={() => setAvatarSheetVisible(false)}
        selectedUrl={shownAvatarUrl}
        gender={gender}
        onPickDefault={handlePickDefault}
        onPickFromLibrary={handlePickFromLibrary}
      />
    </SafeAreaView>
  );
}
