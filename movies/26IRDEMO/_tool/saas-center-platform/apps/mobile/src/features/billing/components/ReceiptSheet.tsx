import { useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Typography } from '@/shared/components/ui/Typography';
import { GenderAgeMeta } from '@/shared/components/ui/GenderAgeMeta';
import { BadgeRound } from '@/shared/components/ui/BadgeRound';
import { Icon } from '@/shared/components/icons';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { parseDate } from '@/shared/utils/date';
import { useBillableDetail } from '../hooks';
import {
  BILLABLE_STATUS_LABELS,
  BILLABLE_STATUS_PALETTE,
  billingItemIconBg,
} from '../constants';
import type {
  BillableDetail,
  BillableStatus,
  BillableSummary,
} from '../types';
import {
  ClientAvatar,
  genderToLabel,
  computeAge,
} from '../clientDisplay';

/**
 * 영수증 시트 — 완납(paid) 청구를 영수증처럼 보여주는 조회 전용 모달.
 * 딤 오버레이(검정 50%) 위에 영수증 카드가 떠 있고, 뒤의 목록이 비쳐 보인다.
 * 카드 위/아래는 둥근 반원(절취선)으로 깎여 그 사이로 오버레이가 드러난다.
 * 데이터는 BillableDetailSheet와 동일 훅(useBillableDetail)으로 조회.
 */
interface ReceiptSheetProps {
  visible: boolean;
  onClose: () => void;
  centerId: string | null;
  billableId: string | null;
  /** 목록 요약 — 성별/나이/프로필/프로그램 보강용 (BillableDetail에 없음) */
  summary?: BillableSummary | null;
}

const OVERLAY = '#00000080'; // 딤 오버레이 (검정 50%) — 뒤 목록이 비쳐 보임
const SCALLOP_BUMP = 8; // 반원(스캘럽) 지름
const SCALLOP_GAP = 4; // 반원 사이 평평한 간격 — 반원끼리 붙지 않게 띄움
const SCALLOP_INSET = 2; // 반원 꼭대기 ↔ 본문 경계 사이 흰색 여백 — 반원이 경계선에 닿아 생기는 가로선 제거

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_MARGIN = 20;
const CARD_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;

function fmtDate(v?: string | null) {
  if (!v) return '-';
  try {
    return format(parseDate(v), 'yyyy년 M월 d일', { locale: ko });
  } catch {
    return v;
  }
}

function deriveProgram(
  summary: BillableSummary | null | undefined,
  detail: BillableDetail | undefined,
): string | null {
  if (summary?.item_summary) return summary.item_summary;
  const items = detail?.items ?? [];
  if (items.length === 0) return null;
  if (items.length === 1) return items[0].description;
  return `${items[0].description} 외 ${items.length - 1}건`;
}

/**
 * 절취선(스캘럽) 가장자리 — 흰 카드 가장자리를 "같은 방향 반원"으로 깎는다.
 * 교대 물결(뾰족한 톱니)이 아니라 둥근 반원을 이어 붙인 영수증 절취선.
 * 흰색(카드 쪽)만 채우고 반원 안쪽은 투명 → 뒤 딤 오버레이가 반원으로 비친다.
 */
function NotchEdge({ edge }: { edge: 'top' | 'bottom' }) {
  const w = CARD_WIDTH;
  const period = SCALLOP_BUMP + SCALLOP_GAP; // 반원 + 간격 한 주기
  const segs = Math.max(2, Math.round(w / period));
  const step = w / segs; // 폭에 정확히 맞춘 한 주기
  const bump = SCALLOP_BUMP; // 반원 지름(고정)
  const r = bump / 2; // 반지름
  const h = r + SCALLOP_INSET; // 스트립 높이 = 반지름 + 본문쪽 흰색 여백(반원이 이음새에 안 닿게)
  const lead = (step - bump) / 2; // 주기 내 좌우 평평 여백(반원 가운데 정렬)

  // 평평한 간격 사이에 같은 방향 반원을 찍어 → 떨어진 둥근 스캘럽.
  let d: string;
  if (edge === 'top') {
    // 윗변: 반원이 아래로 볼록하게 패이고 흰색은 아래(본문)를 채운다.
    d = `M 0,0`;
    for (let i = 0; i < segs; i++) {
      const x = i * step + lead;
      d += ` L ${x},0 a ${r},${r} 0 0,0 ${bump},0`;
    }
    d += ` L ${w},0 L ${w},${h} L 0,${h} Z`;
  } else {
    // 아랫변: 반원이 위로 볼록하게 패이고 흰색은 위(본문)를 채운다.
    d = `M 0,${h}`;
    for (let i = 0; i < segs; i++) {
      const x = i * step + lead;
      d += ` L ${x},${h} a ${r},${r} 0 0,1 ${bump},0`;
    }
    d += ` L ${w},${h} L ${w},0 L 0,0 Z`;
  }

  // 본문(흰 View)과 1px 겹쳐 이음새 틈으로 딤이 새는 가로선 제거.
  return (
    <Svg
      width={w}
      height={h}
      style={edge === 'top' ? { marginBottom: -1 } : { marginTop: -1 }}
    >
      <Path d={d} fill={COLORS.surface} />
    </Svg>
  );
}

function AmountRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  /** 미수금 — 금액을 status/danger 색으로 */
  danger?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      {/* 라벨 — body-03 medium / body/default */}
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.text.body.default }}
      >
        {label}
      </Typography>
      {/* 금액 — Title_02(18/26) semibold / body/strong (미수금만 status/danger) */}
      <Typography
        variant="title-01"
        weight="semibold"
        style={{ color: danger ? COLORS.error : COLORS.text.body.strong }}
      >
        {value.toLocaleString()}원
      </Typography>
    </View>
  );
}

export function ReceiptSheet({
  visible,
  onClose,
  centerId,
  billableId,
  summary,
}: ReceiptSheetProps) {
  const insets = useSafeAreaInsets();
  const { data: detail, isLoading } = useBillableDetail(
    visible ? centerId : null,
    visible ? billableId : null,
  );

  const status = detail?.status as BillableStatus | undefined;
  const palette = status ? BILLABLE_STATUS_PALETTE[status] : null;

  const clientName = summary?.client_name ?? detail?.client_name ?? '내담자';
  const genderLabel = genderToLabel(summary?.client_gender);
  const age = computeAge(summary?.client_birth_date);
  const program = deriveProgram(summary, detail);
  const avatarSeed = summary?.client_id ?? detail?.client_id ?? clientName;

  const items = detail?.items ?? [];
  const memo = useMemo(() => detail?.memo?.trim() || null, [detail]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* 딤 오버레이 — 뒤 목록이 비쳐 보임 */}
      <View style={{ flex: 1, backgroundColor: OVERLAY }}>
        {/* 빈 영역 탭 시 닫기 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {isLoading || !detail ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color={COLORS.white} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: insets.top + s(40),
              // 카드 ↔ X버튼 간격 28: 버튼 윗변(insets.bottom + 24+44=68) + 28 = 96
              paddingBottom: insets.bottom + s(96),
            }}
            showsVerticalScrollIndicator={false}
          >
            {/* 영수증 카드 — 위/아래 톱니 절취 */}
            <View style={{ width: CARD_WIDTH }}>
              <NotchEdge edge="top" />
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  paddingHorizontal: s(20),
                  // ① 내용 → 카드 가장자리 여백: 상단 24 / 하단 40
                  paddingTop: s(24),
                  paddingBottom: s(40),
                  gap: s(20),
                }}
              >
                {/* 내담자 헤더 */}
                <View className="flex-row items-center" style={{ gap: s(12) }}>
                  <ClientAvatar
                    name={clientName}
                    imageUrl={summary?.client_profile_image_url ?? null}
                    seed={avatarSeed}
                  />
                  <View style={{ flex: 1, gap: s(3) }}>
                    <View className="flex-row items-center" style={{ gap: s(6) }}>
                      <Typography
                        variant="body-01"
                        weight="semibold"
                        className="text-gray-900"
                        numberOfLines={1}
                        style={{ flexShrink: 1 }}
                      >
                        {clientName}
                      </Typography>
                      <GenderAgeMeta genderLabel={genderLabel} age={age} />
                    </View>
                    {program && (
                      <Typography
                        variant="body-03"
                        weight="medium"
                        className="text-gray-600"
                        numberOfLines={1}
                      >
                        {program}
                      </Typography>
                    )}
                  </View>
                  {status && palette && (
                    <BadgeRound bg={palette.bg} color={palette.color}>
                      {BILLABLE_STATUS_LABELS[status]}
                    </BadgeRound>
                  )}
                </View>

                {/* 청구 항목 */}
                <View style={{ gap: s(12) }}>
                  <Typography
                    variant="body-03"
                    weight="medium"
                    style={{ color: COLORS.text.title.subtle }}
                  >
                    청구 항목 ({items.length}건)
                  </Typography>
                  <View style={{ gap: s(14) }}>
                    {items.map((item) => (
                      <View
                        key={item.id}
                        className="flex-row items-center"
                        style={{ gap: s(10) }}
                      >
                        <View
                          style={{
                            width: s(36),
                            height: s(36),
                            borderRadius: s(10),
                            backgroundColor: billingItemIconBg(item.related_type),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon
                            name={
                              item.related_type?.startsWith('assessment')
                                ? 'assessment-20'
                                : 'counseling-20'
                            }
                            size={s(20)}
                          />
                        </View>
                        <View className="flex-1" style={{ gap: s(2) }}>
                          <Typography
                            variant="body-02"
                            weight="semibold"
                            numberOfLines={1}
                            style={{ color: COLORS.text.body.strong }}
                          >
                            {item.description}
                          </Typography>
                          <Typography
                            variant="body-03"
                            weight="regular"
                            style={{ color: COLORS.text.body.default }}
                          >
                            {item.quantity}개 × {item.unit_price.toLocaleString()}원
                          </Typography>
                        </View>
                        <Typography
                          variant="title-01"
                          weight="semibold"
                          style={{ color: COLORS.text.body.strong }}
                        >
                          {item.amount.toLocaleString()}원
                        </Typography>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 금액 요약 */}
                <View>
                  <DashedLine />
                  <View style={{ paddingVertical: s(24), gap: s(10) }}>
                    <AmountRow label="총액" value={detail.total_amount} />
                    <AmountRow label="납부액" value={detail.paid_amount} />
                  </View>
                  <DashedLine />
                  <View style={{ paddingTop: s(24) }}>
                    <AmountRow label="미수금" value={detail.unpaid_amount} danger />
                  </View>
                </View>

                {/* 청구일 / 발행일 */}
                <View>
                  {/* 미수금 ↔ 청구일 구분 — 실선, border/heavy(gray-900) */}
                  <View style={{ height: 1, backgroundColor: COLORS.border.heavy }} />
                  <View style={{ paddingTop: s(24), gap: s(8) }}>
                    <InfoRow label="청구일" value={fmtDate(detail.billable_date)} />
                    <InfoRow label="발행일" value={fmtDate(detail.issued_at)} />
                  </View>
                </View>

                {/* 메모 */}
                {memo && (
                  <View style={{ gap: s(8) }}>
                    <Typography variant="body-02" weight="semibold" className="text-gray-900">
                      메모
                    </Typography>
                    <View
                      style={{
                        backgroundColor: COLORS.gray[50],
                        borderRadius: s(12),
                        paddingHorizontal: s(14),
                        paddingVertical: s(12),
                      }}
                    >
                      <Typography variant="body-02-reading" className="text-gray-700">
                        {memo}
                      </Typography>
                    </View>
                  </View>
                )}
              </View>
              <NotchEdge edge="bottom" />
            </View>
          </ScrollView>
        )}

        {/* 하단 플로팅 닫기 */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          style={{
            position: 'absolute',
            bottom: insets.bottom + s(24),
            alignSelf: 'center',
            width: s(44),
            height: s(44),
            borderRadius: s(22),
            // 다크 오버레이 위 글래스 버튼 — 흰색 12%
            backgroundColor: 'rgba(255,255,255,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={24} color={COLORS.icon.inverse} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/** 절취선 느낌의 점선 구분 (gray-200) */
function DashedLine() {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: COLORS.gray[200],
        borderStyle: 'dashed',
      }}
    />
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Typography variant="body-03" weight="medium" className="text-body-default">
        {label}
      </Typography>
      <Typography variant="body-03" weight="regular" className="text-body-default">
        {value}
      </Typography>
    </View>
  );
}
