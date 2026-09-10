<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import type {
    AssessmentItem,
    AssessmentVisual
  } from '$lib/features/assessment/status-detail/types'
  import {
    ASSESSMENT_STATUS_LABELS,
    ASSESSMENT_STATUS_TAG_STYLES,
    DEFAULT_ASSESSMENT_CATEGORY_COLOR
  } from '$lib/features/assessment/status-detail/constants'
  import AssessmentCardDefault from '$lib/assets/assessmentStartBg/AssessmentCardDefault.png'

  let { assessment, visual, onSelect } = $props<{
    assessment: AssessmentItem
    visual?: AssessmentVisual
    onSelect: (assessment: AssessmentItem) => void
  }>()

  const statusKey = $derived(
    assessment.status as keyof typeof ASSESSMENT_STATUS_TAG_STYLES
  )
  const tagStyle = $derived(
    ASSESSMENT_STATUS_TAG_STYLES[statusKey] ??
      ASSESSMENT_STATUS_TAG_STYLES.pending
  )
  const statusLabel = $derived(
    ASSESSMENT_STATUS_LABELS[
      assessment.status as keyof typeof ASSESSMENT_STATUS_LABELS
    ] ?? '미실시'
  )
  const color = $derived(visual?.color ?? DEFAULT_ASSESSMENT_CATEGORY_COLOR)
  const engName = $derived(visual?.engName ?? assessment.nameEn ?? '')
  const korName = $derived(visual?.korName || assessment.name)
  // 스마트폰 중독 검사는 국내 전용(영문 약어가 없음) → 한글 표기
  const isSmartphone = $derived(
    /smartphone/i.test(engName) ||
      /smartphone/i.test(assessment.assessmentCode ?? '')
  )
  // 영어 약어(BGT/K-WISC-V/TCI…)가 있으면 "영어 (한글)", 없으면(스마트폰 등) 한글만
  const primaryName = $derived(isSmartphone ? korName : engName || korName)
  const displayName = $derived(
    !isSmartphone && engName && korName && engName !== korName
      ? `${engName} (${korName})`
      : primaryName
  )

  // 검사명이 길어 잘릴 때 → 카드 호버 시 텍스트를 슬라이드해 뒷부분 노출
  // (검사 관리 카드 AssessmentTitleCard와 동일 동작)
  let titleEl = $state<HTMLElement | null>(null)
  let slidePx = $state(0)

  $effect(() => {
    displayName // 검사명 변경 시 재측정
    const el = titleEl
    if (!el) return
    const measure = () => {
      const over = el.scrollWidth - el.clientWidth
      slidePx = over > 0 ? over : 0
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  })

  const slideDuration = $derived(slidePx > 0 ? Math.max(slidePx * 16, 500) : 0)
</script>

<!-- 규격 정본 = 검사 관리 카드(AssessmentTitleCard): 높이 176 고정 · radius 12 ·
     border gray-200 · 배너(flex-1) + 흰 본문 p-4(gap 12) · hover 시 shadow-md.
     검사 현황에만 있는 것 = 우상단 상태 배지(검사 관리엔 운영 토글이 그 자리). -->
<button
  type="button"
  onclick={() => onSelect(assessment)}
  class="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-shadow hover:shadow-md focus:outline-none"
  style="height: 176px;"
>
  <!-- 이미지 헤더 (색상 + 패턴) : 상태 배지(우상단) 유지 -->
  <div
    class="relative flex-1"
    style="background-color: {color}; background-image: url('{AssessmentCardDefault}'); background-size: cover; background-position: center;"
  >
    <div class="absolute right-3 top-3">
      <span
        class="inline-flex h-6 items-center rounded-md bg-white px-2"
        style="color: {tagStyle.text};"
      >
        <Typography variant="body-03-medium" tag="span" color="text-inherit">
          {statusLabel}
        </Typography>
      </span>
    </div>
  </div>

  <!-- 흰 본문: 온라인/오프라인 + 검사명 (영문 약어 우선 → "영어 (한글)").
       타이포·패딩 전부 검사 관리 카드와 동일 -->
  <div class="flex flex-col gap-3 bg-white p-4">
    <p class="text-body-03-normal-medium text-gray-500">
      {assessment.isOnline ? '온라인' : '오프라인'}
    </p>
    <!-- 검사명: 잘리면 호버 시 슬라이드로 뒷내용 노출 -->
    <div class="overflow-hidden">
      <p
        bind:this={titleEl}
        class="w-full truncate-safe text-body-01-normal-semibold text-gray-800 transition-transform ease-linear group-hover:w-max group-hover:[text-overflow:clip] group-hover:[transform:translateX(var(--slide))]"
        style="--slide:-{slidePx}px; transition-duration:{slideDuration}ms"
      >
        {displayName}
      </p>
    </div>
  </div>
</button>
