<script lang="ts">
  // 경과 분석 실행 — 범위 선택 + 비용 확인.
  //
  // 범위를 묻는 이유는 둘이다: ① 입력 예산(회기 수로 나눠 배분)을 넘기면 회기당
  // 읽는 양이 줄어 장기 케이스가 얕아진다 ② 요즘 상태만 보고 싶을 때가 있다.
  // 회기가 적으면 고를 게 없으므로 선택지를 아예 만들지 않는다.

  import BaseModal from './BaseModal.svelte'
  import Button from '$lib/components/Button.svelte'
  import { AI_PURPOSE, estimatedCostLabel } from '$lib/features/credit'

  interface Props {
    modalId?: string
    closeModal?: () => void
    completedSessionCount: number
    hasPrevious?: boolean
    onConfirm: (sessionTake: number | null) => void | Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    completedSessionCount,
    hasPrevious = false,
    onConfirm
  }: Props = $props()

  const ranges = $derived(
    [
      {
        key: 'all',
        take: null as number | null,
        label: `전체 ${completedSessionCount}회기`,
        hint: '상담을 시작한 뒤 지금까지 어떻게 달라졌는지 봐요.'
      },
      {
        key: 'r10',
        take: 10,
        label: '최근 10회기',
        hint: '최근 흐름을 넓게 봐요.'
      },
      {
        key: 'r5',
        take: 5,
        label: '최근 5회기',
        hint: '요즘 상태를 중심으로 봐요.'
      }
    ].filter((r) => r.take === null || r.take < completedSessionCount)
  )

  let rangeKey = $state('all')
  const selected = $derived(ranges.find((r) => r.key === rangeKey) ?? ranges[0])
  let submitting = $state(false)

  async function handleConfirm() {
    if (submitting) return
    submitting = true
    try {
      await onConfirm(selected?.take ?? null)
      closeModal()
    } finally {
      submitting = false
    }
  }
</script>

<!-- bodyClass는 BaseModal 기본값이 빈 문자열이라 **모달이 직접 넘겨야 한다**
     (안 넘기면 본문이 여백 없이 가장자리에 붙는다 — 실제로 그랬다).
     §modal 본문 = 상·좌·우 20 · **하단 28**(`p-5 pb-7`). 하단만 한 단 큰 이유는
     푸터 상단이 16이라, 28이 아니면 본문 마지막 줄이 확정 버튼에 붙어 읽혀서다.
     (하단 40은 푸터가 **없는** 조회 전용 모달의 값이라 여기 해당 없다.)

     ⚠️ 폭은 이 prop이 정하지 않는다 — `ModalContainer`가 `modalStore` 호출부의
     `options.size`로 준다. BaseModal의 size는 높이 제한(tall/narrow)에만 쓰인다.
     그래서 여기와 호출부(CaseAnalysisPanel)를 같은 값으로 맞춰 둔다. -->
<BaseModal
  {modalId}
  title="경과 분석 실행"
  size="sm"
  bodyClass="p-5 pb-7"
  {closeModal}
>
  {#snippet body()}
    <div class="flex flex-col gap-6">
      {#if ranges.length > 1}
        <div>
          <p class="mb-2 text-body-02-normal-medium text-title-subtitle">
            분석 범위
          </p>
          <div class="flex flex-col gap-3">
            {#each ranges as range}
              <button
                type="button"
                onclick={() => (rangeKey = range.key)}
                class="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors {rangeKey ===
                range.key
                  ? 'border-border-active bg-brand-subtle'
                  : 'border-border-default hover:border-primary-300'}"
              >
                <span
                  class="mt-1 flex h-4 w-4 shrink-0 rounded-full border {rangeKey ===
                  range.key
                    ? 'border-[5px] border-primary-500'
                    : 'border-border-strong'}"
                ></span>
                <span class="min-w-0">
                  <span
                    class="block text-body-01-normal-medium text-body-strong"
                  >
                    {range.label}
                  </span>
                  <span
                    class="mt-1 block text-body-02-normal-regular text-body-subtle"
                  >
                    {range.hint}
                  </span>
                </span>
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <!-- 어휘는 이 기능의 나머지(패널 빈 상태·리포트)와 같은 말을 쓴다 -->
        <p class="text-body-01-reading-regular text-body-default">
          끝난 회기 {completedSessionCount}개의 상담일지를 묶어, 상담이 어떻게
          흘러왔는지 정리해요.
        </p>
      {/if}

      <!-- 라벨을 '예상 크레딧'이라 하면 값(`~11 크레딧`)과 단위가 두 번 읽힌다 -->
      <div class="flex items-center justify-between rounded-lg bg-gray-50 p-4">
        <span class="text-body-02-normal-regular text-body-default"
          >예상 사용량</span
        >
        <span class="text-body-01-normal-medium text-body-strong">
          {estimatedCostLabel(AI_PURPOSE.CASE_ANALYSIS)}
        </span>
      </div>

      {#if hasPrevious}
        <p class="text-body-03-normal-regular text-body-subtle">
          이전 분석은 이력으로 남고, 화면에는 가장 최근 결과가 보여요.
        </p>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <!-- 버튼은 공용 Button이 소유한다(§button 재구현 금지).
         손으로 만들었을 땐 취소만 raw 클래스, 실행만 Typography 래핑이라
         같은 푸터의 두 버튼이 서로 다른 방식으로 그려지고 있었다. -->
    <Button
      color="stroke-secondary"
      size="title"
      content="취소"
      onclick={closeModal}
    />
    <Button
      size="title"
      content={submitting ? '시작하는 중...' : '분석 실행'}
      disabled={submitting}
      onclick={handleConfirm}
    />
  {/snippet}
</BaseModal>
