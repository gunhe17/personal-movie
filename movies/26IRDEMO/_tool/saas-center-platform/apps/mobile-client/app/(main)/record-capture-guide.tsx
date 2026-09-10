/**
 * 촬영 가이드 — 시안 374:2188. 기록 작성의 [첨부하기]에서 들어온다.
 *
 * 레이아웃은 시안, 문구는 기획 정본(features/records/constants.ts CAPTURE_GUIDE 주석):
 * 시안 예시가 결핍 프레임(상처·떼쓰기·다툼)이라 §17-2 중립 12상황으로 바꾸고,
 * 시안에 없던 안전 지침 5를 상시 노출로 덧붙였다.
 *
 * "다시 표시 안할게요"는 §17-2대로 **상황 예시에만** 걸린다 — 체크해도 형식 카드와
 * 안전 지침은 계속 보이고, 다음 진입 때 12상황만 접힌 채로 열린다.
 *
 * ⚠️ [확인했어요]는 아직 작성 화면으로 되돌아가기만 한다 — 실제 사진·영상 선택은
 * expo-image-picker(네이티브 재빌드) + presigned 업로드 클라이언트가 선행이다.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { CAPTURE_GUIDE } from '@/features/records';
import { Button, Checkbox, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import ArrowLeftIcon24 from '@assets/icons/24/ArrowLeftIcon24.svg';

/** 상황 예시 접기 여부 — 안전 지침은 대상이 아니라 키 이름도 예시로 한정한다 */
const HIDE_EXAMPLES_KEY = 'record_capture_guide_examples_hidden';

/** 형식 카드 헤더 틴트 — 일러스트 카드 고유색이라 토큰 없이 둔다(시안 375:2711) */
const CARD_HEADER_BG = '#DDF3FF';

export default function RecordCaptureGuideScreen() {
  const router = useRouter();
  /** 체크박스 = 다음 진입 때의 기본값(저장) / expanded = 지금 화면의 펼침(일시) */
  const [hidePref, setHidePref] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_EXAMPLES_KEY).then((v) => {
      if (v !== '1') return;
      setHidePref(true);
      setExpanded(false);
    });
  }, []);

  const toggleHide = useCallback((next: boolean) => {
    setHidePref(next);
    setExpanded(!next);
    AsyncStorage.setItem(HIDE_EXAMPLES_KEY, next ? '1' : '0');
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-12 flex-row items-center px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <ArrowLeftIcon24 width={24} height={24} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: s(16),
          paddingHorizontal: s(16),
          paddingBottom: s(24),
          rowGap: s(24),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ rowGap: s(8) }}>
          <Typography
            variant="headline-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
          >
            {CAPTURE_GUIDE.title}
          </Typography>
          <Typography
            variant="body-02"
            style={{ color: COLORS.text.body.subtle }}
          >
            {CAPTURE_GUIDE.description}
          </Typography>
        </View>

        <View
          className="flex-row"
          style={{ columnGap: s(12), marginTop: s(28) }}
        >
          {CAPTURE_GUIDE.formats.map((format) => (
            <FormatCard key={format.key} format={format} />
          ))}
        </View>

        <Animated.View layout={LinearTransition.duration(200)}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((v) => !v)}
          >
            <View
              className="flex-row items-center justify-between"
              style={{ marginBottom: s(12) }}
            >
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                이런 순간이 도움이 돼요
              </Typography>
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.text.state.brand }}
              >
                {expanded ? '접기' : '펼치기'}
              </Typography>
            </View>
          </Pressable>

          {expanded ? (
            <Animated.View
              className="flex-row flex-wrap"
              style={{ gap: s(8) }}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
            >
              {CAPTURE_GUIDE.situations.map((situation) => (
                <View
                  key={situation}
                  className="bg-surface"
                  style={{
                    paddingHorizontal: s(12),
                    paddingVertical: s(7),
                    borderRadius: s(17),
                    borderWidth: 1,
                    borderColor: COLORS.border.subtle,
                  }}
                >
                  <Typography
                    variant="body-03"
                    style={{ color: COLORS.text.body.default }}
                  >
                    {situation}
                  </Typography>
                </View>
              ))}
            </Animated.View>
          ) : null}
        </Animated.View>

        {/* 안전 지침은 접기 대상이 아니다(§17-2 "가이드 하단 상시") */}
        <View style={{ rowGap: s(12) }}>
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.title.default }}
          >
            찍기 전에 꼭 봐주세요
          </Typography>
          <View
            className="bg-surface"
            style={{
              padding: s(16),
              rowGap: s(8),
              borderRadius: s(12),
              borderWidth: 1,
              borderColor: COLORS.border.subtle,
            }}
          >
            {CAPTURE_GUIDE.safety.map((rule) => (
              <View key={rule} className="flex-row" style={{ columnGap: s(6) }}>
                <Typography
                  variant="body-02-reading"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  ·
                </Typography>
                <Typography
                  variant="body-02-reading"
                  className="flex-1"
                  style={{ color: COLORS.text.body.default }}
                >
                  {rule}
                </Typography>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: s(16),
          paddingTop: s(16),
          paddingBottom: s(16),
          rowGap: s(16),
        }}
      >
        <View
          className="flex-row items-center justify-center"
          style={{ columnGap: s(4) }}
        >
          <Checkbox checked={hidePref} onChange={toggleHide} />
          <Pressable onPress={() => toggleHide(!hidePref)} hitSlop={8}>
            <Typography
              variant="body-02"
              style={{ color: COLORS.text.body.default }}
            >
              상황 예시는 다시 표시 안할게요
            </Typography>
          </Pressable>
        </View>
        <Button label="확인했어요" size="xl" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

/** 형식 카드 — 헤더(라벨 + 오른쪽으로 흘러넘치는 일러스트) + 설명·분량(시안 378:2723) */
function FormatCard({
  format,
}: {
  format: (typeof CAPTURE_GUIDE.formats)[number];
}) {
  const Illustration = format.icon;

  return (
    <View
      className="flex-1 overflow-hidden bg-surface"
      style={{
        borderRadius: s(12),
        borderWidth: 1,
        borderColor: COLORS.border.subtle,
      }}
    >
      <View
        style={{
          height: s(86),
          backgroundColor: CARD_HEADER_BG,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border.subtle,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: s(74),
            top: s(20),
          }}
        >
          <Illustration width={s(90)} height={s(90)} />
        </View>
        <View
          className="justify-center"
          style={{ position: 'absolute', left: s(14), top: 0, bottom: 0 }}
        >
          <Typography
            variant="body-01"
            weight="semibold"
            style={{ color: COLORS.text.body.default }}
          >
            {format.label}
          </Typography>
        </View>
      </View>

      <View style={{ padding: s(16), rowGap: s(8) }}>
        <Typography
          variant="body-02-reading"
          style={{ color: COLORS.text.body.default }}
        >
          {format.lead}
          <Typography
            variant="body-02-reading"
            weight="medium"
            style={{ color: COLORS.text.title.default }}
          >
            {format.emphasis}
          </Typography>
          {format.tail}
        </Typography>
        <Typography
          variant="body-03"
          style={{ color: COLORS.text.state.brand }}
        >
          {format.hint}
        </Typography>
      </View>
    </View>
  );
}
