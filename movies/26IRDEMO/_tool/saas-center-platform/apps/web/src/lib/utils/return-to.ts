/**
 * 접수·등록 폼의 복귀 경로(`returnTo`) 계약.
 *
 * 폼은 저마다 기본 착지가 있다(상담 접수 → 상담 현황, 내담자 등록 → 내담자 상세).
 * 하지만 **일정 화면에서 열고 들어온 경우**엔 "하던 화면"으로 돌아오는 게 맞다 —
 * 셀을 눌러 일정을 추가했는데 다른 메뉴로 튕기면 방금 만든 걸 캘린더에서 확인하지 못한다.
 * 진입 측(스케줄 등록 모달)이 `?returnTo=`로 복귀 경로를 넘기고, 폼은 완료 시 그 경로를 우선한다.
 *
 * 값은 **앱 내부 경로만** 허용한다 — 외부 URL을 넣어 이동시키는 오픈 리다이렉트 차단.
 */

import { dateToString } from './date'

export const RETURN_TO_PARAM = 'returnTo'

/** URL에서 복귀 경로를 읽는다. 없거나 내부 경로가 아니면 null(= 폼 기본 착지). */
export function readReturnTo(url: URL): string | null {
  const raw = url.searchParams.get(RETURN_TO_PARAM)
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

/**
 * 복귀 경로에 착지 날짜(`date`)를 얹는다.
 *
 * 캘린더는 기본이 오늘이라, 다른 날짜로 등록하고 돌아오면 방금 만든 일정이 안 보여
 * 등록 실패로 오인된다. 등록한 날짜로 열어주면 결과가 바로 보인다.
 */
export function withLandingDate(
  returnTo: string,
  date?: Date | null
): string {
  if (!date) return returnTo
  // base는 상대 경로 파싱용 더미 — 결과는 path+search만 쓴다
  const url = new URL(returnTo, 'http://local')
  url.searchParams.set('date', dateToString(date, 'YYYY-MM-DD'))
  return `${url.pathname}${url.search}`
}
