import React from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import {
  BOKJIRO_URL,
  useVoucherCatalog,
  VOUCHER_GUIDANCE_NOTE,
} from '@/features/voucher';
import {
  Badge,
  Button,
  EmptyView,
  ErrorView,
  LoadingView,
  Typography,
} from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { useRefreshControl } from '@/shared/hooks/useRefreshControl';

/** 모집 시작·마감은 서버 `date` 타입(달력상의 날짜)이라 KST 변환 대상이 아니다 */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, 'yyyy.M.d');
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-3 rounded-xl bg-surface p-4">
      <Typography
        variant="body-02"
        weight="semibold"
        style={{ color: COLORS.text.title.default }}
      >
        {label}
      </Typography>
      {children}
    </View>
  );
}

function BodyText({ text }: { text: string }) {
  return (
    <Typography
      variant="body-03"
      className="mt-2"
      style={{ color: COLORS.text.body.default }}
    >
      {text}
    </Typography>
  );
}

/** 지원 제도 상세 — 제도 정보만(보유 바우처 잔여는 센터 연동 후 별도 표면) */
export default function VoucherDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const catalogQuery = useVoucherCatalog();
  const refreshControl = useRefreshControl(() => catalogQuery.refetch());
  const program = catalogQuery.data?.find((item) => item.id === id);

  const applyStart = formatDate(program?.application_start_date ?? null);
  const applyEnd = formatDate(program?.application_end_date ?? null);
  const applyPeriod =
    applyStart && applyEnd ? `${applyStart} ~ ${applyEnd}` : (applyStart ?? applyEnd);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="h-[52px] flex-row items-center px-4">
        {router.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
          </Pressable>
        ) : null}
      </View>

      {catalogQuery.isLoading ? (
        <LoadingView className="flex-1" />
      ) : catalogQuery.isError ? (
        <ErrorView className="flex-1" onRetry={() => catalogQuery.refetch()} />
      ) : !program ? (
        <View className="flex-1 justify-center">
          <EmptyView
            title="제도 정보를 찾지 못했어요"
            description="목록에서 다시 선택해 주세요"
          />
        </View>
      ) : (
        <ScrollView
          refreshControl={refreshControl}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingTop: s(4), paddingBottom: s(40) }}
        >
          <View className="flex-row items-center">
            <Typography
              variant="body-03"
              style={{ color: COLORS.text.caption.default, marginRight: 8 }}
            >
              {program.program_organization} · {program.program_name}
            </Typography>
            <Badge label={`${program.program_year}년`} color="green" />
          </View>
          <Typography
            variant="headline-01"
            weight="semibold"
            className="mt-2"
            style={{ color: COLORS.text.headline }}
          >
            {program.name}
          </Typography>

          <View className="mt-6">
            {program.support_amount_text || program.support_scope ? (
              <Section label="이런 지원을 받아요">
                {program.support_amount_text ? (
                  <Typography
                    variant="title-01"
                    weight="semibold"
                    className="mt-2"
                    style={{ color: COLORS.text.title.default }}
                  >
                    {program.support_amount_text}
                  </Typography>
                ) : null}
                {program.support_scope ? <BodyText text={program.support_scope} /> : null}
              </Section>
            ) : null}

            {program.support_target ? (
              <Section label="누가 받을 수 있나요">
                <BodyText text={program.support_target} />
              </Section>
            ) : null}

            {program.application_method || applyPeriod ? (
              <Section label="어떻게 신청하나요">
                {program.application_method ? (
                  <BodyText text={program.application_method} />
                ) : null}
                {applyPeriod ? (
                  <Typography
                    variant="body-03"
                    className="mt-1.5"
                    style={{ color: COLORS.text.caption.default }}
                  >
                    신청 기간 · {applyPeriod}
                  </Typography>
                ) : null}
              </Section>
            ) : null}

            {program.contact ? (
              <Section label="문의">
                <BodyText text={program.contact} />
              </Section>
            ) : null}
          </View>

          <Button
            label="복지로에서 확인하기"
            variant="assistive"
            onPress={() => Linking.openURL(BOKJIRO_URL)}
            className="mt-6"
          />
          <Typography
            variant="body-03"
            className="mt-3"
            style={{ color: COLORS.text.caption.subtle }}
          >
            {VOUCHER_GUIDANCE_NOTE}
          </Typography>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
