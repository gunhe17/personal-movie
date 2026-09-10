/**
 * 일정 변경 요청 바텀시트 — 피그마 421:6191 · 434:8226 · 434:9165.
 *
 * 한 시트 안에서 2단계: (1) 날짜·시간 선택 → (2) 변경 내용 확인.
 * 제출은 즉시 확정이 아니라 센터 승인 대기 요청이다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import RAnimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { getErrorMessage } from '@/shared/api/client';
import { BottomSheet, Button, Typography } from '@/shared/components/ui';
import { COLORS } from '@/shared/constants/theme';
import { s } from '@/shared/utils/scale';
import { kstToServerDateTime, nowKst } from '@/shared/utils/date';
import ArrowLeftIcon20 from '@assets/icons/20/ArrowLeftIcon20.svg';
import ArrowRightIcon20 from '@assets/icons/20/ArrowRightIcon20.svg';
import ArrowDownIcon20 from '@assets/icons/20/ArrowDownIcon20.svg';
import { useAvailableSlots } from '../hooks';
import type { AvailableSlot } from '../types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function weekdayColor(index: number): string {
  if (index === 0) return COLORS.calendar.sunday;
  if (index === 6) return COLORS.calendar.saturday;
  return COLORS.text.label.default;
}

function isMorning(time: string): boolean {
  return Number(time.split(':')[0]) < 12;
}

function formatSlotLabel(date: Date, time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour < 12 ? '오전' : '오후';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${format(date, 'yyyy년 M월 d일', { locale: ko })} ${period} ${String(display).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: AvailableSlot[];
  selected: string | null;
  onSelect: (time: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: s(7) }}>
      {slots.map((slot) => {
        const isSelected = selected === slot.time;
        return (
          <Pressable
            key={slot.time}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !slot.available,
              selected: isSelected,
            }}
            disabled={!slot.available}
            onPress={() => onSelect(slot.time)}
          >
            <View
              // 선택 토글 시 리마운트 — 안드로이드가 동적 배경색에 radius를 다시 안 그린다
              key={isSelected ? 'sel' : 'unsel'}
              style={{
                width: s(80.5),
                height: s(40),
                borderRadius: s(8),
                borderWidth: isSelected ? 0 : 1,
                borderColor: slot.available
                  ? COLORS.border.default
                  : COLORS.border.subtle,
                backgroundColor: isSelected
                  ? COLORS.action.primary
                  : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography
                variant="label-02"
                weight="medium"
                style={{
                  color: isSelected
                    ? COLORS.text.state.inverse
                    : slot.available
                      ? COLORS.text.body.default
                      : COLORS.text.state.disabled,
                }}
              >
                {slot.time}
              </Typography>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

interface ChangeScheduleSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (startTime: string) => void;
  loading?: boolean;
  scheduleId: string;
  currentStart: Date;
}

export function ChangeScheduleSheet({
  visible,
  onClose,
  onConfirm,
  loading,
  scheduleId,
  currentStart,
}: ChangeScheduleSheetProps) {
  const today = startOfDay(nowKst());
  const [month, setMonth] = useState(() => startOfMonth(currentStart));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');

  const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const slotsQuery = useAvailableSlots(scheduleId, dateKey);

  const weeks = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(month)),
      end: endOfWeek(endOfMonth(month)),
    });
    const grouped: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) grouped.push(days.slice(i, i + 7));
    return grouped;
  }, [month]);

  const slots = slotsQuery.data?.slots ?? [];
  const morning = slots.filter((slot) => isMorning(slot.time));
  const afternoon = slots.filter((slot) => !isMorning(slot.time));
  const hasOpenSlot = slots.some((slot) => slot.available);

  // 초기화는 닫을 때가 아니라 다시 열 때 — 닫는 애니메이션(240ms) 도중에 단계를 되돌리면
  // 사라지는 시트에 이전 단계가 잠깐 다시 그려진다
  useEffect(() => {
    if (!visible) return;
    setStep('pick');
    setSelectedDate(null);
    setSelectedTime(null);
    setMonth(startOfMonth(currentStart));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = () => {
    onClose();
  };

  // 확인 단계에서 back은 시트를 닫지 않고 달력으로 — 고른 날짜·시간은 그대로 둔다
  const handleBack = () => {
    if (step === 'confirm') {
      setStep('pick');
      return;
    }
    handleClose();
  };

  const handleSubmit = () => {
    if (!selectedDate || !selectedTime) return;
    if (step === 'pick') {
      setStep('confirm');
      return;
    }
    const [hour, minute] = selectedTime.split(':').map(Number);
    // selectedDate는 KST 벽시계 — 서버가 받는 naive UTC로 환산해 보낸다
    const requested = new Date(selectedDate);
    requested.setHours(hour, minute, 0, 0);
    onConfirm(kstToServerDateTime(requested));
  };

  const ctaLabel = step === 'pick' ? '변경 요청' : '이 시간으로 요청하기';

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={
        step === 'pick'
          ? '날짜와 시간을 선택해주세요'
          : '변경 내용을 확인해주세요'
      }
      titleVariant="title-01"
      onBack={handleBack}
      fullHeight={step === 'pick'}
      footer={
        <Button
          label={ctaLabel}
          variant="primary"
          size="xl"
          disabled={!selectedDate || !selectedTime}
          loading={loading}
          onPress={handleSubmit}
        />
      }
    >
      {step === 'confirm' ? (
        <RAnimated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(120)}
        >
          <Typography
            variant="body-03"
            style={{ color: COLORS.text.body.subtle, marginBottom: s(16) }}
          >
            선생님 확인 후 예약이 확정돼요
          </Typography>
          <View
            style={{
              backgroundColor: COLORS.bg['surface-sunken'],
              borderRadius: s(12),
              paddingVertical: s(20),
              rowGap: s(8),
              alignItems: 'center',
            }}
          >
            <Typography
              variant="body-03"
              style={{ color: COLORS.text.body.subtle }}
            >
              기존 일정
            </Typography>
            <Typography
              variant="body-02"
              weight="medium"
              style={{ color: COLORS.text.body.default }}
            >
              {formatSlotLabel(currentStart, format(currentStart, 'HH:mm'))}
            </Typography>
            <ArrowDownIcon20 width={20} height={20} />
            <Typography
              variant="body-03"
              style={{ color: COLORS.text.body.subtle }}
            >
              변경 일정
            </Typography>
            <Typography
              variant="body-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              {selectedDate && selectedTime
                ? formatSlotLabel(selectedDate, selectedTime)
                : ''}
            </Typography>
          </View>
        </RAnimated.View>
      ) : (
        <RAnimated.View entering={FadeIn.duration(200)}>
          {/* 월 이동 */}
          <View
            className="flex-row items-center justify-center"
            style={{ columnGap: s(16), paddingVertical: s(8) }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="이전 달"
              onPress={() => setMonth(addMonths(month, -1))}
              hitSlop={8}
            >
              <ArrowLeftIcon20 width={20} height={20} />
            </Pressable>
            <Typography
              variant="title-01"
              weight="semibold"
              style={{ color: COLORS.text.title.default }}
            >
              {format(month, 'yyyy년 M월')}
            </Typography>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다음 달"
              onPress={() => setMonth(addMonths(month, 1))}
              hitSlop={8}
            >
              <ArrowRightIcon20 width={20} height={20} />
            </Pressable>
          </View>

          {/* 요일 */}
          <View className="mt-2 flex-row items-center">
            {WEEKDAYS.map((label, i) => (
              <Typography
                key={label}
                variant="label-02"
                weight="medium"
                className="flex-1 text-center"
                style={{ color: weekdayColor(i) }}
              >
                {label}
              </Typography>
            ))}
          </View>

          {/* 날짜 */}
          <View className="mt-2" style={{ rowGap: s(4) }}>
            {weeks.map((week) => (
              <View
                key={week[0].toISOString()}
                className="flex-row items-center"
              >
                {week.map((day, i) => {
                  const inMonth = isSameMonth(day, month);
                  const isPast = isBefore(day, today);
                  const isToday = isSameDay(day, today);
                  const isSelected = selectedDate
                    ? isSameDay(day, selectedDate)
                    : false;
                  const disabled = !inMonth || isPast;
                  return (
                    <Pressable
                      key={day.toISOString()}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled }}
                      accessibilityLabel={format(day, 'M월 d일')}
                      disabled={disabled}
                      onPress={() => {
                        setSelectedDate(day);
                        setSelectedTime(null);
                      }}
                      className="flex-1 items-center justify-center py-1"
                      style={{ rowGap: s(2) }}
                    >
                      <View
                        key={isSelected ? 'sel' : 'unsel'}
                        style={{
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: s(32),
                          height: s(32),
                          borderRadius: s(32),
                          backgroundColor: isSelected
                            ? COLORS.action.primary
                            : 'transparent',
                        }}
                      >
                        {inMonth ? (
                          <Typography
                            variant="body-03"
                            weight="medium"
                            style={{
                              color: isSelected
                                ? COLORS.text.state.inverse
                                : isPast
                                  ? COLORS.text.state.disabled
                                  : i === 0
                                    ? COLORS.calendar.sunday
                                    : COLORS.text.body.strong,
                            }}
                          >
                            {format(day, 'd')}
                          </Typography>
                        ) : null}
                      </View>
                      {/* 캡션 자리는 항상 확보 — 행 높이가 튀지 않게 */}
                      <View style={{ height: s(14) }}>
                        {isToday && inMonth ? (
                          <Typography
                            variant="caption-01"
                            style={{ color: COLORS.text.body.subtle }}
                          >
                            오늘
                          </Typography>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* 시간 */}
          <View className="mt-6">
            {!selectedDate ? null : slotsQuery.isLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator color={COLORS.action.primary} />
              </View>
            ) : slotsQuery.isError ? (
              <View
                style={{
                  backgroundColor: COLORS.bg['surface-sunken'],
                  borderRadius: s(12),
                  paddingVertical: s(24),
                  paddingHorizontal: s(16),
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="body-02"
                  style={{ color: COLORS.status.danger, textAlign: 'center' }}
                >
                  {getErrorMessage(
                    slotsQuery.error,
                    '가능한 시간을 불러오지 못했어요',
                  )}
                </Typography>
              </View>
            ) : !hasOpenSlot ? (
              <View
                style={{
                  backgroundColor: COLORS.bg['surface-sunken'],
                  borderRadius: s(12),
                  paddingVertical: s(24),
                  rowGap: s(4),
                  alignItems: 'center',
                }}
              >
                <Typography
                  variant="body-02"
                  style={{ color: COLORS.text.body.default }}
                >
                  예약 가능한 시간이 없어요
                </Typography>
                <Typography
                  variant="body-03"
                  style={{ color: COLORS.text.body.subtle }}
                >
                  다른 날짜를 선택해보세요
                </Typography>
              </View>
            ) : (
              <View style={{ rowGap: s(16) }}>
                {morning.length ? (
                  <View style={{ rowGap: s(12) }}>
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: COLORS.text.title.subtle }}
                    >
                      오전
                    </Typography>
                    <SlotGrid
                      slots={morning}
                      selected={selectedTime}
                      onSelect={setSelectedTime}
                    />
                  </View>
                ) : null}
                {afternoon.length ? (
                  <View style={{ rowGap: s(12) }}>
                    <Typography
                      variant="body-03"
                      weight="medium"
                      style={{ color: COLORS.text.title.subtle }}
                    >
                      오후
                    </Typography>
                    <SlotGrid
                      slots={afternoon}
                      selected={selectedTime}
                      onSelect={setSelectedTime}
                    />
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </RAnimated.View>
      )}
    </BottomSheet>
  );
}
