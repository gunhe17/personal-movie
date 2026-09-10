/**
 * 센터 연결 — 내담자 정보 확인. 시안 1015:8464(일치) · 1015:9586(불일치) · 1054:8222(취소).
 *
 * 센터 명부에 적힌 값과 앱에 있는 프로필 값을 항목별로 대조해 보여준다. 자동으로 잇지 않는
 * 이유는 잘못 연결하면 남의 아이 기록이 보이기 때문이고, 되돌리기도 어렵다(설계 §0-5).
 * 한 항목이라도 어긋나면 연결을 막고 센터에 고치도록 보낸다 — 앱이 임의로 맞추지 않는다.
 *
 * 초대에 자녀가 여럿이면 한 명씩 순서대로 확인하고, 마지막 확인에서 한 번에 연결한다.
 */
import React, { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@/features/auth';
import {
  useClaimLinks,
  useLinkFlowStore,
  type ClaimMapping,
  type InvitationChild,
} from '@/features/link';
import type { Profile } from '@/features/profile';
import { getErrorMessage } from '@/shared/api/client';
import { Button, ConfirmModal, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { formatBirthWithAge } from '@/shared/utils/format';
import CallIcon20 from '@assets/icons/20/CallIcon20.svg';
import CenterIcon20 from '@assets/icons/20/CenterIcon20.svg';
import CheckIcon20 from '@assets/icons/20/CheckIcon20.svg';

/** 대조 결과 — 어긋난 게 하나라도 있으면 연결을 막는다 */
type RowState = 'match' | 'conflict' | 'unknown';

interface CompareRow {
  label: string;
  centerValue: string;
  myValue: string;
  state: RowState;
}

const GENDER_LABEL: Record<string, string> = { male: '남자', female: '여자' };

/** 서버 매칭과 같은 정규화 — iOS 입력은 자모가 분해된 NFD라 눈으로 같은 이름이 어긋난다 */
function normalizeName(value: string | null | undefined): string {
  if (!value) return '';
  return value.normalize('NFC').replace(/\s/g, '');
}

function compareValue(centerRaw: string | null, myRaw: string | null): RowState {
  // 한쪽이 비어 있으면 대조 자체가 성립하지 않는다 — 없는 값을 불일치로 몰아
  // 연결을 막지 않는다(진짜 충돌만 막는다)
  if (!centerRaw || !myRaw) return 'unknown';
  return centerRaw === myRaw ? 'match' : 'conflict';
}

function buildRows(child: InvitationChild, profile: Profile | null): CompareRow[] {
  const dash = '—';
  const centerBirth = formatBirthWithAge(child.birth_date) ?? dash;
  const myBirth = profile ? (formatBirthWithAge(profile.birth_date) ?? dash) : dash;

  return [
    {
      label: '이름',
      centerValue: child.name || dash,
      myValue: profile?.display_name || dash,
      state: compareValue(
        normalizeName(child.name) || null,
        normalizeName(profile?.display_name) || null,
      ),
    },
    {
      label: '생년월일',
      centerValue: centerBirth,
      myValue: myBirth,
      state: compareValue(child.birth_date ?? null, profile?.birth_date ?? null),
    },
    {
      label: '성별',
      centerValue: child.gender ? (GENDER_LABEL[child.gender] ?? child.gender) : dash,
      myValue: profile?.gender ? (GENDER_LABEL[profile.gender] ?? profile.gender) : dash,
      state: compareValue(child.gender ?? null, profile?.gender ?? null),
    },
  ];
}

/** 값 한 줄 — 라벨 폭을 고정해 센터 카드와 내 카드의 값이 세로로 맞는다(시안 51) */
function ValueRow({
  label,
  value,
  trailing,
}: {
  label: string;
  value: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View className="w-full flex-row items-center">
      <View className="flex-1 flex-row items-center" style={{ columnGap: s(12) }}>
        <Typography
          variant="body-02"
          weight="medium"
          style={{ width: s(51), color: COLORS.text.body.subtle }}
        >
          {label}
        </Typography>
        <Typography
          variant="body-02"
          weight="medium"
          numberOfLines={1}
          className="flex-1"
          style={{ color: COLORS.text.body.strong }}
        >
          {value}
        </Typography>
      </View>
      {trailing}
    </View>
  );
}

export default function LinkConfirmScreen() {
  const router = useRouter();
  const { code, verifyResult, targetProfileId } = useLinkFlowStore();
  const setClaimedLinks = useLinkFlowStore((state) => state.setClaimedLinks);
  const claimMutation = useClaimLinks();
  const { data: me } = useMe();

  const [stepIndex, setStepIndex] = useState(0);
  const [decided, setDecided] = useState<ClaimMapping[]>([]);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!verifyResult || !code) {
    return <Redirect href="/(link)/code" />;
  }

  const children = verifyResult.children ?? [];
  const child: InvitationChild | undefined = children[stepIndex];
  const profiles: Profile[] = me?.profiles ?? [];

  // 서버 매칭 — 추천이 없으면 약한 후보 첫 번째까지 본다. 후보가 있는데 그냥
  // 새 프로필로 만들면 같은 아이가 조용히 둘로 갈라진다.
  const serverMatchId =
    child?.suggested_profile_id ?? child?.candidates?.[0]?.profile_id ?? null;
  const targetProfile = targetProfileId
    ? (profiles.find((p) => p.id === targetProfileId) ?? null)
    : null;
  // 자녀 상세에서 [센터 연결하기]로 들어왔으면 대상이 이미 정해져 있다 — 서버 추천보다 우선.
  // 다만 초대에 아이가 여럿이면 그중 누구인지 앱이 못 가르므로, 서버 추천이 같은 프로필을
  // 가리킬 때만 쓴다.
  const useTarget =
    targetProfile !== null &&
    (children.length === 1 || serverMatchId === targetProfile.id);
  const matchProfile = useTarget
    ? targetProfile
    : serverMatchId
      ? (profiles.find((p) => p.id === serverMatchId) ?? null)
      : null;

  const rows = child ? buildRows(child, matchProfile) : [];
  const conflicted = rows.some((row) => row.state === 'conflict');
  const isLast = stepIndex === children.length - 1;
  const center = verifyResult.center;

  const claim = (mappings: ClaimMapping[]) => {
    setError(null);
    claimMutation.mutate(
      { code, mappings },
      {
        onSuccess: (result) => {
          setClaimedLinks(result.links);
          router.replace('/(link)/done');
        },
        onError: (err) =>
          setError(getErrorMessage(err, '연결하지 못했어요. 잠시 후 다시 시도해 주세요.')),
      },
    );
  };

  const handleConfirm = () => {
    if (!child) return;
    // 대조 상대가 있으면 그 프로필로 잇고, 없으면(앱에 처음 들어온 아이) 새로 만든다
    const mapping: ClaimMapping = matchProfile
      ? { client_id: child.client_id, profile_id: matchProfile.id }
      : {
          client_id: child.client_id,
          new_profile: {
            display_name: child.name,
            ...(child.birth_date ? { birth_date: child.birth_date } : {}),
            ...(child.gender ? { gender: child.gender } : {}),
          },
        };
    const next = [...decided, mapping];

    if (isLast) {
      claim(next);
      return;
    }
    setDecided(next);
    setStepIndex((prev) => prev + 1);
  };

  const handleContactCenter = () => {
    if (center.phone) {
      Linking.openURL(`tel:${center.phone}`);
      return;
    }
    setError('센터 전화번호가 없어요. 센터에 직접 문의해 주세요.');
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setDecided((prev) => prev.slice(0, -1));
      setStepIndex((prev) => prev - 1);
      return;
    }
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-[52px] flex-row items-center justify-between px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={handleBack}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="연결 그만두기"
          onPress={() => setCancelVisible(true)}
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={COLORS.gray[900]} />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: s(12), paddingBottom: s(24) }}
      >
        <Typography
          variant="headline-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          연결 전 내담자{'\n'}정보를 확인해주세요
        </Typography>
        {/* 여러 명이면 몇 번째인지 알려준다 — 시안엔 없지만 단계가 반복되면 길을 잃는다 */}
        {children.length > 1 ? (
          <Typography
            variant="body-02"
            weight="medium"
            style={{ marginTop: s(8), color: COLORS.text.title.subtle }}
          >
            {children.length}명 중 {stepIndex + 1}번째
          </Typography>
        ) : null}

        {/* 센터 등록 정보 — 시안 1015:8595 */}
        <View style={{ marginTop: s(40), rowGap: s(9) }}>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.title.subtle }}
          >
            센터 등록 정보
          </Typography>
          <View
            style={{
              padding: s(16),
              rowGap: s(16),
              borderRadius: s(16),
              borderWidth: 1,
              borderColor: COLORS.border.active,
              backgroundColor: COLORS.surface,
            }}
          >
            <View className="flex-row items-center" style={{ columnGap: s(10) }}>
              <View
                className="items-center justify-center overflow-hidden"
                style={{
                  width: s(36),
                  height: s(36),
                  borderRadius: s(18),
                  backgroundColor: COLORS.bg['surface-sunken'],
                }}
              >
                {center.image_url ? (
                  <Image
                    source={{ uri: center.image_url }}
                    style={{ width: s(36), height: s(36) }}
                    resizeMode="cover"
                  />
                ) : (
                  <CenterIcon20 width={s(20)} height={s(20)} />
                )}
              </View>
              <View className="flex-1" style={{ rowGap: s(8) }}>
                <Typography
                  variant="body-01"
                  weight="semibold"
                  numberOfLines={2}
                  style={{ color: COLORS.text.title.default }}
                >
                  {center.name}
                </Typography>
                {center.address ? (
                  <Typography
                    variant="body-02"
                    numberOfLines={2}
                    style={{ color: COLORS.text.body.default }}
                  >
                    {center.address}
                  </Typography>
                ) : null}
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: COLORS.border.default }} />

            <View style={{ rowGap: s(12) }}>
              {rows.map((row) => (
                <ValueRow key={row.label} label={row.label} value={row.centerValue} />
              ))}
            </View>
          </View>
        </View>

        {/* 내 정보 — 항목마다 대조 결과. 시안 1015:8605 */}
        <View style={{ marginTop: s(24), rowGap: s(8) }}>
          <Typography
            variant="body-03"
            weight="medium"
            style={{ color: COLORS.text.title.subtle }}
          >
            내 정보
          </Typography>
          {matchProfile ? (
            <View
              style={{
                padding: s(16),
                borderRadius: s(16),
                backgroundColor: COLORS.bg['emphasis-subtle'],
              }}
            >
              <View style={{ rowGap: s(12) }}>
                {rows.map((row) => (
                  <ValueRow
                    key={row.label}
                    label={row.label}
                    value={row.myValue}
                    trailing={
                      row.state === 'match' ? (
                        <CheckIcon20 width={s(20)} height={s(20)} />
                      ) : row.state === 'conflict' ? (
                        <Ionicons name="close" size={s(20)} color={COLORS.status.danger} />
                      ) : null
                    }
                  />
                ))}
              </View>
            </View>
          ) : (
            /* 시안에 없는 경우 — 온보딩·딥링크로 들어와 대상 프로필이 없다(자녀 상세에서
               들어온 경로는 여기 오지 않는다). 대조할 게 없으니 센터 정보로 새로 만든다 */
            <View
              style={{
                padding: s(16),
                borderRadius: s(16),
                backgroundColor: COLORS.bg['emphasis-subtle'],
              }}
            >
              <Typography variant="body-02" style={{ color: COLORS.text.body.default }}>
                앱에 등록된 정보가 없어요. 센터 정보로 프로필을 새로 만들어요.
              </Typography>
            </View>
          )}

          {matchProfile ? (
            <View className="flex-row items-center" style={{ columnGap: s(7) }}>
              <Ionicons
                name={conflicted ? 'alert-circle' : 'checkmark-circle'}
                size={s(20)}
                color={conflicted ? COLORS.status.danger : COLORS.text.state.brand}
              />
              <Typography
                variant="body-01"
                weight="medium"
                style={{
                  color: conflicted ? COLORS.status.danger : COLORS.text.state.brand,
                }}
              >
                {conflicted ? '정보가 일치하지 않아요' : '정보가 일치해요'}
              </Typography>
            </View>
          ) : null}
        </View>

        {error ? (
          <Typography
            variant="body-03"
            style={{ marginTop: s(12), color: COLORS.status.danger }}
          >
            {error}
          </Typography>
        ) : null}
      </ScrollView>

      <View
        className="bg-background"
        style={{ paddingHorizontal: s(16), paddingTop: s(16), paddingBottom: s(16) }}
      >
        {conflicted ? (
          <Button
            label="센터에 문의하기"
            variant="assistive"
            icon={<CallIcon20 width={s(20)} height={s(20)} />}
            onPress={handleContactCenter}
          />
        ) : (
          <Button
            label="확인했어요"
            onPress={handleConfirm}
            loading={claimMutation.isPending}
            disabled={!child}
          />
        )}
      </View>

      <ConfirmModal
        visible={cancelVisible}
        title="센터 연결을 취소할까요?"
        message="지금까지 진행한 내용은 저장되지 않아요."
        confirmLabel="취소"
        cancelLabel="돌아가기"
        onConfirm={() => {
          setCancelVisible(false);
          router.replace('/(main)/(tabs)');
        }}
        onCancel={() => setCancelVisible(false)}
      />
    </SafeAreaView>
  );
}
