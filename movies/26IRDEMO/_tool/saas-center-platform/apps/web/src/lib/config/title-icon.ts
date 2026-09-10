import type { Component } from 'svelte'
import CalendarOn28 from '$lib/assets/sidebar/CalendarOn28.svelte'
import ClientOn28 from '$lib/assets/sidebar/ClientOn28.svelte'
import VoucherOn28 from '$lib/assets/sidebar/VoucherOn28.svelte'
import CounselOn28 from '$lib/assets/sidebar/CounselOn28.svelte'
import AssessmentOn28 from '$lib/assets/sidebar/AssessmentOn28.svelte'
import MemberOn28 from '$lib/assets/sidebar/MemberOn28.svelte'
import CostOn28 from '$lib/assets/sidebar/CostOn28.svelte'
import SettingOn28 from '$lib/assets/sidebar/SettingOn28.svelte'
import MyinfoOn28 from '$lib/assets/sidebar/MyinfoOn28.svelte'

/**
 * XL 타이틀 좌측 아이콘 — 경로 → GNB 메뉴 아이콘(28 변형).
 * (Web_Design.md §Title system > XL 타이틀 좌측 GNB 아이콘)
 *
 * 정본은 사이드바 메뉴 구조(`common/components/layout/UnifiedSidebar.svelte`의 menuItems)다.
 * 아이콘은 **메뉴 단위**라 한 메뉴의 하위 메뉴는 전부 같은 아이콘을 쓴다 —
 * 상담(현황·일지·프로그램 관리)은 경로가 /center로 갈라져도 상담 아이콘이다.
 * 타이틀 문구는 반대로 **하위 메뉴 이름**을 쓴다(하위가 없는 메뉴만 상위 이름 그대로).
 *
 * 등록 대상 = 사이드바에 노출되는 메뉴 경로뿐. 여기서 들어가지 않는 화면
 * (상세·설정 하위·필드노트 등)은 아이콘 없이 타이틀만 쓴다.
 * 예외 — 대시보드는 XL 타이틀이 없는 히어로 화면이라 등록하지 않는다.
 * 예외 — 공지사항·고객센터는 업무 메뉴가 아닌 하단 지원 메뉴라 아이콘 없이 타이틀만 쓴다.
 */
export const TITLE_ICONS: Record<string, Component> = {
  // 스케줄
  '/schedule': CalendarOn28,
  '/schedule/calendar': CalendarOn28,
  '/schedule/reservations': CalendarOn28,
  // 내담자 (하위 메뉴 없음)
  '/clients': ClientOn28,
  // 바우처
  '/vouchers': VoucherOn28,
  '/settings/vouchers': VoucherOn28,
  // 상담
  '/counseling/status': CounselOn28,
  '/counseling/notes': CounselOn28,
  '/center/program': CounselOn28,
  // 검사
  '/assessment/status': AssessmentOn28,
  '/center/manage': AssessmentOn28,
  // 구성원
  '/member': MemberOn28,
  '/center/authorization': MemberOn28,
  // 청구
  '/billing': CostOn28,
  // 설정
  '/center/info': SettingOn28,
  '/center/room': SettingOn28,
  '/center/message-templates': SettingOn28,
  '/center/form-templates': SettingOn28,
  // 내 정보 (하위 메뉴 없음)
  '/myInfo': MyinfoOn28
}

/**
 * 메뉴 진입 화면일 때만 아이콘을 준다 — **정확히 일치**하는 경로만.
 * prefix로 넓히면 상세 화면(`/center/form-templates/[id]` 등)까지 아이콘이 붙는다.
 */
export function getTitleIcon(pathname: string): Component | undefined {
  const path =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  return TITLE_ICONS[path]
}
