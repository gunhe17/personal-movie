/**
 * 기록 작성 — 시안 기분 선택 → 내용 작성 2단계.
 *
 * 프로필 선택(설계.md §15-6-2): 아이가 1명이면 표면 자체가 없고(자동 귀속),
 * 2명 이상이면 진입 컨텍스트를 승계한다 — 기록 탭에서 아이 칩이 선택된 채로
 * 들어오면 params.profileId가 실려 와 선택 단계를 건너뛴다.
 * 잘못 골라도 상세의 "다른 아이 기록으로 옮기기"로 되돌릴 수 있어 확인 단계를 두지 않는다.
 *
 * 시안: 기분 선택 271:6568 · 내용 작성 287:2702.
 *
 * ⚠️ [첨부하기]는 촬영 가이드(record-capture-guide)까지만 간다 — 실제 선택·업로드는
 * expo-image-picker 미설치(네이티브 재빌드) + presigned 업로드 클라이언트 미구현.
 * 공유 토글은 시안 수정(기록-시안-정합-요청.md §2-3)이 선행이라 아직 없다.
 * occurred_at도 표시만 한다 — 수정(§15-5)은 피커 시안이 없다.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { kstToServerDateTime, nowKst } from '@/shared/utils/date';
import { useMe } from '@/features/auth';
import {
  MOODS,
  MOOD_ICON,
  RECORD_WRITING_TIPS,
  useCreateRecord,
  type RecordMood,
} from '@/features/records';
import { Button, Typography, getTypographyStyle } from '@/shared/components/ui';
import { COLORS, SHADOWS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import ArrowLeftIcon24 from '@assets/icons/24/ArrowLeftIcon24.svg';
import ArrowDownIcon20 from '@assets/icons/20/ArrowDownIcon20.svg';
import LockIcon20 from '@assets/icons/20/LockIcon20.svg';
import TipIcon20 from '@assets/icons/20/TipIcon20.svg';

type Step = 'profile' | 'mood' | 'body';

/** 선택 링 — 비선택은 카드와 같은 흰색(보간 대상이라 transparent 대신 색으로 둔다) */
const RING_OFF = COLORS.surface;
const RING_ON = COLORS.action.primary;
const SPRING = { damping: 12, stiffness: 220 };

export default function RecordCreateScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ profileId?: string }>();
  const meQuery = useMe();
  const profiles = meQuery.data?.profiles ?? [];

  const createRecord = useCreateRecord();

  // 아이가 하나면 선택 표면을 만들지 않는다(§7-5 "해당 없으면 표면 자체를 제거")
  const presetProfileId =
    params.profileId ?? (profiles.length === 1 ? profiles[0].id : null);

  const [profileId, setProfileId] = useState<string | null>(
    presetProfileId ?? null,
  );
  const [step, setStep] = useState<Step>(presetProfileId ? 'mood' : 'profile');
  const [mood, setMood] = useState<RecordMood | null>(null);
  const [body, setBody] = useState('');
  const [privateMemo, setPrivateMemo] = useState('');

  // 화면 표시는 KST 벽시계, 서버로는 UTC로 환산해 보낸다(shared/utils/date.ts)
  const occurredAt = useMemo(() => nowKst(), []);
  const childName =
    profiles.find((p) => p.id === profileId)?.display_name ?? '아이';

  // 재전송 멱등 키 — 화면 진입 1회 발급이라 네트워크 재시도로 중복 생성되지 않는다
  const clientKey = useMemo(
    () => `${occurredAt.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    [occurredAt],
  );

  // 화면을 정말 떠나는 순간(등록 완료·첫 단계에서 뒤로) — 단계 되감기 가로채기를 끈다
  const leaving = useRef(false);
  const leaveScreen = useCallback(() => {
    leaving.current = true;
    router.back();
  }, [router]);

  /**
   * 단계 되감기. 시스템 뒤로가기(안드로이드 내비 바·제스처)도 헤더 화살표와 같은 길을
   * 타야 해서, 여기 한 곳에서 판정하고 BackHandler·beforeRemove가 함께 물린다.
   * 가로채지 않으면 스택이 통째로 pop 돼 기록 탭으로 튄다.
   */
  const stepBack = useCallback(() => {
    if (leaving.current) return false;
    if (step === 'body') {
      setStep('mood');
      return true;
    }
    if (step === 'mood' && !presetProfileId) {
      setStep('profile');
      return true;
    }
    return false;
  }, [step, presetProfileId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', stepBack);
    return () => sub.remove();
  }, [stepBack]);

  // JS pop 경로 — 하드웨어 백은 위에서 이미 삼켜 여기까지 오지 않는다
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (stepBack()) e.preventDefault();
      }),
    [navigation, stepBack],
  );

  /**
   * iOS 스와이프 백은 네이티브 스택이 JS를 거치지 않고 화면을 걷어내 작성 내용이
   * 통째로 날아간다 — 첫 단계가 아닐 땐 제스처를 닫고 헤더 화살표로만 되감는다.
   */
  const atFirstStep =
    step === 'profile' || (step === 'mood' && presetProfileId);
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !!atFirstStep });
  }, [navigation, atFirstStep]);

  const submit = () => {
    if (!profileId || !mood) return;
    createRecord.mutate(
      {
        profile_id: profileId,
        client_key: clientKey,
        occurred_at: kstToServerDateTime(occurredAt),
        mood,
        body: body.trim() || null,
        private_memo: privateMemo.trim() || null,
      },
      {
        onSuccess: () => leaveScreen(),
        onError: () =>
          Alert.alert(
            '저장하지 못했어요',
            '잠시 후 다시 시도해 주세요. 작성한 내용은 그대로 있어요.',
          ),
      },
    );
  };

  const goBack = () => {
    if (!stepBack()) leaveScreen();
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-12 flex-row items-center px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={goBack}
          hitSlop={8}
        >
          <ArrowLeftIcon24 width={24} height={24} />
        </Pressable>
      </View>

      {/* key={step} = 단계가 바뀔 때마다 새로 마운트 → entering 페이드가 걸린다 */}
      {/* Animated.View는 NativeWind className 매핑을 보장하지 않아 레이아웃도 style로 준다 */}
      <Animated.View
        key={step}
        style={{ flex: 1 }}
        entering={FadeIn.duration(200)}
      >
        {step === 'profile' ? (
          <ProfileStep
            profiles={profiles}
            onSelect={(id) => {
              setProfileId(id);
              setStep('mood');
            }}
          />
        ) : step === 'mood' ? (
          <MoodStep
            childName={childName}
            mood={mood}
            onSelect={setMood}
            onNext={() => setStep('body')}
          />
        ) : (
          <BodyStep
            occurredAt={occurredAt}
            mood={mood}
            body={body}
            privateMemo={privateMemo}
            onChangeBody={setBody}
            onChangePrivateMemo={setPrivateMemo}
            onPrev={() => setStep('mood')}
            onSubmit={submit}
            submitting={createRecord.isPending}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function ProfileStep({
  profiles,
  onSelect,
}: {
  profiles: { id: string; display_name: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: s(16), rowGap: s(12) }}>
      <Typography
        variant="headline-02"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {'누구의 기록인가요?'}
      </Typography>
      {profiles.map((profile) => (
        <PressableCard key={profile.id} onPress={() => onSelect(profile.id)}>
          <View
            className="rounded-2xl border bg-surface"
            style={{
              padding: s(20),
              borderColor: COLORS.border.subtle,
              ...SHADOWS.card,
            }}
          >
            <Typography
              variant="body-01"
              weight="medium"
              style={{ color: COLORS.text.title.default }}
            >
              {profile.display_name}
            </Typography>
          </View>
        </PressableCard>
      ))}
    </ScrollView>
  );
}

/** 누르면 살짝 눌리는 카드 래퍼 — 목록·시트에서 공통으로 쓰는 터치 피드백 */
function PressableCard({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
    opacity: 1 - pressed.value * 0.06,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 140 });
      }}
    >
      <Animated.View style={style}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * 기분 카드 — 시안엔 선택 상태가 없어 액센트 링으로 표시한다.
 * 링 색은 150ms 보간, 표정은 스프링으로 살짝 커진다(누르는 순간엔 눌린 느낌).
 * s()는 렌더 단계에서 숫자로 미리 계산해 worklet에 넘긴다(worklet 안 호출 금지).
 */
function MoodCard({
  label,
  icon: MoodFace,
  selected,
  onPress,
}: {
  label: string;
  icon: React.FC<SvgProps>;
  selected: boolean;
  onPress: () => void;
}) {
  const faceSize = s(48);
  const pressed = useSharedValue(0);
  const progress = useDerivedValue(
    () => withTiming(selected ? 1 : 0, { duration: 150 }),
    [selected],
  );

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], [RING_OFF, RING_ON]),
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(1 + progress.value * 0.1, SPRING) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 140 });
      }}
    >
      {/* 시안에는 테두리가 없다 — 비선택 링은 카드와 같은 흰색이라 보이지 않고,
          항상 그려 두므로 선택해도 레이아웃이 흔들리지 않는다 */}
      <Animated.View
        style={[
          {
            width: s(109),
            height: s(129),
            borderRadius: s(12),
            paddingTop: s(21),
            rowGap: s(20),
            borderWidth: s(1.5),
            alignItems: 'center',
            backgroundColor: COLORS.surface,
          },
          cardStyle,
        ]}
      >
        <Animated.View style={faceStyle}>
          <MoodFace width={faceSize} height={faceSize} />
        </Animated.View>
        <Typography
          variant="body-02"
          weight="medium"
          className="text-center"
          style={{ color: COLORS.text.body.default }}
        >
          {label}
        </Typography>
      </Animated.View>
    </Pressable>
  );
}

function MoodStep({
  childName,
  mood,
  onSelect,
  onNext,
}: {
  childName: string;
  mood: RecordMood | null;
  onSelect: (m: RecordMood) => void;
  onNext: () => void;
}) {
  return (
    <View className="flex-1">
      <ScrollView
        contentContainerStyle={{
          paddingTop: s(12),
          paddingHorizontal: s(16),
          paddingBottom: s(24),
        }}
      >
        <Typography
          variant="headline-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {`오늘 ${childName}의 기분이\n어땠나요?`}
        </Typography>

        {/* 3열 그리드 — 카드 109 + gap 8이 좌우 16 패딩 안에 정확히 맞는다 */}
        <View
          className="flex-row flex-wrap"
          style={{ marginTop: s(28), gap: s(8) }}
        >
          {MOODS.map((item) => (
            <MoodCard
              key={item.value}
              label={item.label}
              icon={MOOD_ICON[item.value]}
              selected={mood === item.value}
              onPress={() => onSelect(item.value)}
            />
          ))}
        </View>
      </ScrollView>

      {/* 시안(287:2632)의 상단 그림자는 뺐다 — 그리드가 뷰포트에 다 들어와
          가릴 콘텐츠가 없다(profile-form과 동일 판정) */}
      <View
        style={{
          paddingHorizontal: s(16),
          paddingTop: s(16),
          paddingBottom: s(16),
        }}
      >
        <Button label="다음" size="xl" disabled={!mood} onPress={onNext} />
      </View>
    </View>
  );
}

/**
 * 본문·개인 메모 입력 텍스트 — Body_02/Reading-Regular.
 * TextInput은 Typography로 못 감싸서 같은 토큰을 스타일 객체로 받아 쓴다.
 */
const TEXTAREA_TEXT = getTypographyStyle('body-02-reading');

function BodyStep({
  occurredAt,
  mood,
  body,
  privateMemo,
  onChangeBody,
  onChangePrivateMemo,
  onPrev,
  onSubmit,
  submitting,
}: {
  occurredAt: Date;
  mood: RecordMood | null;
  body: string;
  privateMemo: string;
  onChangeBody: (v: string) => void;
  onChangePrivateMemo: (v: string) => void;
  onPrev: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const router = useRouter();
  const MoodFace = mood ? MOOD_ICON[mood] : null;

  return (
    <View className="flex-1">
      <KeyboardAwareScrollView
        contentContainerStyle={{
          paddingHorizontal: s(16),
          paddingBottom: s(40),
          rowGap: s(24),
        }}
        bottomOffset={s(24)}
        keyboardShouldPersistTaps="handled"
      >
        <Typography
          variant="headline-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {'기억하고 싶은 내용을\n자유롭게 작성해주세요'}
        </Typography>

        <View style={{ rowGap: s(15) }}>
          <WritingTipCard />

          {/* 날짜 헤더 + 본문이 한 카드 — 시안 303:2734 */}
          <View
            className="overflow-hidden bg-surface"
            style={{
              borderRadius: s(16),
              borderWidth: 1,
              borderColor: COLORS.border.default,
            }}
          >
            <View
              className="flex-row items-center"
              style={{
                padding: s(16),
                columnGap: s(10),
                borderBottomWidth: 1,
                borderBottomColor: COLORS.border.default,
              }}
            >
              <View
                className="flex-1 flex-row flex-wrap items-center"
                style={{ columnGap: s(4) }}
              >
                {/* 시안의 "오후 14:00"은 24시제·오후가 겹친 오류라 12시제로 적는다
                    (기록-기획안-v1.md §3-3) */}
                <Typography
                  variant="body-02"
                  weight="medium"
                  style={{ color: COLORS.text.body.strong }}
                >
                  {format(occurredAt, 'yyyy년 M월 d일 EEEE', { locale: ko })}
                </Typography>
                <Typography
                  variant="body-03"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  {format(occurredAt, 'a h:mm', { locale: ko })}
                </Typography>
              </View>
              {MoodFace ? <MoodFace width={s(28)} height={s(28)} /> : null}
            </View>

            <TextInput
              value={body}
              onChangeText={onChangeBody}
              placeholder="한 줄이어도 괜찮아요"
              placeholderTextColor={COLORS.text.placeholder}
              multiline
              style={{
                ...TEXTAREA_TEXT,
                height: s(307),
                paddingHorizontal: s(12),
                paddingVertical: s(8),
                textAlignVertical: 'top',
                color: COLORS.text.body.strong,
              }}
            />
          </View>
        </View>

        <View style={{ rowGap: s(12) }}>
          <SectionTitle
            title="개인 메모"
            description="나만 확인할 수 있는 메모에요"
            icon={<LockIcon20 width={s(20)} height={s(20)} />}
          />
          <TextInput
            value={privateMemo}
            onChangeText={onChangePrivateMemo}
            placeholder="나에게 남기는 메모"
            placeholderTextColor={COLORS.text.placeholder}
            multiline
            className="bg-surface"
            style={{
              ...TEXTAREA_TEXT,
              height: s(80),
              paddingHorizontal: s(12),
              paddingVertical: s(8),
              borderRadius: s(12),
              borderWidth: 1,
              borderColor: COLORS.border.default,
              textAlignVertical: 'top',
              color: COLORS.text.body.strong,
            }}
          />
        </View>

        <View style={{ rowGap: s(16) }}>
          <SectionTitle
            title="파일 첨부"
            description="상황을 잘 보여주는 사진이나 영상을 첨부해 보세요."
          />
          {/* 촬영 가이드까지만 연결돼 있다 — 실제 선택·업로드는 expo-image-picker
              (네이티브 재빌드) + presigned 업로드 클라이언트가 선행이다 */}
          <Button
            label="첨부하기"
            variant="assistive"
            size="lg"
            onPress={() => router.push('/(main)/record-capture-guide')}
          />
          <Typography
            variant="body-03"
            className="text-center"
            style={{ marginTop: -s(8), color: COLORS.text.caption.subtle }}
          >
            지금은 촬영 가이드만 볼 수 있어요
          </Typography>
        </View>
      </KeyboardAwareScrollView>

      <View
        className="flex-row"
        style={{
          paddingHorizontal: s(16),
          paddingTop: s(16),
          paddingBottom: s(16),
          columnGap: s(8),
        }}
      >
        <View style={{ width: s(100) }}>
          <Button label="이전" variant="assistive" size="xl" onPress={onPrev} />
        </View>
        <View className="flex-1">
          <Button
            label="등록하기"
            size="xl"
            loading={submitting}
            onPress={onSubmit}
          />
        </View>
      </View>
    </View>
  );
}

/** 섹션 제목 + 보조 설명 — 시안 Title 컴포넌트(374:2173) */
function SectionTitle({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <View style={{ rowGap: s(8) }}>
      <View className="flex-row items-center" style={{ columnGap: s(4) }}>
        {icon}
        <Typography
          variant="body-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {title}
        </Typography>
      </View>
      <Typography variant="body-03" style={{ color: COLORS.text.body.subtle }}>
        {description}
      </Typography>
    </View>
  );
}

/** 작성 가이드 아코디언 — 시안 287:2708(접힌 상태 기본, 기획안 §3-3) */
function WritingTipCard() {
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  const toggle = () => {
    progress.value = withTiming(open ? 0 : 1, { duration: 180 });
    setOpen((v) => !v);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={toggle}
    >
      {/* 펼칠 때 카드 높이가 튀지 않게 layout 트랜지션으로 이어 준다 */}
      <Animated.View
        layout={LinearTransition.duration(200)}
        style={{
          padding: s(16),
          rowGap: s(12),
          borderRadius: s(12),
          borderWidth: 1,
          borderColor: COLORS.border.tip,
          backgroundColor: COLORS.surface,
        }}
      >
        <View className="flex-row items-center justify-between">
          <View
            className="flex-1 flex-row items-center"
            style={{ columnGap: s(4) }}
          >
            <TipIcon20 width={s(20)} height={s(20)} />
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.text.title.default }}
            >
              이렇게 적으면 상담에 도움이 돼요
            </Typography>
          </View>
          <Animated.View style={chevronStyle}>
            <ArrowDownIcon20 width={s(20)} height={s(20)} />
          </Animated.View>
        </View>

        {open ? (
          <Animated.View
            style={{ rowGap: s(8) }}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
          >
            {RECORD_WRITING_TIPS.map((tip) => (
              <View key={tip} className="flex-row" style={{ columnGap: s(6) }}>
                <Typography
                  variant="body-03"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  ·
                </Typography>
                <Typography
                  variant="body-03"
                  className="flex-1"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  {tip}
                </Typography>
              </View>
            ))}
          </Animated.View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
