/**
 * [홈] 구성 재정리 — 미연동 플로우 / 연동 섹션 (LAB, mock 전용)
 *
 * 미연동(2026-08-10 기획 변경) = 섹션 나열을 버리고 **한 플로우**로:
 *   ① 아이 정보 입력 → ② 자격 문항 → ③ 받을 수 있는 지원 → ④ 쓸 수 있는 센터
 * 바우처 소식·내 주변 센터·치료 카드·육아 이야기는 홈에서 제거(플로우 안으로 흡수).
 *
 * 입력값은 실제 매칭 로직(`matchVouchers`)에 그대로 물려 있다 — 답변을 바꾸면
 * 결과 카드의 신청 가능 / 확인 필요 / 대상 아님이 진짜로 바뀐다(자격 문항 설계 검증용).
 * 제도 목록·센터는 mock. 입력은 저장하지 않는다(자가진단과 동일 원칙).
 *
 * 연동은 아직 섹션 취사선택 단계 — 스위치로 켜고 끄며 무엇을 남길지 본다.
 * 확정 시 `(tabs)/_components/UnlinkedHome.tsx` · `LinkedHome.tsx`에 반영.
 */
import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Badge, Button, Chip, Tabs, Toggle, Typography } from '@/shared/components/ui';
import {
  ageFromBirthDate,
  matchVouchers,
  VOUCHER_GUIDANCE_NOTE,
  type EvidenceAnswer,
  type IncomeAnswer,
  type VoucherProgram,
} from '@/features/voucher';
import { COLORS, RADIUS, SHADOWS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { nowKst } from '@/shared/utils/date';
import PinIcon16 from '@assets/icons/16/PinIcon16.svg';
import PersonIcon16 from '@assets/icons/16/PersonIcon16.svg';
import SpotIcon16 from '@assets/icons/16/SpotIcon16.svg';

type Branch = 'linked' | 'unlinked';

/** 미연동 플로우 — 홈이 이 상태를 그대로 반영한다(입력도 홈 안의 단계). */
type FlowStep = 'start' | 'childForm' | 'eligibility' | 'result' | 'center';

const ACCENT = COLORS.button.primary.bg;
const ACCENT_TINT = COLORS.blue[50];

const noop = () => {};

// ───────────────────────── 입력값 ─────────────────────────

type DisabilityAnswer = 'yes' | 'no';

interface FlowAnswers {
  name: string;
  birthDate: string;
  gender: 'female' | 'male' | null;
  /** 지역 지원사업·센터 추천의 기준 — 시/도 단위로 제도가 갈린다 */
  sido: string;
  sigungu: string;
  income: IncomeAnswer | null;
  evidence: EvidenceAnswer | null;
  /** 장애 등록(복지카드) — 등록 아동 전용 지원사업의 열쇠 */
  disability: DisabilityAnswer | null;
}

const INITIAL_ANSWERS: FlowAnswers = {
  name: '하윤',
  birthDate: '2021-04-12',
  gender: 'female',
  sido: '서울특별시',
  sigungu: '마포구',
  income: null,
  evidence: null,
  disability: null,
};

// ───────────────────────── mock 제도 ─────────────────────────

/** 지역·장애등록 조건은 서버 eligibility에 없는 축이라 mock 래퍼가 들고 있는다. */
interface MockProgram {
  program: VoucherProgram;
  amount: string;
  /** 지정 시 해당 시/도에서만 노출 */
  sido?: string;
  /** true = 장애 등록 아동 전용 */
  requiresDisability?: boolean;
}

const program = (
  id: string,
  name: string,
  org: string,
  eligibility: VoucherProgram['eligibility'],
): VoucherProgram => ({
  id,
  name,
  program_name: name,
  program_organization: org,
  program_year: 2026,
  application_method: null,
  application_start_date: null,
  application_end_date: null,
  support_amount_text: null,
  support_scope: null,
  support_target: null,
  contact: null,
  eligibility,
});

const MOCK_PROGRAMS: MockProgram[] = [
  {
    program: program('v1', '발달재활서비스 바우처', '보건복지부', {
      min_age: 0,
      max_age: 17,
      income_max_pct: 180,
      need_evidence: true,
    }),
    amount: '월 최대 22만원',
  },
  {
    program: program('v2', '아동·청소년 심리지원 서비스', '보건복지부', {
      min_age: 0,
      max_age: 18,
      income_max_pct: 160,
      need_evidence: false,
    }),
    amount: '월 최대 16만원',
  },
  {
    program: program('v3', '서울시 아동 심리치료 지원', '서울특별시', {
      min_age: 3,
      max_age: 12,
      income_max_pct: null,
      need_evidence: true,
    }),
    amount: '회기당 3만원',
    sido: '서울특별시',
  },
  {
    program: program('v4', '장애아동 재활치료 지원', '보건복지부', {
      min_age: 0,
      max_age: 17,
      income_max_pct: null,
      need_evidence: false,
    }),
    amount: '월 최대 14만원',
    requiresDisability: true,
  },
];

/** ④ 센터 — 취급 바우처 정보는 현재 API에 없음(더미). */
const VOUCHER_CENTERS = [
  {
    key: 'c1',
    name: '서울행복한마음센터',
    region: '서울 마포구',
    distance: '2.1km',
    tags: ['발달재활 바우처', '놀이치료'],
    image: require('@assets/images/home/center-1.png'),
  },
  {
    key: 'c2',
    name: '마음숲심리상담센터',
    region: '서울 마포구',
    distance: '3.4km',
    tags: ['발달재활 바우처', '언어치료'],
    image: require('@assets/images/home/center-2.png'),
  },
] as const;

// ───────────────────────── 연동: 섹션 취사선택 ─────────────────────────

type Source = 'live' | 'dummy' | 'new';

const SOURCE_META: Record<Source, { label: string; color: 'green' | 'gray' | 'blue' }> = {
  live: { label: '실데이터', color: 'green' },
  dummy: { label: '더미', color: 'gray' },
  new: { label: '신규 제안', color: 'blue' },
};

interface SectionMeta {
  key: string;
  label: string;
  source: Source;
  note: string;
}

const LINKED_SECTIONS: SectionMeta[] = [
  { key: 'hero', label: '히어로 (캐릭터·인사)', source: 'live', note: '오늘 일정 유무로 말풍선' },
  { key: 'schedule', label: '다가오는 일정', source: 'live', note: '앱의 본 목적' },
  { key: 'record', label: '오늘 하루 기록', source: 'live', note: '기록 탭 유도' },
  { key: 'voucherBanner', label: '바우처 배너', source: 'live', note: '바우처 화면 유도' },
  { key: 'therapy', label: '우리 아이에게 필요한 치료는?', source: 'dummy', note: '탐색 콘텐츠 — 미연동 성격' },
  { key: 'articles', label: '알면 달라지는 육아 이야기', source: 'dummy', note: '콘텐츠 시스템 없음' },
];

type Selection = Record<string, boolean>;

const fromKeys = (all: SectionMeta[], on: string[]): Selection =>
  Object.fromEntries(all.map((section) => [section.key, on.includes(section.key)]));

const LINKED_PRESETS = {
  current: fromKeys(LINKED_SECTIONS, [
    'hero',
    'schedule',
    'record',
    'voucherBanner',
    'therapy',
    'articles',
  ]),
  proposed: fromKeys(LINKED_SECTIONS, ['hero', 'schedule', 'record', 'voucherBanner']),
};

const sameSelection = (a: Selection, b: Selection) =>
  Object.keys(b).every((key) => Boolean(a[key]) === Boolean(b[key]));

const MOCK_SCHEDULES = [
  {
    key: 'sc1',
    badge: 'D-1',
    color: 'green' as const,
    title: '놀이치료 3회기',
    date: '2026. 08. 11 (화)',
    time: '15:00 - 15:50',
    child: '김하윤',
    center: '서울행복한마음센터',
  },
  {
    key: 'sc2',
    badge: 'D-4',
    color: 'teal' as const,
    title: 'HTP 검사',
    date: '2026. 08. 14 (금)',
    time: '10:00 - 11:00',
    child: '김하윤',
    center: '서울행복한마음센터',
  },
];

const THERAPY_CARDS = [
  {
    key: 'play',
    subtitle: '놀이로 마음 읽기',
    title: '놀이치료',
    bg: '#E8F2F3',
    image: require('@assets/images/home/therapy-play.png'),
  },
  {
    key: 'art',
    subtitle: '말 대신 그림으로',
    title: '미술치료',
    bg: '#E6F8DB',
    image: require('@assets/images/home/therapy-art.png'),
  },
  {
    key: 'adhd',
    subtitle: '집중이 어려운 이유',
    title: 'ADHD',
    bg: '#FFE5FF',
    image: null,
  },
] as const;

const ARTICLES = [
  {
    key: 'a1',
    title: '엄마가 아닌 나로 살았던 시간',
    description: '엄마라는 이름 말고, 나로 살았던 시간 기억 나시나요?',
    image: require('@assets/images/home/article-1.png'),
  },
  {
    key: 'a2',
    title: '우리 아이가 말을 하지 않을 때',
    description: '엄마라는 이름 말고, 나로 살았던 시간 기억 나시나요?',
    image: require('@assets/images/home/article-2.png'),
  },
] as const;

// ───────────────────────── 공용 조각 ─────────────────────────

function PreviewSectionTitle({ label }: { label: string }) {
  return (
    <Typography
      variant="title-01"
      weight="semibold"
      className="px-4"
      style={{ color: COLORS.text.title.default }}
    >
      {label}
    </Typography>
  );
}

function TherapyRow() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-3"
      contentContainerStyle={{ paddingHorizontal: 16, columnGap: 12 }}
    >
      {THERAPY_CARDS.map((card) => (
        <View
          key={card.key}
          className="overflow-hidden rounded-2xl p-4"
          style={{ width: s(143), height: s(154), backgroundColor: card.bg }}
        >
          <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[700] }}>
            {card.subtitle}
          </Typography>
          <Typography
            variant="body-01"
            weight="semibold"
            className="mt-1"
            style={{ color: COLORS.text.title.default }}
          >
            {card.title}
          </Typography>
          {card.image ? (
            <Image
              source={card.image}
              style={{ position: 'absolute', right: 6, bottom: 5, width: s(72), height: s(72) }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

function ArticleRow() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-3"
      contentContainerStyle={{ paddingHorizontal: 16, columnGap: 12 }}
    >
      {ARTICLES.map((article) => (
        <View key={article.key} style={{ width: s(179) }}>
          <Image
            source={article.image}
            style={{ width: '100%', height: s(126), borderRadius: 12 }}
            resizeMode="cover"
          />
          <Typography
            variant="body-02"
            weight="semibold"
            className="mt-2.5"
            numberOfLines={1}
            style={{ color: COLORS.text.title.default }}
          >
            {article.title}
          </Typography>
          <Typography
            variant="body-03"
            className="mt-0.5"
            numberOfLines={2}
            style={{ color: COLORS.gray[700] }}
          >
            {article.description}
          </Typography>
        </View>
      ))}
    </ScrollView>
  );
}

function InviteCodeExit() {
  return (
    <View className="mt-8 items-center px-4">
      <Typography variant="body-03" style={{ color: COLORS.text.body.subtle }}>
        이미 다니는 센터가 있나요?
      </Typography>
      <Typography variant="body-03" weight="semibold" className="mt-1" style={{ color: ACCENT }}>
        초대 코드 입력하기
      </Typography>
    </View>
  );
}

/** 폼 필드 — 라벨 + 값 상자(입력·선택 공용 껍데기). */
function Field({
  label,
  value,
  placeholder,
  chevron = false,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  chevron?: boolean;
}) {
  const filled = Boolean(value);
  return (
    <View className="mt-4">
      <Typography variant="body-03" weight="medium" style={{ color: COLORS.text.title.subtle }}>
        {label}
      </Typography>
      <View
        className="mt-2 flex-row items-center bg-surface px-4"
        style={{
          height: s(48),
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: COLORS.border.default,
        }}
      >
        <Typography
          variant="body-02"
          className="flex-1"
          // 값 없음(고스트)은 gray-400 — 인라인 style로만 먹는다
          style={{ color: filled ? COLORS.text.title.default : COLORS.gray[400] }}
        >
          {filled ? value : placeholder}
        </Typography>
        {chevron ? (
          <Ionicons name="chevron-down" size={s(18)} color={COLORS.gray[400]} />
        ) : null}
      </View>
    </View>
  );
}

/** 문항 선택지 — 라디오 행(선택 시 액센트 테두리 + 체크). */
function OptionRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        className="mt-2 flex-row items-center bg-surface px-4 py-3"
        style={{
          borderRadius: RADIUS.lg,
          borderWidth: 1,
          borderColor: selected ? ACCENT : COLORS.border.default,
          backgroundColor: selected ? ACCENT_TINT : COLORS.surface,
          columnGap: 8,
        }}
      >
        <View className="flex-1">
          <Typography
            variant="body-02"
            weight={selected ? 'semibold' : 'regular'}
            style={{ color: COLORS.text.title.default }}
          >
            {label}
          </Typography>
          {hint ? (
            <Typography
              variant="body-03"
              className="mt-0.5"
              style={{ color: COLORS.text.body.subtle }}
            >
              {hint}
            </Typography>
          ) : null}
        </View>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={s(20)}
          color={selected ? ACCENT : COLORS.gray[300]}
        />
      </View>
    </Pressable>
  );
}

function QuestionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Typography variant="body-01" weight="semibold" style={{ color: COLORS.text.title.default }}>
        {title}
      </Typography>
      {children}
    </View>
  );
}

// ───────────────────────── 미연동: 플로우 ─────────────────────────

const FLOW_LABELS: { key: FlowStep; label: string }[] = [
  { key: 'childForm', label: '아이 정보' },
  { key: 'eligibility', label: '자격 확인' },
  { key: 'result', label: '받는 지원' },
  { key: 'center', label: '이용 센터' },
];

/** 홈 상단 상시 노출 — "지금 어디, 다음 뭐"가 미연동 홈의 뼈대. */
function FlowSteps({ current }: { current: FlowStep }) {
  const currentIndex = FLOW_LABELS.findIndex((step) => step.key === current);

  return (
    <View className="mx-4 mt-4 flex-row items-start">
      {FLOW_LABELS.map((step, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;
        const circleBg = done ? ACCENT_TINT : active ? ACCENT : COLORS.gray[100];

        return (
          <React.Fragment key={step.key}>
            {i > 0 ? (
              <View
                style={{
                  flex: 1,
                  height: 1,
                  marginTop: s(13),
                  backgroundColor: done || active ? ACCENT : COLORS.border.default,
                }}
              />
            ) : null}
            <View className="items-center" style={{ width: s(64) }}>
              <View
                className="items-center justify-center rounded-full"
                style={{ width: s(26), height: s(26), backgroundColor: circleBg }}
              >
                {done ? (
                  <Ionicons name="checkmark" size={s(16)} color={ACCENT} />
                ) : (
                  <Typography
                    variant="label-02"
                    weight="semibold"
                    style={{ color: active ? COLORS.white : COLORS.gray[400] }}
                  >
                    {i + 1}
                  </Typography>
                )}
              </View>
              <Typography
                variant="label-02"
                weight={active ? 'semibold' : 'regular'}
                className="mt-1.5 text-center"
                style={{ color: active ? COLORS.text.title.default : COLORS.text.body.subtle }}
              >
                {step.label}
              </Typography>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

/** 입력 화면 공통 껍데기 — 뒤로 + 진행바(N/2) + 본문 + 하단 CTA. */
function FormShell({
  stepIndex,
  title,
  description,
  ctaLabel,
  ctaDisabled,
  onBack,
  onNext,
  children,
}: {
  stepIndex: 1 | 2;
  title: string;
  description: string;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onBack: () => void;
  onNext: () => void;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-surface pb-6">
      <View className="h-12 flex-row items-center px-4">
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <View className="flex-1" />
        <Typography variant="body-03" weight="medium" style={{ color: COLORS.text.body.subtle }}>
          {stepIndex}/2
        </Typography>
      </View>

      {/* 진행바 — 입력이 몇 걸음인지 먼저 보여준다(이탈 방지) */}
      <View className="mx-4 flex-row" style={{ columnGap: 4 }}>
        {[1, 2].map((n) => (
          <View
            key={n}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: n <= stepIndex ? ACCENT : COLORS.gray[100],
            }}
          />
        ))}
      </View>

      <View className="px-4 pt-6">
        <Typography
          variant="headline-02"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          {title}
        </Typography>
        <Typography variant="body-02" className="mt-2" style={{ color: COLORS.text.body.default }}>
          {description}
        </Typography>

        {children}

        <Button
          label={ctaLabel}
          size="xl"
          disabled={ctaDisabled}
          onPress={onNext}
          className="mt-8"
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    </View>
  );
}

/** 스텝 3·4 상단 — 입력값 요약(플로우의 입력이 계속 보인다). */
function AnswerSummaryRow({ answers, ageText }: { answers: FlowAnswers; ageText: string }) {
  return (
    <View
      className="mx-4 mt-4 flex-row items-center rounded-xl px-3 py-3"
      style={{ backgroundColor: COLORS.bg['surface-sunken'], columnGap: 8 }}
    >
      <View
        className="items-center justify-center rounded-full"
        style={{ width: s(28), height: s(28), backgroundColor: ACCENT_TINT }}
      >
        <PersonIcon16 width={14} height={16} />
      </View>
      <Typography
        variant="body-03"
        weight="medium"
        className="flex-1"
        numberOfLines={1}
        style={{ color: COLORS.text.title.default }}
      >
        {`${answers.name} · ${ageText} · ${answers.sigungu}`}
      </Typography>
      <Typography variant="body-03" weight="medium" style={{ color: ACCENT }}>
        수정
      </Typography>
    </View>
  );
}

const STATUS_META = {
  ok: { label: '신청 가능', color: 'green' as const },
  pending: { label: '확인 필요', color: 'orange' as const },
  blocked: { label: '대상 아님', color: 'gray' as const },
};

const BLOCK_REASON: Record<string, string> = {
  age: '연령 조건에서 벗어나요',
  income: '소득 기준을 넘어요',
  no_rule: '기준이 공개되지 않았어요',
};

// ───────────────────────── 연동 섹션 미리보기 ─────────────────────────

function LinkedSection({ sectionKey }: { sectionKey: string }) {
  const today = nowKst();

  switch (sectionKey) {
    case 'hero':
      return (
        <View className="items-center bg-surface pb-6">
          <View style={{ width: s(160), height: s(218), marginTop: s(16) }}>
            <Image
              source={require('@assets/images/home/hero-character.png')}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
            <View style={{ position: 'absolute', top: s(20), right: -s(40) }}>
              <View
                className="rounded-lg px-2 py-1.5"
                style={{ backgroundColor: COLORS.gray[800] }}
              >
                <Typography
                  variant="label-01"
                  weight="medium"
                  style={{ color: COLORS.text.state['on-primary'] }}
                >
                  오늘 상담 일정이 있어요!
                </Typography>
              </View>
            </View>
          </View>
          <Typography variant="body-02" className="mt-4" style={{ color: COLORS.text.body.default }}>
            {format(today, 'yyyy년 M월 d일 EEEE', { locale: ko })}
          </Typography>
          <Typography
            variant="headline-01"
            weight="semibold"
            className="mt-1 text-center"
            style={{ color: COLORS.gray[900] }}
          >
            {'하윤님, 오늘도\n좋은 하루 보내세요!'}
          </Typography>
        </View>
      );

    case 'schedule':
      return (
        <View className="mt-6">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: s(8), columnGap: 12 }}
          >
            {MOCK_SCHEDULES.map((schedule) => (
              <View
                key={schedule.key}
                className="rounded-[20px] bg-surface p-4"
                style={[{ width: s(160) }, SHADOWS.card]}
              >
                <View className="flex-row">
                  <Badge shape="rect" label={schedule.badge} color={schedule.color} />
                </View>
                <Typography
                  variant="body-01"
                  weight="semibold"
                  className="mt-1.5"
                  numberOfLines={1}
                  style={{ color: COLORS.gray[900] }}
                >
                  {schedule.title}
                </Typography>
                <Typography
                  variant="body-03"
                  weight="medium"
                  className="mt-2"
                  style={{ color: COLORS.gray[700] }}
                >
                  {schedule.date}
                </Typography>
                <Typography variant="body-03" weight="medium" style={{ color: COLORS.gray[700] }}>
                  {schedule.time}
                </Typography>
                <View className="mt-4 gap-1">
                  <View className="flex-row items-center" style={{ columnGap: 2 }}>
                    <PersonIcon16 width={12} height={14} />
                    <Typography variant="body-03" style={{ color: COLORS.gray[600] }}>
                      {schedule.child}
                    </Typography>
                  </View>
                  <View className="flex-row items-center" style={{ columnGap: 2 }}>
                    <SpotIcon16 width={16} height={16} />
                    <Typography
                      variant="body-03"
                      numberOfLines={1}
                      className="flex-1"
                      style={{ color: COLORS.gray[600] }}
                    >
                      {schedule.center}
                    </Typography>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      );

    case 'record':
      return (
        <View
          className="mx-4 mt-4 rounded-2xl bg-surface p-4"
          style={{ borderWidth: 1, borderColor: '#D5F8E0' }}
        >
          <View className="flex-row items-center" style={{ columnGap: 12 }}>
            <View className="flex-1">
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                오늘 하루는 어땠나요?
              </Typography>
              <Typography
                variant="body-02-reading"
                className="mt-1"
                style={{ color: COLORS.text.body.default }}
              >
                남겨주신 내용을 바탕으로 다음 상담이 진행돼요.
              </Typography>
            </View>
            <Image
              source={require('@assets/images/home/diary-note.png')}
              style={{ width: s(64), height: s(64), transform: [{ scaleX: -1 }] }}
              resizeMode="contain"
            />
          </View>
          <Button label="기록하기" size="lg" className="mt-4" onPress={noop} />
        </View>
      );

    case 'voucherBanner':
      return (
        <View className="mx-4 mt-4">
          <LinearGradient
            colors={['#0070BA', '#4DB6FD']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ borderRadius: 16, padding: 16, overflow: 'hidden' }}
          >
            <Typography variant="body-01" weight="semibold" style={{ color: COLORS.white }}>
              받을 수 있는 지원, 놓치지 마세요
            </Typography>
            <Typography variant="body-02" className="mt-1" style={{ color: COLORS.white }}>
              나에게 알맞는 바우처는?
            </Typography>
            <Image
              source={require('@assets/images/home/voucher-wallet.png')}
              style={{ position: 'absolute', right: s(6), top: s(2), width: s(94), height: s(94) }}
              resizeMode="contain"
            />
          </LinearGradient>
        </View>
      );

    case 'therapy':
      return (
        <View className="mt-8 bg-surface pb-6 pt-6">
          <PreviewSectionTitle label="우리 아이에게 필요한 치료는?" />
          <TherapyRow />
        </View>
      );

    case 'articles':
      return (
        <View className="bg-surface pb-8">
          <PreviewSectionTitle label="알면 달라지는 육아 이야기" />
          <ArticleRow />
        </View>
      );

    default:
      return null;
  }
}

// ───────────────────────── 화면 ─────────────────────────

export default function HomeRestructureLab() {
  const router = useRouter();
  const [branch, setBranch] = useState<Branch>('unlinked');
  const [step, setStep] = useState<FlowStep>('start');
  const [answers, setAnswers] = useState<FlowAnswers>(INITIAL_ANSWERS);
  const [linkedSel, setLinkedSel] = useState<Selection>(LINKED_PRESETS.proposed);

  const patch = (next: Partial<FlowAnswers>) => setAnswers({ ...answers, ...next });

  const age = ageFromBirthDate(answers.birthDate);
  const ageText = age === null ? '나이 미상' : `만 ${age}세`;

  // 실제 매칭 로직에 그대로 물린다 — 답변을 바꾸면 결과가 진짜로 바뀐다
  const matches = useMemo(() => {
    const pool = MOCK_PROGRAMS.filter(
      (mock) =>
        (!mock.sido || mock.sido === answers.sido) &&
        (!mock.requiresDisability || answers.disability === 'yes'),
    );
    const amountById = new Map(pool.map((mock) => [mock.program.id, mock.amount]));
    return matchVouchers(
      { income: answers.income, evidence: answers.evidence },
      age,
      pool.map((mock) => mock.program),
    ).map((match) => ({ ...match, amount: amountById.get(match.program.id) ?? '' }));
  }, [answers, age]);

  const available = matches.filter((match) => match.status !== 'blocked');
  const blocked = matches.filter((match) => match.status === 'blocked');
  const topVoucherName = available[0]?.program.name ?? '발달재활서비스 바우처';

  const linkedPreset = useMemo(() => {
    if (sameSelection(linkedSel, LINKED_PRESETS.proposed)) return 'proposed';
    if (sameSelection(linkedSel, LINKED_PRESETS.current)) return 'current';
    return 'custom';
  }, [linkedSel]);

  const visibleLinked = LINKED_SECTIONS.filter((section) => linkedSel[section.key]);
  const cutLinked = LINKED_SECTIONS.filter((section) => !linkedSel[section.key]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="h-[52px] flex-row items-center px-4" style={{ columnGap: 4 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.gray[900]} />
        </Pressable>
        <Typography
          variant="title-01"
          weight="semibold"
          style={{ color: COLORS.text.title.default }}
        >
          홈 구성 재정리
        </Typography>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: s(48) }}>
        <View className="px-4">
          <Tabs<Branch>
            value={branch}
            onChange={setBranch}
            options={[
              { value: 'unlinked', label: '미연동' },
              { value: 'linked', label: '연동' },
            ]}
          />
        </View>

        {branch === 'unlinked' ? (
          <>
            <View className="mx-4 mt-4 rounded-2xl bg-surface p-4">
              <Typography
                variant="body-02"
                weight="medium"
                style={{ color: COLORS.text.title.default }}
              >
                아이 정보 → 자격 확인 → 받는 지원 → 센터 추천
              </Typography>
              <Typography
                variant="body-03"
                className="mt-1"
                style={{ color: COLORS.text.body.subtle }}
              >
                미리보기 안의 버튼으로 직접 걸어볼 수 있고, 칩으로 단계를 건너뛸 수도 있다.
                자격 문항의 답을 바꾸면 결과 카드의 판정이 실제로 바뀐다(실제 매칭 로직 연결).
              </Typography>
              <View className="mt-3 flex-row flex-wrap" style={{ gap: 8 }}>
                <Chip label="시작" selected={step === 'start'} onPress={() => setStep('start')} />
                <Chip
                  label="① 아이 정보"
                  selected={step === 'childForm'}
                  onPress={() => setStep('childForm')}
                />
                <Chip
                  label="② 자격 확인"
                  selected={step === 'eligibility'}
                  onPress={() => setStep('eligibility')}
                />
                <Chip
                  label="③ 지원 결과"
                  selected={step === 'result'}
                  onPress={() => setStep('result')}
                />
                <Chip
                  label="④ 센터 추천"
                  selected={step === 'center'}
                  onPress={() => setStep('center')}
                />
              </View>
              {step === 'result' || step === 'center' ? (
                <Pressable onPress={() => setAnswers(INITIAL_ANSWERS)} className="mt-3">
                  <Typography variant="body-03" weight="medium" style={{ color: ACCENT }}>
                    답변 초기화
                  </Typography>
                </Pressable>
              ) : null}
            </View>

            <View className="mt-8 px-4">
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                미리보기
              </Typography>
              <Typography
                variant="body-03"
                className="mt-1"
                style={{ color: COLORS.text.body.subtle }}
              >
                센터 미연동 · 게스트 상태
              </Typography>
            </View>

            <View
              className="mx-4 mt-3 overflow-hidden rounded-2xl"
              style={{
                borderWidth: 1,
                borderColor: COLORS.border.default,
                backgroundColor: COLORS.bg.base,
              }}
            >
              {/* 입력 두 화면은 홈 헤더 대신 폼 헤더를 쓴다(플로우 안의 하위 화면) */}
              {step === 'childForm' ? (
                <FormShell
                  stepIndex={1}
                  title={'아이 정보를 알려주세요'}
                  description={'지원 대상과 금액은 나이·지역에 따라 달라져요'}
                  ctaLabel="다음"
                  onBack={() => setStep('start')}
                  onNext={() => setStep('eligibility')}
                >
                  <Field label="이름 (선택)" value={answers.name} placeholder="아이 이름" />
                  <Field label="생년월일" value="2021. 04. 12" chevron />
                  <View className="mt-4">
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: COLORS.text.title.subtle }}
                    >
                      성별
                    </Typography>
                    <View className="mt-2 flex-row" style={{ columnGap: 8 }}>
                      <Chip
                        label="여아"
                        selected={answers.gender === 'female'}
                        onPress={() => patch({ gender: 'female' })}
                      />
                      <Chip
                        label="남아"
                        selected={answers.gender === 'male'}
                        onPress={() => patch({ gender: 'male' })}
                      />
                    </View>
                  </View>
                  <Field
                    label="거주 지역"
                    value={`${answers.sido} ${answers.sigungu}`}
                    chevron
                  />
                  <View
                    className="mt-4 flex-row rounded-xl px-3 py-3"
                    style={{ backgroundColor: COLORS.bg['surface-sunken'], columnGap: 6 }}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={s(16)}
                      color={COLORS.gray[500]}
                    />
                    <Typography
                      variant="body-03"
                      className="flex-1"
                      style={{ color: COLORS.text.body.subtle }}
                    >
                      지역에 따라 받을 수 있는 지원 사업이 달라요. 시/군/구까지 알려주시면
                      이용 가능한 센터도 함께 찾아드려요.
                    </Typography>
                  </View>
                </FormShell>
              ) : step === 'eligibility' ? (
                <FormShell
                  stepIndex={2}
                  title={'지원 자격 확인을 위해\n3가지만 더 여쭤볼게요'}
                  description={'모르면 "잘 모르겠어요"로 넘어가도 결과를 볼 수 있어요'}
                  ctaLabel="받을 수 있는 지원 보기"
                  onBack={() => setStep('childForm')}
                  onNext={() => setStep('result')}
                >
                  <QuestionBlock title="가구 소득이 기준 중위소득 180% 이하인가요?">
                    <OptionRow
                      label="네, 이하예요"
                      selected={answers.income === 'under'}
                      onPress={() => patch({ income: 'under' })}
                    />
                    <OptionRow
                      label="아니요, 초과해요"
                      selected={answers.income === 'over'}
                      onPress={() => patch({ income: 'over' })}
                    />
                    <OptionRow
                      label="잘 모르겠어요"
                      hint="소득 기준이 있는 지원은 '확인 필요'로 안내해드려요"
                      selected={answers.income === 'unknown'}
                      onPress={() => patch({ income: 'unknown' })}
                    />
                  </QuestionBlock>

                  <QuestionBlock title="진단서나 검사 결과가 있나요?">
                    <OptionRow
                      label="있어요"
                      hint="발달재활 서비스 의뢰서·심리검사 결과 등"
                      selected={answers.evidence === 'yes'}
                      onPress={() => patch({ evidence: 'yes' })}
                    />
                    <OptionRow
                      label="아직 없어요"
                      selected={answers.evidence === 'no'}
                      onPress={() => patch({ evidence: 'no' })}
                    />
                  </QuestionBlock>

                  <QuestionBlock title="장애 등록(복지카드)이 되어 있나요?">
                    <OptionRow
                      label="등록되어 있어요"
                      hint="등록 아동만 받을 수 있는 지원이 따로 있어요"
                      selected={answers.disability === 'yes'}
                      onPress={() => patch({ disability: 'yes' })}
                    />
                    <OptionRow
                      label="아니요"
                      selected={answers.disability === 'no'}
                      onPress={() => patch({ disability: 'no' })}
                    />
                  </QuestionBlock>

                  <Typography
                    variant="body-03"
                    className="mt-6"
                    style={{ color: COLORS.text.body.subtle }}
                  >
                    답변은 저장하지 않아요 — 지원 목록을 걸러내는 데만 써요.
                  </Typography>
                </FormShell>
              ) : (
                <>
                  <View className="h-12 flex-row items-center px-4">
                    <Typography
                      variant="title-01"
                      weight="semibold"
                      style={{ color: COLORS.text.title.default }}
                    >
                      마인드스코프
                    </Typography>
                    <View className="flex-1" />
                    <Ionicons name="notifications-outline" size={24} color={COLORS.gray[900]} />
                  </View>

                  <View className="pb-2">
                    <FlowSteps current={step} />

                    {step === 'start' ? (
                      <>
                        {/* 홈의 메인 자리를 아이 등록 하나가 차지한다 */}
                        <View
                          className="mx-4 mt-4 items-center rounded-2xl bg-surface px-5 pb-5 pt-6"
                          style={SHADOWS.card}
                        >
                          <Image
                            source={require('@assets/images/home/hero-voucher.png')}
                            style={{ width: s(124), height: s(124) }}
                            resizeMode="contain"
                          />
                          <Typography
                            variant="headline-02"
                            weight="semibold"
                            className="mt-4 text-center"
                            style={{ color: COLORS.text.title.default }}
                          >
                            {'우리 아이가 받을 수 있는 지원,\n1분이면 확인해요'}
                          </Typography>
                          <Typography
                            variant="body-02"
                            className="mt-2 text-center"
                            style={{ color: COLORS.text.body.default }}
                          >
                            {'생년월일과 지역만 알려주시면 바우처부터\n이용 가능한 센터까지 찾아드려요'}
                          </Typography>
                          <Button
                            label="아이 정보 입력하기"
                            size="xl"
                            onPress={() => setStep('childForm')}
                            className="mt-6"
                            style={{ alignSelf: 'stretch' }}
                          />
                          <Typography
                            variant="label-01"
                            className="mt-3 text-center"
                            style={{ color: COLORS.text.body.subtle }}
                          >
                            가입 없이 확인할 수 있어요
                          </Typography>
                        </View>

                        <View className="mx-4 mt-4 rounded-2xl bg-surface px-4 py-2">
                          {[
                            {
                              key: 'v',
                              icon: 'ticket-outline',
                              label: '받을 수 있는 바우처·지원 사업',
                            },
                            {
                              key: 'c',
                              icon: 'business-outline',
                              label: '그 지원을 쓸 수 있는 주변 센터',
                            },
                          ].map((row, i) => (
                            <View
                              key={row.key}
                              className="flex-row items-center py-3"
                              style={
                                i > 0
                                  ? {
                                      borderTopWidth: 1,
                                      borderTopColor: COLORS.border.subtle,
                                      columnGap: 10,
                                    }
                                  : { columnGap: 10 }
                              }
                            >
                              <View
                                className="items-center justify-center"
                                style={{
                                  width: s(32),
                                  height: s(32),
                                  borderRadius: RADIUS.sm,
                                  backgroundColor: COLORS.bg['surface-sunken'],
                                }}
                              >
                                <Ionicons
                                  name={
                                    row.icon as React.ComponentProps<typeof Ionicons>['name']
                                  }
                                  size={s(18)}
                                  color={COLORS.icon.secondary}
                                />
                              </View>
                              <Typography
                                variant="body-03"
                                className="flex-1"
                                style={{ color: COLORS.text.body.default }}
                              >
                                {row.label}
                              </Typography>
                              <Ionicons
                                name="lock-closed"
                                size={s(14)}
                                color={COLORS.gray[400]}
                              />
                            </View>
                          ))}
                        </View>
                      </>
                    ) : null}

                    {step === 'result' ? (
                      <>
                        <AnswerSummaryRow answers={answers} ageText={ageText} />

                        <View className="mt-6 px-4">
                          <Typography
                            variant="headline-02"
                            weight="semibold"
                            style={{ color: COLORS.text.title.default }}
                          >
                            {available.length > 0
                              ? `${answers.name}이가 받을 수 있는\n지원 ${available.length}건을 찾았어요`
                              : '조건에 맞는 지원을\n아직 찾지 못했어요'}
                          </Typography>
                          <Typography
                            variant="body-02"
                            className="mt-2"
                            style={{ color: COLORS.text.body.default }}
                          >
                            {VOUCHER_GUIDANCE_NOTE}
                          </Typography>
                        </View>

                        <View className="mx-4 mt-4" style={{ rowGap: 12 }}>
                          {available.map((match) => (
                            <View
                              key={match.program.id}
                              className="rounded-2xl bg-surface p-4"
                              style={SHADOWS.card}
                            >
                              <View className="flex-row items-start" style={{ columnGap: 8 }}>
                                <View className="flex-1">
                                  <Typography
                                    variant="body-01"
                                    weight="semibold"
                                    style={{ color: COLORS.text.title.default }}
                                  >
                                    {match.program.name}
                                  </Typography>
                                  <Typography
                                    variant="body-03"
                                    className="mt-1"
                                    style={{ color: COLORS.text.body.default }}
                                  >
                                    {`${match.program.program_organization} · ${match.amount}`}
                                  </Typography>
                                </View>
                                <Badge
                                  shape="rect"
                                  label={STATUS_META[match.status].label}
                                  color={STATUS_META[match.status].color}
                                />
                              </View>

                              <View
                                className="mt-3 flex-row items-center rounded-lg px-3 py-2"
                                style={{
                                  backgroundColor: COLORS.bg['surface-sunken'],
                                  columnGap: 6,
                                }}
                              >
                                <Ionicons
                                  name={
                                    match.status === 'ok'
                                      ? 'checkmark-circle'
                                      : 'information-circle-outline'
                                  }
                                  size={s(16)}
                                  color={
                                    match.status === 'ok'
                                      ? COLORS.status.success
                                      : COLORS.gray[500]
                                  }
                                />
                                <Typography
                                  variant="body-03"
                                  className="flex-1"
                                  style={{ color: COLORS.text.body.default }}
                                >
                                  {match.status === 'ok'
                                    ? `${ageText} · 입력하신 조건을 충족해요`
                                    : `${match.pending.join(' · ')} 확인이 필요해요`}
                                </Typography>
                              </View>

                              {/* ③→④ 연결 — 바우처 카드가 센터 추천으로 가는 문 */}
                              <Button
                                label="이 지원 쓰는 센터 보기"
                                variant="outline"
                                size="lg"
                                className="mt-3"
                                onPress={() => setStep('center')}
                              />
                            </View>
                          ))}

                          {blocked.length > 0 ? (
                            <View
                              className="rounded-2xl px-4 py-3"
                              style={{ backgroundColor: COLORS.bg['surface-sunken'] }}
                            >
                              <Typography
                                variant="body-03"
                                weight="medium"
                                style={{ color: COLORS.text.body.subtle }}
                              >
                                {`대상이 아닌 지원 ${blocked.length}건`}
                              </Typography>
                              {blocked.map((match) => (
                                <Typography
                                  key={match.program.id}
                                  variant="body-03"
                                  className="mt-1"
                                  style={{ color: COLORS.gray[400] }}
                                >
                                  {`${match.program.name} — ${
                                    BLOCK_REASON[match.reason ?? 'no_rule']
                                  }`}
                                </Typography>
                              ))}
                            </View>
                          ) : null}
                        </View>

                        {/* 미응답 문항이 남아 있으면 되돌아갈 길을 준다 */}
                        {answers.income === null ||
                        answers.evidence === null ||
                        answers.disability === null ? (
                          <Pressable onPress={() => setStep('eligibility')}>
                            <View
                              className="mx-4 mt-4 flex-row items-center rounded-2xl px-4 py-3"
                              style={{ backgroundColor: ACCENT_TINT, columnGap: 8 }}
                            >
                              <Ionicons name="help-circle-outline" size={s(20)} color={ACCENT} />
                              <Typography
                                variant="body-03"
                                className="flex-1"
                                style={{ color: COLORS.text.body.default }}
                              >
                                답하지 않은 문항이 있어요 — 채우면 더 정확해져요
                              </Typography>
                              <Typography
                                variant="body-03"
                                weight="semibold"
                                style={{ color: ACCENT }}
                              >
                                이어서
                              </Typography>
                            </View>
                          </Pressable>
                        ) : null}
                      </>
                    ) : null}

                    {step === 'center' ? (
                      <>
                        <AnswerSummaryRow answers={answers} ageText={ageText} />

                        <View className="mx-4 mt-3 rounded-2xl bg-surface p-4" style={SHADOWS.card}>
                          <View className="flex-row items-center" style={{ columnGap: 8 }}>
                            <Badge shape="rect" label="선택한 지원" color="blue" />
                            <Typography
                              variant="body-01"
                              weight="semibold"
                              className="flex-1"
                              numberOfLines={1}
                              style={{ color: COLORS.text.title.default }}
                            >
                              {topVoucherName}
                            </Typography>
                            <Pressable onPress={() => setStep('result')} hitSlop={8}>
                              <Typography
                                variant="body-03"
                                weight="medium"
                                style={{ color: ACCENT }}
                              >
                                변경
                              </Typography>
                            </Pressable>
                          </View>
                        </View>

                        <View className="mt-6 px-4">
                          <Typography
                            variant="headline-02"
                            weight="semibold"
                            style={{ color: COLORS.text.title.default }}
                          >
                            {'이 지원을 쓸 수 있는\n주변 센터예요'}
                          </Typography>
                          <Typography
                            variant="body-02"
                            className="mt-2"
                            style={{ color: COLORS.text.body.default }}
                          >
                            {`${answers.sido} ${answers.sigungu} 기준 · 가까운 순`}
                          </Typography>
                        </View>

                        <View className="mx-4 mt-4" style={{ rowGap: 12 }}>
                          {VOUCHER_CENTERS.map((center) => (
                            <View
                              key={center.key}
                              className="rounded-2xl bg-surface p-4"
                              style={SHADOWS.card}
                            >
                              <View className="flex-row items-center" style={{ columnGap: 12 }}>
                                <Image
                                  source={center.image}
                                  style={{ width: 46, height: 46, borderRadius: 23 }}
                                />
                                <View className="flex-1">
                                  <Typography
                                    variant="body-01"
                                    weight="semibold"
                                    numberOfLines={1}
                                    style={{ color: COLORS.text.title.default }}
                                  >
                                    {center.name}
                                  </Typography>
                                  <View
                                    className="mt-1 flex-row items-center"
                                    style={{ columnGap: 6 }}
                                  >
                                    <View
                                      className="flex-row items-center"
                                      style={{ columnGap: 2 }}
                                    >
                                      <PinIcon16 width={16} height={16} />
                                      <Typography
                                        variant="body-03"
                                        style={{ color: COLORS.gray[600] }}
                                      >
                                        {center.region}
                                      </Typography>
                                    </View>
                                    <View
                                      style={{
                                        width: 1,
                                        height: 12,
                                        backgroundColor: COLORS.border.default,
                                      }}
                                    />
                                    <Typography
                                      variant="body-03"
                                      style={{ color: COLORS.gray[600] }}
                                    >
                                      {center.distance}
                                    </Typography>
                                  </View>
                                </View>
                              </View>
                              <View className="mt-3 flex-row" style={{ columnGap: 6 }}>
                                {center.tags.map((tag) => (
                                  <Badge key={tag} label={tag} color="blue" />
                                ))}
                              </View>
                              <View className="mt-3 flex-row" style={{ columnGap: 8 }}>
                                <View className="flex-1">
                                  <Button
                                    label="전화 문의"
                                    variant="outline"
                                    size="lg"
                                    onPress={noop}
                                  />
                                </View>
                                <View className="flex-1">
                                  <Button label="센터 보기" size="lg" onPress={noop} />
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>

                        <View className="mx-4 mt-3">
                          <Button
                            label="지도에서 보기"
                            variant="assistive"
                            size="lg"
                            onPress={noop}
                          />
                        </View>
                      </>
                    ) : null}

                    <InviteCodeExit />
                  </View>
                </>
              )}

              <View style={{ height: s(24) }} />
            </View>
          </>
        ) : (
          <>
            {/* 연동은 아직 취사선택 단계 */}
            <View className="mt-4 flex-row px-4" style={{ columnGap: 8 }}>
              <Chip
                label="현행"
                selected={linkedPreset === 'current'}
                onPress={() => setLinkedSel(LINKED_PRESETS.current)}
              />
              <Chip
                label="정리안"
                selected={linkedPreset === 'proposed'}
                onPress={() => setLinkedSel(LINKED_PRESETS.proposed)}
              />
              {linkedPreset === 'custom' ? (
                <View className="justify-center">
                  <Typography variant="body-03" style={{ color: COLORS.text.body.subtle }}>
                    직접 조합 중
                  </Typography>
                </View>
              ) : null}
            </View>

            <View className="mx-4 mt-4 rounded-2xl bg-surface px-4">
              {LINKED_SECTIONS.map((section, i) => (
                <View
                  key={section.key}
                  className="flex-row items-center py-4"
                  style={
                    i > 0
                      ? { borderTopWidth: 1, borderTopColor: COLORS.border.subtle, columnGap: 12 }
                      : { columnGap: 12 }
                  }
                >
                  <View className="flex-1">
                    <View className="flex-row items-center" style={{ columnGap: 6 }}>
                      <Typography
                        variant="body-02"
                        weight="medium"
                        style={{ color: COLORS.text.title.default }}
                      >
                        {section.label}
                      </Typography>
                      <Badge
                        shape="rect"
                        label={SOURCE_META[section.source].label}
                        color={SOURCE_META[section.source].color}
                      />
                    </View>
                    <Typography
                      variant="body-03"
                      className="mt-1"
                      style={{ color: COLORS.text.body.subtle }}
                    >
                      {section.note}
                    </Typography>
                  </View>
                  <Toggle
                    value={Boolean(linkedSel[section.key])}
                    onValueChange={(next) => setLinkedSel({ ...linkedSel, [section.key]: next })}
                  />
                </View>
              ))}
            </View>

            <View className="mx-4 mt-3">
              <Typography variant="body-03" style={{ color: COLORS.text.body.subtle }}>
                {cutLinked.length === 0
                  ? '쳐낸 섹션 없음 — 지금은 전부 노출'
                  : `쳐냄 ${cutLinked.length}개 · ${cutLinked.map((section) => section.label).join(', ')}`}
              </Typography>
            </View>

            <View className="mt-8 px-4">
              <Typography
                variant="body-01"
                weight="semibold"
                style={{ color: COLORS.text.title.default }}
              >
                미리보기
              </Typography>
              <Typography
                variant="body-03"
                className="mt-1"
                style={{ color: COLORS.text.body.subtle }}
              >
                센터 연동 완료 상태
              </Typography>
            </View>

            <View
              className="mx-4 mt-3 overflow-hidden rounded-2xl"
              style={{
                borderWidth: 1,
                borderColor: COLORS.border.default,
                backgroundColor: COLORS.bg.base,
              }}
            >
              <View className="h-12 flex-row items-center bg-surface px-4">
                <Typography
                  variant="title-01"
                  weight="semibold"
                  style={{ color: COLORS.text.title.default }}
                >
                  마인드스코프
                </Typography>
                <View className="flex-1" />
                <Ionicons name="notifications-outline" size={24} color={COLORS.gray[900]} />
              </View>

              {visibleLinked.length === 0 ? (
                <View className="items-center justify-center" style={{ paddingVertical: s(64) }}>
                  <Typography variant="body-02" style={{ color: COLORS.text.body.subtle }}>
                    켜진 섹션이 없어요
                  </Typography>
                </View>
              ) : (
                <View className="pb-6">
                  {visibleLinked.map((section) => (
                    <LinkedSection key={section.key} sectionKey={section.key} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
