<script lang="ts">
  // 제출 서류 모달 — 확정된 상담 일지를 그 내담자의 바우처 양식으로 옮기는 자리.
  //
  //   좌 재료(일지 원문) / 우 결과(제출 양식) — 전달문 모달(TransferNoteModal)과 같은 좌→우 그림이다.
  //   다른 것은 오른쪽의 모양이다: 전달문은 한 덩어리 글, 제출 서류는 **칸이 있는 양식**이다.
  //   칸마다 어느 문장에서 왔는지 사람이 대조할 수 있어야 해서 좌우를 나란히 둔다 —
  //   제출처에 나가는 문서라 지어내기의 방어선이 여기다.
  //
  //   양식은 상담사가 고르지 않는다. 내담자가 가진 바우처에 제출처가 걸어둔 서식이 정본이다.
  //
  // 폭은 740(size='xl') — 좌우 2단 구성 모달 전용 규격(Web_Design §Components>modal).
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import HighlightStarWhite20 from '$lib/assets/HighlightStarWhite20.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { getFormTemplate, type FormField } from '$lib/hooks/actions/form.action'
  import {
    getNoteDerivations,
    postDeriveSubmissionForm,
    type CounselingNoteDerivation
  } from '$lib/hooks/actions/counseling-note-derivation.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    /** 좌측 재료 — 일지 본문(개인 메모 제외) */
    goal?: string
    progress?: string
    nextPlan?: string
    /** 재료 출처 표기 — "2026-09-06 회기 · 이하준" */
    sourceLabel?: string
    sessionId: string
    clientId: string
    clientName?: string
  }

  let {
    closeModal = () => {},
    goal = '',
    progress = '',
    nextPlan = '',
    sourceLabel = '',
    sessionId,
    clientId,
    clientName = ''
  }: Props = $props()

  const queryClient = useQueryClient()

  const materials = $derived([
    { label: '상담 목표', value: goal },
    { label: '진행 내용', value: progress },
    { label: '다음 상담 내용', value: nextPlan }
  ])

  const derivationQuery = queryBuilder(
    getNoteDerivations,
    () => ({ centerId: $centerId ?? '', sessionId }),
    () => ({ enabled: !!$centerId && !!sessionId })
  )

  // 같은 자리를 다시 만들면 새 파생이 쌓인다 — 화면은 마지막 것을 본다
  const derivation = $derived(
    ((derivationQuery.data as CounselingNoteDerivation[] | undefined) ?? [])
      .filter((d) => d.client_id === clientId)
      .at(-1) ?? null
  )

  // 칸 이름·순서는 양식 스키마가 정본 — 값 dict 의 키 순서는 JSONB 가 뒤섞는다
  const templateQuery = queryBuilder(
    getFormTemplate,
    () => ({
      centerId: $centerId ?? '',
      templateId: derivation?.content?.template_id ?? ''
    }),
    () => ({ enabled: !!$centerId && !!derivation?.content?.template_id })
  )

  const rows = $derived.by(() => {
    const values = derivation?.content?.values ?? {}
    const schema = (templateQuery.data as { schema?: { fields?: Record<string, FormField>; elements?: { field_refs: string[] }[] } } | undefined)?.schema
    const fields = schema?.fields ?? {}
    // 종이 위 순서 = elements 배열 순서. 스키마에 elements 가 없으면 필드 키 순서로 떨어진다
    const ordered = (schema?.elements ?? [])
      .flatMap((el) => el.field_refs ?? [])
      .filter((key, i, arr) => arr.indexOf(key) === i)
    const keys = ordered.length ? ordered : Object.keys(fields)
    return keys.map((key) => ({
      key,
      label: fields[key]?.label ?? key,
      value: values[key] ?? null
    }))
  })

  let isDeriving = $state(false)
  const hasDraft = $derived(!!derivation)
  const displayName = $derived(clientName || '내담자')
  const templateName = $derived(derivation?.content?.template_name ?? '')
  const instanceId = $derived(derivation?.content?.instance_id ?? '')

  async function handleDerive() {
    if (!$centerId || isDeriving) return
    if (!sessionId || !clientId) {
      snackbarStore.error('대상을 찾지 못했어요. 화면을 새로고침해주세요.')
      return
    }
    isDeriving = true
    try {
      await postDeriveSubmissionForm().request({
        centerId: $centerId,
        sessionId,
        clientId
      })
      await queryClient.invalidateQueries({
        queryKey: ['getNoteDerivations'],
        exact: false
      })
      snackbarStore.success('제출 서류 초안을 만들었어요. 확인 후 제출해주세요.')
    } catch (e: any) {
      snackbarStore.error(
        e?.response?.data?.detail ?? '제출 서류를 만들지 못했어요.'
      )
    } finally {
      isDeriving = false
    }
  }

  function openInstance() {
    if (!instanceId) return
    window.open(`/forms/fill/${instanceId}`, '_blank')
  }
</script>

<BaseModal title="제출 서류 초안" {closeModal} size="xl" bodyScrollable={false}>
  {#snippet body()}
    <!-- 본문 사방 20(§Components>modal) · 2분할 영역 사이 16(§Spacing).
         가운데 화살표 열은 auto — '일지 → 제출 서류'라는 변환 방향을 그림으로 못박는다 -->
    <div
      class="grid h-[520px] max-h-full min-h-0 grid-cols-1 gap-4 overflow-hidden p-5 pb-7 lg:grid-cols-[1fr_auto_1fr]"
    >
      <!-- ── 좌: 재료(확정 일지) ── -->
      <section class="flex min-h-0 flex-col">
        <div class="mb-3 flex items-baseline gap-2">
          <span class="text-body-02-normal-medium text-title-subtitle">
            확정된 상담 일지
          </span>
          {#if sourceLabel}
            <span
              class="truncate-safe text-body-03-normal-regular text-caption-subtle"
            >
              {sourceLabel}
            </span>
          {/if}
        </div>
        <div class="flex min-h-0 flex-1 flex-col rounded-xl bg-bg-base p-4">
          <div class="min-h-0 flex-1 space-y-6 overflow-y-auto">
            {#each materials as field (field.label)}
              <div>
                <span class="text-body-03-normal-medium text-title-subtitle">
                  {field.label}
                </span>
                <p
                  class="mt-3 whitespace-pre-line text-body-01-reading-regular {field.value.trim()
                    ? 'text-gray-800'
                    : 'text-caption-subtle'}"
                >
                  {field.value.trim() || '작성 안 함'}
                </p>
              </div>
            {/each}
          </div>
          <button
            type="button"
            onclick={handleDerive}
            disabled={isDeriving}
            class="bg-ai-gradient mt-4 flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-6 text-white transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <HighlightStarWhite20 />
            <span class="text-body-02-normal-medium">
              {isDeriving
                ? '옮기는 중이에요…'
                : hasDraft
                  ? '다시 옮기기'
                  : '이 일지로 양식 채우기'}
            </span>
          </button>
        </div>
      </section>

      <!-- ── 변환 방향 ── -->
      <div
        class="flex items-center justify-center text-icon-secondary lg:pt-7"
        aria-hidden="true"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          class="rotate-90 lg:rotate-0"
        >
          <path
            d="M4 12H20M20 12L14 6M20 12L14 18"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <!-- ── 우: 결과(제출 양식) ── -->
      <section class="flex min-h-0 flex-col">
        <div class="mb-3 flex items-baseline gap-2">
          <span class="text-body-02-normal-medium text-title-subtitle">
            {templateName || '바우처 제출 양식'}
          </span>
          <span
            class="truncate-safe text-body-03-normal-regular text-caption-subtle"
          >
            {hasDraft ? '바우처에 제출하는 서식' : '바우처가 정한 서식이에요'}
          </span>
        </div>
        <!-- 양식은 흰 종이다 — 왼쪽 인셋 면(재료)과 달리 칸이 그려진 문서로 보여야 대조가 된다 -->
        <div
          class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-input-border bg-white"
        >
          {#if !hasDraft}
            <p
              class="flex h-full items-center justify-center px-6 text-center text-body-02-normal-regular text-caption-subtle"
            >
              왼쪽 버튼을 누르면 이 일지의 내용이<br />양식의 칸으로 옮겨져요.
            </p>
          {:else}
            <dl class="divide-y divide-gray-100">
              {#each rows as row (row.key)}
                <div class="px-4 py-3">
                  <dt class="text-body-03-normal-medium text-title-subtitle">
                    {row.label}
                  </dt>
                  <dd
                    class="mt-2 whitespace-pre-line text-body-01-reading-regular {row.value !==
                    null
                      ? 'text-gray-900'
                      : 'text-caption-subtle'}"
                  >
                    {row.value ?? '비어 있음'}
                  </dd>
                </div>
              {/each}
            </dl>
          {/if}
        </div>
      </section>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-between gap-3">
      <span
        class="truncate-safe text-body-03-normal-regular text-caption-subtle"
      >
        {hasDraft
          ? `${displayName}님의 바우처 서류함에 초안으로 들어갔어요. 열어서 고치고 제출하세요`
          : '같은 일지에서 제출처마다 한 장씩 만들어져요'}
      </span>
      <div class="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onclick={() => closeModal()}
          class="h-11 rounded-lg border border-gray-200 bg-white px-5 text-body-01-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
        >
          닫기
        </button>
        <button
          type="button"
          onclick={openInstance}
          disabled={!instanceId}
          class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          양식 열기
        </button>
      </div>
    </div>
  {/snippet}
</BaseModal>
