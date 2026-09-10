<style>
  /* 포커스 이동 시 행을 잠깐 반짝이게 (시선 유도 후 사라짐) */
  @keyframes field-flash {
    0% {
      background-color: rgba(37, 110, 244, 0);
    }
    25% {
      background-color: rgba(37, 110, 244, 0.05);
    }
    100% {
      background-color: rgba(37, 110, 244, 0);
    }
  }
  /* 하이라이트 박스는 '입력 영역 폭(772) + 패딩 16'만 덮는다.
     행 자체에 배경을 깔면 폼 컬럼 전체 폭으로 번져 입력칸과 우측 끝이 어긋난다.
     레이아웃에 영향을 주지 않도록 겹치는 ::before로 그린다(행 패딩·마진 불변). */
  :global(.field-flash) {
    position: relative;
  }
  :global(.field-flash)::before {
    content: '';
    position: absolute;
    top: -16px;
    bottom: -16px;
    left: -16px;
    width: calc(min(772px, 100%) + 32px);
    border-radius: 12px;
    pointer-events: none;
    animation: field-flash 0.9s ease-out;
  }
</style>

<script lang="ts" module>
  export interface StepItem {
    /** #each 키 */
    key: string
    /** 좌측 폼의 data-field 값 (스크롤 점프 대상) */
    field: string
    label: string
    done: boolean
    warning: string | null
    preview: string
    /**
     * 선택(옵션) 스텝 여부. true이고 아직 안 채워졌으면(done=false, warning=null)
     * "건너뜀(중립)"으로 보고 체크를 표시하지 않으며 진행률 분모에서도 제외한다.
     */
    optional?: boolean
    /**
     * 선택 스텝을 사용자가 켰는지(예: 등록 폼의 섹션 토글 on).
     * true면 아직 안 채워졌어도 "건너뜀"이 아니라 **해야 할 단계**로 보고 진행률 분모에 넣는다.
     */
    active?: boolean
    /**
     * true면 이 스텝이 완료돼도 자동으로 다음 미완료 스텝으로 이동하지 않는다.
     * (예: 드롭다운이 열린 채 선택이 확정되는 내담자 스텝 → 닫힐 때 goToNextUndone() 수동 호출)
     */
    deferAutoAdvance?: boolean
  }
</script>

<script lang="ts">
  import { tick } from 'svelte'
  import CircleCheckSolidIcon from '$lib/assets/CircleCheckSolidIcon.svelte'
  import { slide, fade } from 'svelte/transition'
  import type { Snippet } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import ArrowLeftIcon40 from '$lib/assets/ArrowLeftIcon40.svelte'
  import MemoBlueIcon24 from '$lib/assets/MemoBlueIcon24.svelte'

  interface Props {
    title: string
    steps: StepItem[]
    /** 현재 포커스된 필드 (좌측 폼의 onfocusin/onclickcapture와 양방향 바인딩) */
    activeField: string | null
    /** 좌측 폼 행을 잠깐 반짝이게 할 필드 (form snippet에 전달) */
    flashField?: string | null
    memo: string
    memoPlaceholder?: string
    submitLabel: string
    canSubmit: boolean
    /** 모든 스텝 완료 시 노출되는 배너 문구 */
    completeBannerText?: string
    onSubmit: () => void
    onCancel: () => void
    /** 좌측 폼. activeField/flashField를 받아 data-field·field-flash를 적용한다. */
    form: Snippet
    /** 내담자 드롭다운 닫힘 등에서 "다음 미완료 스텝으로" 트리거하는 함수 (부모가 호출) */
    goToNextUndone?: () => void
    /** 특정 스텝으로 이동(스크롤+플래시) — 진입 의도가 정해진 링크에서 부모가 호출 */
    goToField?: (field: string) => void
  }

  let {
    title,
    steps,
    activeField = $bindable(),
    flashField = $bindable(null),
    memo = $bindable(),
    memoPlaceholder = '특이사항을 자유롭게 적어주세요.',
    submitLabel,
    canSubmit,
    completeBannerText = '접수 준비가 완료됐어요',
    onSubmit,
    onCancel,
    form,
    goToNextUndone = $bindable(),
    goToField = $bindable()
  }: Props = $props()

  // 건너뛴 선택 스텝(비어있는 optional)은 진행률 집계에서 제외한다.
  const isSkipped = (s: StepItem) =>
    !!s.optional && !s.active && !s.done && !s.warning
  const countedSteps = $derived(steps.filter((s) => !isSkipped(s)))
  const doneCount = $derived(countedSteps.filter((s) => s.done).length)
  const totalCount = $derived(countedSteps.length)
  const progress = $derived(
    totalCount ? Math.round((doneCount / totalCount) * 100) : 0
  )
  const allDone = $derived(totalCount > 0 && progress === 100)

  // ============ 인터랙션: 포커스 + 자동 진행 ============
  let flashTimer: ReturnType<typeof setTimeout> | null = null

  function scrollToField(field: string) {
    document
      .querySelector(`[data-field="${field}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function focusField(field: string) {
    activeField = field
    scrollToField(field)
    // flash 재실행: 같은 필드 연속 클릭에도 애니메이션이 다시 돌도록 null로 리셋 후 재설정
    if (flashTimer) clearTimeout(flashTimer)
    flashField = null
    requestAnimationFrame(() => {
      flashField = field
      flashTimer = setTimeout(() => (flashField = null), 900)
    })
  }

  function moveToNextUndone() {
    // 건너뛴 선택 스텝은 미완료로 보지 않는다.
    const firstUndone = steps.find((s) => !s.done && !isSkipped(s))
    if (firstUndone) tick().then(() => focusField(firstUndone.field))
  }
  // 부모가 호출할 수 있게 노출 (예: 드롭다운 닫힘 시)
  goToNextUndone = moveToNextUndone
  goToField = focusField

  // 한 단계가 완료되면 다음 미완료 단계로 자동 스크롤 + 하이라이트.
  let prevDoneKey = $state<string>('')
  // 단계가 완료돼도 다음 단계로 자동 이동(스크롤)하지 않는다 —
  // 입력 중에 화면이 제멋대로 튀어 사용자가 위치를 잃는다.
  // 이동은 우측 '접수 진행'에서 단계를 직접 눌렀을 때만(focusField).
  // 활성 표시는 계속 갱신해 어디까지 했는지는 보이게 한다.
  $effect(() => {
    const doneMap = steps.map((s) => (s.done ? '1' : '0')).join('')
    if (doneMap === prevDoneKey) return
    prevDoneKey = doneMap
  })
</script>

<div in:fade class="flex h-full min-h-0 flex-col bg-gray-50">
  <!-- 헤더 — 여백은 일반 페이지 셸과 동일(px-20 pt-5 / 오버레이 px-4 pt-4, +layout.svelte).
       접수 페이지는 루트에서 p-0 예외라 그 값을 여기서 직접 갖는다.
       타이틀↔콘텐츠 간격 16(mb-4) · 타이틀 행 높이 44(PageTitleSection과 동일) -->
  <div
    class="mb-4 flex min-h-11 shrink-0 items-center gap-2 px-4 pt-4 xl:px-20 xl:pt-5"
  >
    <button
      onclick={onCancel}
      class="flex items-center justify-center"
      aria-label="뒤로가기"
    >
      <ArrowLeftIcon40 />
    </button>

    <Typography variant="headline-01-normal-semibold" color="text-gray-800"
      >{title}</Typography
    >
  </div>

  <!-- 하단바(2xl 미만)가 폼을 가리지 않게 그만큼 하단 패딩 확보.
       2xl부터는 하단바가 사라지므로 일반 페이지와 같은 pb-8(32) -->
  <div class="flex min-h-0 flex-1 px-4 pb-28 xl:px-20 2xl:pb-8">
    <div
      class="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white"
    >
      <!-- 좌측: 폼 입력 (스크롤바 숨김 + 위/아래 fade·화살표) -->
      <!-- 카드 안쪽 폼 패딩 — 상 24 / 하 40 / 좌우 24. 폼 여백의 유일한 소유자다
           (행에는 패딩 없음, 행 간격은 페이지 쪽 gap). 하단만 큰 이유: 스크롤
           컨테이너라 마지막 행이 카드 밑변에 붙지 않게 여유를 둔다. -->
      <ScrollFadeArea
        class="px-6 pt-6 pb-10"
        bounceArrow
        deps={[activeField, steps]}
      >
        {@render form()}
      </ScrollFadeArea>

      <!-- 우측: 진행 스텝퍼 + 메모 + 버튼 -->
      <aside
        class="hidden min-h-0 w-100 shrink-0 flex-col border-l border-gray-100 bg-gray-50/30 2xl:flex"
      >
        <!-- 진행률 헤더 -->
        <div class="shrink-0 px-5 pb-4 pt-5">
          <div class="mb-3 flex items-baseline justify-between">
            <Typography variant="title-01-semibold" color="text-gray-800"
              >접수 진행</Typography
            >
            <Typography variant="body-02-medium" color="text-body-default">
              {doneCount}/{totalCount}
            </Typography>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200/70">
            <div
              class="h-full rounded-full transition-all duration-500 {allDone
                ? 'bg-primary-500'
                : 'bg-primary-400'}"
              style="width: {progress}%"
            ></div>
          </div>
        </div>

        <!-- 스텝퍼 -->
        <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-2">
          <ul class="relative">
            {#each steps as step, stepIndex (step.key)}
              {@const isActive = activeField === step.field}
              <li class="relative">
                <!-- 연결선은 '내 원 중심 → 다음 원 중심'만 긋는다. ul 전체에 한 줄을 그으면
                     마지막 아이템 높이에 따라 원 아래로 삐져나온다. 25 = py-3(12)+mt-0.5(2)+반지름(11) -->
                {#if stepIndex < steps.length - 1}
                  <span
                    class="absolute left-4.75 top-[25px] -bottom-[25px] z-10 w-px bg-gray-200"
                    aria-hidden="true"
                  ></span>
                {/if}
                <button
                  type="button"
                  onclick={() => focusField(step.field)}
                  class="group flex w-full items-start gap-3 rounded-lg py-3 pr-2 pl-2 text-left transition-colors {isActive
                    ? 'bg-primary-50'
                    : 'hover:bg-gray-100/60'}"
                >
                  <!-- 상태 마커 — 완료(체크)와 경고(!)는 **같은 원**이다.
                       면 색과 안쪽 기호만 다르고 지름은 동일해야 하므로, 경고도
                       배경(bg-*)으로 원을 그리지 않고 체크와 같은 20x20 viewBox·
                       같은 r=8 원을 svg로 그린다(bg-amber로 채우면 22px 꽉 찬 원이
                       돼 17.6px인 체크보다 커 보였다). -->
                  <span
                    role={step.warning ? 'img' : undefined}
                    aria-label={step.warning ?? undefined}
                    class="relative z-20 mt-0.5 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full transition-all duration-300 {step.warning
                      ? 'text-status-warning'
                      : step.done
                        ? 'text-state-done-text'
                        : isActive
                          ? 'border-2 border-primary-300 bg-white'
                          : 'border-2 border-gray-200 bg-white'}"
                  >
                    {#if step.warning}
                      <svg class="h-full w-full" viewBox="0 0 20 20"
                        ><circle
                          cx="10"
                          cy="10"
                          r="8"
                          fill="currentColor"
                        /><path
                          d="M10 5.9V11"
                          stroke="#fff"
                          stroke-width="2"
                          stroke-linecap="round"
                        /><circle cx="10" cy="13.8" r="1.1" fill="#fff" /></svg
                      >
                    {:else if step.done}
                      <!-- 완료 = 초록 원형 체크. 에셋이 currentColor라 위 text-state-done-text를 따른다 -->
                      <CircleCheckSolidIcon class="h-full w-full" />
                    {/if}
                  </span>
                  <span class="min-w-0 flex-1">
                    <!-- 경고는 좌측 원(노란 !)이 혼자 말한다 — 라벨 옆 ⚠·미리보기 아래
                         경고 문구를 함께 두면 한 줄에 같은 말이 세 번 겹치고, 정작
                         내용은 좌측 폼(칩 아래 경고·일정 충돌 배너)이 이미 소유한다. -->
                    <span class="flex items-center gap-1">
                      <Typography
                        variant="body-01-medium"
                        color={step.done
                          ? 'text-gray-800'
                          : isActive
                            ? 'text-primary-600'
                            : 'text-gray-400'}
                      >
                        {step.label}
                      </Typography>
                    </span>
                    <Typography
                      variant="body-03-normal-regular"
                      color={step.done
                        ? 'text-body-strong'
                        : !step.optional || step.active
                          ? 'text-body-subtle'
                          : 'text-placeholder'}
                      className="mt-1 block truncate-safe"
                    >
                      {step.preview}
                    </Typography>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        </div>

        <!-- 접수 준비 완료 배너 (상단 보더 위에 붙는 띠, t만 라운드) -->
        {#if allDone}
          <div transition:slide={{ duration: 280 }} class="shrink-0 px-5">
            <!-- 완료 배너 — 연한 브랜드 면 + 브랜드 텍스트(시맨틱 토큰).
                 꽉 찬 primary 면은 바로 아래 등록 버튼(Primary CTA)과 같은 급으로
                 읽혀 "어느 쪽을 눌러야 하나"가 흐려진다. 배너는 상태 고지지 액션이 아니다. -->
            <div
              class="flex items-center gap-2 rounded-t-xl bg-action-primary-subtle px-5 py-2.5"
            >
              <svg
                class="h-5 w-5 shrink-0 text-action-primary"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  stroke-width="1.8"
                />
                <path
                  d="M8 12.2l2.6 2.6L16 9.2"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <Typography variant="body-02-medium" color="text-action-primary">
                {completeBannerText}
              </Typography>
            </div>
          </div>
        {/if}

        <!-- 메모 -->
        <div class="shrink-0 border-t border-gray-100 px-5 pt-4 pb-6">
          <div class="mb-2 flex items-center gap-1.5">
            <MemoBlueIcon24 />
            <Typography variant="body-02-medium" color="text-gray-700"
              >메모</Typography
            >
          </div>
          <textarea
            value={memo}
            oninput={(e) => {
              const val = (e.target as HTMLTextAreaElement).value
              if (val.length <= 2000) memo = val
            }}
            maxlength={2000}
            placeholder={memoPlaceholder}
            class="block h-60 w-full resize-none rounded-lg border border-gray-200 bg-white text-body-03-reading-regular text-gray-700 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-placeholder focus:border-border-active px-3 py-3.5"
          ></textarea>
        </div>

        <!-- 제출 버튼 -->
        <div class="shrink-0 border-t border-gray-100 px-5 py-4">
          <div class="flex gap-2.5">
            <button
              type="button"
              onclick={onCancel}
              class="h-11 flex-1 rounded-lg bg-white text-gray-600 ring-1 ring-gray-200 transition-colors hover:bg-gray-100"
            >
              <Typography variant="body-01-medium" color="text-gray-600"
                >취소</Typography
              >
            </button>
            <button
              type="button"
              onclick={onSubmit}
              disabled={!canSubmit}
              class="h-11 flex-2 rounded-lg transition-all duration-200 {canSubmit
                ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-[0_2px_8px_rgba(37,110,244,0.25)]'
                : 'cursor-not-allowed bg-action-primary-disabled text-action-primary-disabled-fg'}"
            >
              <!-- 비활성 = Primary disabled 규격(bg primary-200 · 텍스트 흰색) -->
              <Typography variant="body-01-medium" color="text-white"
                >{submitLabel}</Typography
              >
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</div>

<!-- 2xl 미만: 하단 고정 액션바 (사이드바 폭만큼 비켜) -->
<div
  class="fixed bottom-0 right-0 z-20 border-t border-gray-200 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)] 2xl:hidden"
  style="left: var(--sidebar-width, 240px); width: calc(100% - var(--sidebar-width, 240px));"
>
  <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <div
      class="h-full rounded-full bg-primary-500 transition-all duration-500"
      style="width: {progress}%"
    />
  </div>
  <div class="px-4 py-3">
    <div class="mb-2 flex items-center justify-end">
      <Typography variant="body-02-medium" color="text-gray-600">
        접수 진행 {doneCount}/{totalCount}
      </Typography>
    </div>
    <div class="flex gap-2.5">
      <button
        type="button"
        onclick={onCancel}
        class="h-11 flex-1 rounded-lg bg-gray-100 text-gray-600"
      >
        <Typography variant="body-01-medium" color="text-gray-600"
          >취소</Typography
        >
      </button>
      <button
        type="button"
        onclick={onSubmit}
        disabled={!canSubmit}
        class="h-11 flex-2 rounded-lg transition-all {canSubmit
          ? 'bg-primary-500 text-white'
          : 'cursor-not-allowed bg-action-primary-disabled text-action-primary-disabled-fg'}"
      >
        <!-- 비활성 = Primary disabled 규격(bg primary-200 · 텍스트 흰색) -->
        <Typography variant="body-01-medium" color="text-white"
          >{submitLabel}</Typography
        >
      </button>
    </div>
  </div>
</div>
