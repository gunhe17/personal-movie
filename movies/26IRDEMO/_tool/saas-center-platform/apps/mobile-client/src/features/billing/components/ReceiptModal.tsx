/**
 * 청구서 영수증 모달 — 시안 682:4819. 청구서 목록 행 탭 시 조회 전용으로 뜬다.
 * 딤 오버레이 위 영수증 카드(위/아래 절취선 스캘럽) + 하단 플로팅 닫기.
 * 전문가앱 ReceiptSheet 구조를 포팅하되 내담자 톤(내담자 헤더 없음)으로 단순화.
 */
import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useBillableDetail } from '../hooks';
import { getErrorMessage } from '@/shared/api/client';
import { Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { formatKst } from '@/shared/utils/date';
import AssessmentIcon20 from '@assets/icons/20/AssessmentIcon20.svg';
import CounselingIcon20 from '@assets/icons/20/CounselingIcon20.svg';

const OVERLAY = '#00000080'; // 딤(검정 50%) — 뒤 목록이 비쳐 보임
const SCALLOP_BUMP = 8;
const SCALLOP_GAP = 4;
const SCALLOP_INSET = 2;
const CARD_MARGIN = 16;
const CARD_WIDTH = Dimensions.get('window').width - CARD_MARGIN * 2;

/** 청구일 — 서버 `date` 타입(달력상의 날짜)이라 KST 변환 대상이 아니다 */
function fmtDate(v?: string | null): string {
  if (!v) return '-';
  try {
    return format(parseISO(v), 'yyyy년 M월 d일', { locale: ko });
  } catch {
    return v;
  }
}

/** 발행일 — 서버 `datetime`(UTC naive)이라 KST로 옮겨 찍는다 */
function fmtDateTime(v?: string | null): string {
  if (!v) return '-';
  try {
    return formatKst(v, 'yyyy년 M월 d일');
  } catch {
    return v;
  }
}
const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

/** 절취선(스캘럽) 가장자리 — 흰 카드 가장자리를 같은 방향 반원으로 깎는다. */
function NotchEdge({ edge }: { edge: 'top' | 'bottom' }) {
  const w = CARD_WIDTH;
  const period = SCALLOP_BUMP + SCALLOP_GAP;
  const segs = Math.max(2, Math.round(w / period));
  const step = w / segs;
  const bump = SCALLOP_BUMP;
  const r = bump / 2;
  const h = r + SCALLOP_INSET;
  const lead = (step - bump) / 2;

  let d: string;
  if (edge === 'top') {
    d = `M 0,0`;
    for (let i = 0; i < segs; i++) {
      const x = i * step + lead;
      d += ` L ${x},0 a ${r},${r} 0 0,0 ${bump},0`;
    }
    d += ` L ${w},0 L ${w},${h} L 0,${h} Z`;
  } else {
    d = `M 0,${h}`;
    for (let i = 0; i < segs; i++) {
      const x = i * step + lead;
      d += ` L ${x},${h} a ${r},${r} 0 0,1 ${bump},0`;
    }
    d += ` L ${w},${h} L ${w},0 L 0,0 Z`;
  }

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

function AmountRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.text.body.default }}
      >
        {label}
      </Typography>
      <Typography
        variant="title-01"
        weight="semibold"
        style={{
          color: danger ? COLORS.status.danger : COLORS.text.body.strong,
        }}
      >
        {won(value)}
      </Typography>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Typography
        variant="body-03"
        weight="medium"
        style={{ color: COLORS.text.body.default }}
      >
        {label}
      </Typography>
      <Typography variant="body-03" style={{ color: COLORS.text.body.default }}>
        {value}
      </Typography>
    </View>
  );
}

interface ReceiptModalProps {
  visible: boolean;
  onClose: () => void;
  billableId: string | null;
  centerId: string | null;
}

export function ReceiptModal({
  visible,
  onClose,
  billableId,
  centerId,
}: ReceiptModalProps) {
  const insets = useSafeAreaInsets();
  const {
    data: detail,
    isError,
    error,
    refetch,
  } = useBillableDetail(visible ? billableId : null, visible ? centerId : null);

  const items = detail?.items ?? [];
  const memo = detail?.memo?.trim() || null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: OVERLAY }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {isError ? (
          <View
            className="flex-1 items-center justify-center px-8"
            style={{ rowGap: s(16) }}
          >
            <Typography
              variant="body-02"
              style={{ color: COLORS.white, textAlign: 'center' }}
            >
              {getErrorMessage(error, '청구서를 불러오지 못했어요')}
            </Typography>
            <Pressable
              accessibilityRole="button"
              onPress={() => refetch()}
              style={{
                paddingHorizontal: s(20),
                paddingVertical: s(10),
                borderRadius: s(20),
                backgroundColor: 'rgba(255,255,255,0.16)',
              }}
            >
              <Typography
                variant="body-03"
                weight="medium"
                style={{ color: COLORS.white }}
              >
                다시 시도
              </Typography>
            </Pressable>
          </View>
        ) : !detail ? (
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
              paddingBottom: insets.bottom + s(96),
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ width: CARD_WIDTH }}>
              <NotchEdge edge="top" />
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  paddingHorizontal: s(16),
                  paddingTop: s(24),
                  paddingBottom: s(40),
                  rowGap: s(20),
                }}
              >
                {/* 청구 항목 */}
                <View style={{ rowGap: s(12) }}>
                  <Typography
                    variant="body-03"
                    weight="medium"
                    style={{ color: COLORS.text.title.subtle }}
                  >
                    청구 항목 ({items.length}건)
                  </Typography>
                  <View style={{ rowGap: s(14) }}>
                    {items.map((item) => (
                      <View
                        key={item.id}
                        className="flex-row items-center justify-between"
                      >
                        <View className="flex-1 pr-2" style={{ rowGap: s(4) }}>
                          <View
                            className="flex-row items-center"
                            style={{ columnGap: s(4) }}
                          >
                            {item.related_type?.startsWith('assessment') ? (
                              <AssessmentIcon20 width={s(20)} height={s(20)} />
                            ) : (
                              <CounselingIcon20 width={s(20)} height={s(20)} />
                            )}
                            <Typography
                              variant="body-02"
                              weight="semibold"
                              numberOfLines={1}
                              style={{ color: COLORS.text.body.strong }}
                            >
                              {item.description}
                            </Typography>
                          </View>
                          <Typography
                            variant="body-03"
                            style={{ color: COLORS.text.body.default }}
                          >
                            {item.quantity}개 × {won(item.unit_price)}
                          </Typography>
                        </View>
                        <Typography
                          variant="title-01"
                          weight="semibold"
                          style={{ color: COLORS.text.body.strong }}
                        >
                          {won(item.amount)}
                        </Typography>
                      </View>
                    ))}
                  </View>
                </View>

                {/* 금액 요약 */}
                <View>
                  <DashedLine />
                  <View style={{ paddingVertical: s(20), rowGap: s(8) }}>
                    <AmountRow label="총액" value={detail.total_amount} />
                    <AmountRow label="납부액" value={detail.paid_amount} />
                  </View>
                  <DashedLine />
                  <View style={{ paddingTop: s(20) }}>
                    <AmountRow
                      label="미수금"
                      value={detail.unpaid_amount}
                      danger
                    />
                  </View>
                </View>

                {/* 청구일 / 발행일 */}
                <View>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: COLORS.border.default,
                    }}
                  />
                  <View style={{ paddingTop: s(20), rowGap: s(6) }}>
                    <InfoRow
                      label="청구일"
                      value={fmtDate(detail.billable_date)}
                    />
                    <InfoRow
                      label="발행일"
                      value={fmtDateTime(detail.issued_at)}
                    />
                  </View>
                </View>

                {/* 메모 */}
                {memo ? (
                  <View style={{ rowGap: s(8) }}>
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: COLORS.text.title.subtle }}
                    >
                      메모
                    </Typography>
                    <View
                      style={{
                        backgroundColor: COLORS.bg['surface-sunken'],
                        borderRadius: s(12),
                        paddingHorizontal: s(12),
                        paddingVertical: s(8),
                        minHeight: s(80),
                      }}
                    >
                      <Typography
                        variant="body-02-reading"
                        style={{ color: COLORS.text.body.strong }}
                      >
                        {memo}
                      </Typography>
                    </View>
                  </View>
                ) : null}
              </View>
              <NotchEdge edge="bottom" />
            </View>
          </ScrollView>
        )}

        {/* 하단 플로팅 닫기 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
          style={{
            position: 'absolute',
            bottom: insets.bottom + s(24),
            alignSelf: 'center',
            width: s(44),
            height: s(44),
            borderRadius: s(22),
            backgroundColor: 'rgba(255,255,255,0.16)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={24} color={COLORS.white} />
        </Pressable>
      </View>
    </Modal>
  );
}
