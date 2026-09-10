import { type Router } from 'expo-router';
import type { QueryClient } from '@tanstack/react-query';
import { getScheduleDetail } from './api';
import type { ScheduleDetailResponse, ScheduleListItem } from './types';

/** useScheduleDetail 과 동일한 쿼리 키 (캐시 조회용) */
const scheduleDetailKey = (centerId: string | null, scheduleId: string) =>
  ['schedule', centerId, scheduleId] as const;

type ScheduleNavExtra = {
  /** 회기 상세 진입 후 일지 시트 자동 오픈 */
  openNote?: string;
  /** 회기 추가 마법사 자동 오픈 */
  openWizard?: string;
};

function pickExtra(extra?: ScheduleNavExtra) {
  const out: Record<string, string> = {};
  if (extra?.openNote) out.openNote = extra.openNote;
  if (extra?.openWizard) out.openWizard = extra.openWizard;
  return out;
}

function relayQuery(extra?: ScheduleNavExtra) {
  const parts: string[] = [];
  if (extra?.openNote) parts.push(`openNote=${extra.openNote}`);
  if (extra?.openWizard) parts.push(`openWizard=${extra.openWizard}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * 캐시된 일정 상세에서 실제 목적지(상담 회기 / 검사 케이스 상세) 라우트를 해소한다.
 * 해소되면 router.push 인자를, 회기/케이스가 아직 없으면 null 을 반환.
 */
function destinationFromDetail(
  detail: ScheduleDetailResponse | undefined,
  extra?: ScheduleNavExtra,
) {
  const first = detail?.sessions?.[0];
  if (!detail || !first) return null;

  if (detail.schedule_type === 'counseling' && first.session_id) {
    return {
      pathname: '/(main)/counseling/session/[id]' as const,
      params: { id: first.session_id, scheduleId: detail.id, ...pickExtra(extra) },
    };
  }
  if (detail.schedule_type === 'assessment' && first.case_id) {
    return {
      pathname: '/(main)/assessment/[id]' as const,
      params: { id: first.case_id },
    };
  }
  return null;
}

/**
 * 일정(schedule_id)에서 실제 상세 화면으로 이동한다.
 *
 * `/(main)/schedule/[id]` 는 상세를 fetch 한 뒤 회기/검사 상세로 replace 하는
 * 경유 라우트라, 콜드 캐시에서는 스피너 화면이 한 박자 떴다 넘어가 '페이지가 두 번
 * 넘어가는' 것처럼 보인다. 이 헬퍼는 (1) 이미 데워진 일정 상세 캐시, (2) 목록
 * 아이템이 들고 있는 검사 case_id, (3) 캐시 miss 시 상세를 직접 await fetch 해서
 * 목적지를 알아낸 뒤 경유 라우트 없이 한 번에 이동한다. 회기/케이스가 없는 일정
 * (meeting 등)이나 fetch 실패일 때만 경유 라우트로 폴백한다.
 */
export async function openScheduleDetail(
  router: Router,
  queryClient: QueryClient,
  centerId: string | null,
  scheduleId: string,
  opts?: { listItem?: ScheduleListItem; extra?: ScheduleNavExtra },
) {
  // 1) 데워진 일정 상세 캐시가 있으면 목적지로 즉시 직접 이동
  const cached = queryClient.getQueryData<ScheduleDetailResponse>(
    scheduleDetailKey(centerId, scheduleId),
  );
  const cachedDest = destinationFromDetail(cached, opts?.extra);
  if (cachedDest) {
    router.push(cachedDest);
    return;
  }

  // 2) 목록 아이템이 목적지 식별자를 들고 있으면 fetch 없이 즉시 직접 이동
  //    (목록 API 가 상담 session_id·검사 case_id 를 함께 내려줌)
  const li = opts?.listItem;
  if (li?.schedule_type === 'counseling' && li.session_id) {
    router.push({
      pathname: '/(main)/counseling/session/[id]',
      params: { id: li.session_id, scheduleId, ...pickExtra(opts?.extra) },
    });
    return;
  }
  if (li?.schedule_type === 'assessment' && li.case_id) {
    router.push({ pathname: '/(main)/assessment/[id]', params: { id: li.case_id } });
    return;
  }

  // 3) 캐시 miss — 상세를 직접 await fetch 해서 목적지로 이동(경유 라우트 스피너를 안 띄움)
  if (centerId) {
    try {
      const detail = await queryClient.ensureQueryData<ScheduleDetailResponse>({
        queryKey: scheduleDetailKey(centerId, scheduleId),
        queryFn: () => getScheduleDetail(centerId, scheduleId),
      });
      const dest = destinationFromDetail(detail, opts?.extra);
      if (dest) {
        router.push(dest);
        return;
      }
    } catch {
      // fetch 실패 → 경유 라우트가 에러 UI 를 처리하도록 폴백
    }
  }

  // 4) 폴백 — 회기/케이스 없는 일정(meeting 등) 또는 fetch 실패 시에만 경유 라우트
  router.push(`/(main)/schedule/${scheduleId}${relayQuery(opts?.extra)}`);
}
