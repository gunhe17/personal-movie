import type { Snippet } from 'svelte'
import { writable } from 'svelte/store'

/**
 * 페이지 타이틀 우측 액션(CTA) 등록소.
 *
 * 정본은 `PageTitleSection`의 `extraBtn` 슬롯이다 — 타이틀을 페이지가 직접
 * 소유하는 화면(내담자·상담실·바우처 등)은 그대로 슬롯을 쓴다.
 *
 * 이 스토어는 **타이틀을 레이아웃이 소유하는 화면**만을 위한 통로다.
 * 센터 설정 화면(`/center/form-templates` 등)은 타이틀이 부모 레이아웃에 있어
 * 페이지가 슬롯에 손을 뻗을 수 없다. 그렇다고 CTA를 본문 안에
 * 따로 세우면 타이틀 행이 비고 버튼만 있는 빈 줄이 하나 더 생긴다
 * (Web_Design.md §Layout — 메인 CTA는 페이지 타이틀 행 우측).
 *
 * 사용 (페이지):
 * ```svelte
 * {#snippet cta()}
 *   <PageActionButton label="새 양식 추가" onclick={...} />
 * {/snippet}
 * $effect(() => {
 *   pageAction.set(cta)
 *   return () => pageAction.set(null)   // 라우트를 떠나면 반드시 비운다
 * })
 * ```
 */
export const pageAction = writable<Snippet | null>(null)
