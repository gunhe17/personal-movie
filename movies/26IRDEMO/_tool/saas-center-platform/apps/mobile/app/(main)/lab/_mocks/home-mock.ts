/**
 * 홈 시안 lab 전용 mock 데이터.
 * 실데이터 hook 사용 없이 시각적 비교가 가능하도록 정적 데이터 제공.
 *
 * - `now` 인자 기반으로 nextSession 시간이 자동 계산됨 (분 단위로 미래)
 *   → 카운트다운 시각화가 동적으로 작동
 */
import type { ScheduleListItem } from "@/features/schedule";

interface BuildOptions {
  now?: Date;
  /** 다음 일정까지 남은 분 (양수 = 미래, 음수 = 이미 시작) */
  minutesUntilNext?: number;
}

function iso(date: Date): string {
  // RN/백엔드 호환: UTC ISO
  return date.toISOString();
}

function shift(base: Date, deltaMin: number): Date {
  return new Date(base.getTime() + deltaMin * 60_000);
}

/**
 * 홈 시안용 mock — 다음 일정, 오늘 일정, 주간 통계
 */
export function buildHomeMock(opts: BuildOptions = {}) {
  const now = opts.now ?? new Date();
  const minutesUntilNext = opts.minutesUntilNext ?? 47;

  const nextStart = shift(now, minutesUntilNext);
  const nextEnd = shift(nextStart, 50);

  const second = shift(now, minutesUntilNext + 80);
  const third = shift(now, minutesUntilNext + 180);

  const nextSession: ScheduleListItem = {
    id: "mock-next",
    start: iso(nextStart),
    end: iso(nextEnd),
    schedule_type: "counseling",
    room_name: "1번 상담실",
    counselor_name: "김민준",
    client_names: ["김은서"],
    clients: [
      {
        id: "c1",
        name: "김은서",
        gender: "female",
        birth_date: "2017-04-12",
      },
    ],
    title: null,
    program_name: "놀이치료",
    session_status: "scheduled",
  };

  const todaySchedules: ScheduleListItem[] = [
    nextSession,
    {
      id: "mock-2",
      start: iso(second),
      end: iso(shift(second, 50)),
      schedule_type: "assessment",
      room_name: "검사실 A",
      counselor_name: "박지영",
      client_names: ["이도윤"],
      clients: [
        {
          id: "c2",
          name: "이도윤",
          gender: "male",
          birth_date: "2015-09-03",
        },
      ],
      title: null,
      program_name: "K-WISC-V",
      session_status: "scheduled",
    },
    {
      id: "mock-3",
      start: iso(third),
      end: iso(shift(third, 50)),
      schedule_type: "counseling",
      room_name: "2번 상담실",
      counselor_name: "김민준",
      client_names: ["최서연"],
      clients: [
        {
          id: "c3",
          name: "최서연",
          gender: "female",
          birth_date: "2010-11-21",
        },
      ],
      title: null,
      program_name: "인지행동치료",
      session_status: "scheduled",
    },
  ];

  return {
    today: now,
    centerName: "마음숲 상담센터",
    personName: "김민준",
    nextSession,
    todaySchedules,
    weekStats: {
      range: `${now.getMonth() + 1}/${Math.max(1, now.getDate() - now.getDay() + 1)} - ${now.getMonth() + 1}/${now.getDate() - now.getDay() + 7}`,
      counseling: 8,
      assessment: 3,
      noShow: 1,
    },
    unlinkedCount: 2,
    unreadCount: 3,
  };
}

/**
 * 사람 이름의 만 나이 계산 (display only).
 */
export function getAgeFromBirth(birth: string): number {
  const d = new Date(birth);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

/**
 * 카운트다운 표시 텍스트 (`47` / `1시간 30분 뒤` / `진행 중`)
 */
export function formatCountdown(minutes: number): { headline: string; sub: string } {
  if (minutes < 0) return { headline: "지금", sub: "진행 중" };
  if (minutes < 60) return { headline: `${minutes}`, sub: "분 뒤 시작" };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { headline: `${h}`, sub: `시간 ${m}분 뒤` };
}

/**
 * HH:mm 포맷
 */
export function formatHHmm(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
