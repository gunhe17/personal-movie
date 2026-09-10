<script lang="ts">
  // 전달문 모달 — 상담일지를 내담자·보호자용 글로 바꾸고(내담자용 변환), 앱에 열어주는(전달) 자리.
  // 시안 계보: /lab/journal-attach 「전달문 만들기」.
  //
  //   좌 재료(일지 원문) / 우 결과(전달문) — '변환'이라는 행위를 좌→우 그림으로 보인다.
  //   개인 메모는 좌측 목록에 자리조차 없다 = 재료로 쓰이지 않는다는 증명.
  //   좌우가 같은 모양(한 덩어리 글)이라야 대조가 된다 — 우측을 항목으로 쪼개면 좌우가
  //   다른 물건처럼 보여 '옮긴 것'이라는 관계가 흐려진다.
  //
  // 좌우를 나란히 두는 것이 검토 게이트 자체다 — 전달문이 원문에 없는 말을 담았는지는
  // 기계가 판정할 수 없어서(한 덩어리 글엔 1:1 대응 칸이 없다) 사람이 대조하는 이 화면이
  // 지어내기의 마지막 방어선이다.
  //
  // 폭은 740(size='xl') — 좌우 2단 구성 모달 전용 규격(Web_Design §Components>modal).
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import HighlightStarWhite20 from '$lib/assets/HighlightStarWhite20.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalStore } from '$lib/stores/modal'
  import { centerId } from '$lib/stores/center.store'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { useQueryClient } from '@tanstack/svelte-query'
  import {
    getNoteShares,
    patchNoteShare,
    postGenerateNoteShare,
    postSetNoteSharePublished,
    type CounselingNoteShare
  } from '$lib/hooks/actions/counseling-note-share.action'
  import ShareSensitiveConfirmModal from '$lib/components/modal/ShareSensitiveConfirmModal.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    /** 좌측 재료 — 일지 본문(개인 메모 제외) */
    goal?: string
    progress?: string
    nextPlan?: string
    /** 재료 출처 표기 — "2026-08-27 회기 · 김서연" */
    sourceLabel?: string
    /** 수신 대상 표기 — "김서연님 가족이 앱에서 봐요" */
    audienceLabel?: string
    /** 변환·전달 대상 */
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
    audienceLabel = '',
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

  const shareQuery = queryBuilder(
    getNoteShares,
    () => ({ centerId: $centerId ?? '', sessionId }),
    () => ({ enabled: !!$centerId && !!sessionId })
  )

  const share = $derived(
    ((shareQuery.data as CounselingNoteShare[] | undefined) ?? []).find(
      (s) => s.client_id === clientId
    ) ?? null
  )

  let text = $state('')
  let baseline = $state('')
  let isConverting = $state(false)
  let isBusy = $state(false)
  let loadedKey = $state('')

  // 서버 값이 새로 오면(생성·전달 직후 포함) 본문을 재초기화
  $effect(() => {
    const key = `${share?.id ?? ''}:${share?.updated_at ?? ''}:${share?.status ?? ''}`
    if (key === loadedKey) return
    loadedKey = key
    text = share?.content?.text ?? ''
    baseline = text
  })

  const hasDraft = $derived(!!text.trim())
  const isDirty = $derived(text !== baseline)
  const isShared = $derived(share?.status === 'published')
  const displayName = $derived(clientName || '내담자')
  // 읽는 사람은 서버가 내담자 나이로 정한다(만 19세 미만 = 보호자). 정해진 결과만 표기.
  const toneLabel = $derived(
    share
      ? share.audience === 'self'
        ? '본인이 읽는 문체'
        : '보호자가 읽는 문체'
      : audienceLabel
  )

  async function invalidate() {
    await queryClient.invalidateQueries({
      queryKey: ['getNoteShares'],
      exact: false
    })
  }

  /** 저장하고 저장된 값을 돌려준다 — 민감 판정은 서버가 저장분으로 계산하므로 이 결과를 본다 */
  async function persist(): Promise<CounselingNoteShare | null> {
    if (!$centerId || !share) return null
    const saved = (await patchNoteShare().request({
      centerId: $centerId,
      shareId: share.id,
      content: { text: text.trim() || null }
    })) as unknown as CounselingNoteShare
    baseline = text
    return saved
  }

  async function handleConvert() {
    if (!$centerId || isConverting) return
    // 대상이 없으면 서버가 422를 돌려준다 — 여기서 사람 말로 끊는다
    if (!sessionId || !clientId) {
      snackbarStore.error('전달 대상을 찾지 못했어요. 화면을 새로고침해주세요.')
      return
    }
    if (hasDraft && isDirty) {
      const ok = confirm('고쳐둔 내용이 사라지고 새로 만들어져요. 계속할까요?')
      if (!ok) return
    }
    isConverting = true
    try {
      await postGenerateNoteShare().request({
        centerId: $centerId,
        sessionId,
        clientId
      })
      await invalidate()
      snackbarStore.success('전달문을 만들었어요. 확인 후 전달해주세요.')
    } catch (e: any) {
      snackbarStore.error(
        e?.response?.data?.detail ?? '전달문을 만들지 못했어요.'
      )
    } finally {
      isConverting = false
    }
  }

  // 전달 = 저장 + 앱 열람 개시 + 보호자 알림. 한 번의 행동이라 버튼도 하나다.
  async function handleDeliver() {
    if (!$centerId || isBusy) return
    if (!share) {
      snackbarStore.info('먼저 전달문을 만들어주세요')
      return
    }
    if (!hasDraft) {
      snackbarStore.info('전달할 내용이 비어 있어요')
      return
    }
    isBusy = true
    let categories: string[] = []
    try {
      const saved = isDirty ? await persist() : share
      categories = saved?.sensitive_categories ?? []
    } catch {
      snackbarStore.error('전달문을 저장하지 못했어요.')
      isBusy = false
      return
    }
    isBusy = false

    // 민감 표현이 남아 있을 때만 컨펌을 태운다 — 매번 뜨면 무조건 확인을 누르게 된다
    if (categories.length > 0) {
      modalStore.open({
        component: ShareSensitiveConfirmModal,
        props: {
          clientName: displayName,
          categories,
          onConfirm: () => void setShared(true)
        },
        options: { customWidth: 420 }
      })
      return
    }
    await setShared(true)
  }

  async function setShared(next: boolean) {
    if (!$centerId || !share || isBusy) return
    isBusy = true
    try {
      await postSetNoteSharePublished().request({
        centerId: $centerId,
        shareId: share.id,
        published: next
      })
      await invalidate()
      if (next) {
        snackbarStore.success(
          `${displayName}님께 전달했어요. 앱 알림이 함께 나갔어요.`
        )
        closeModal()
      } else {
        snackbarStore.success(
          '전달을 중지했어요. 앱에서 더 이상 보이지 않아요.'
        )
      }
    } catch {
      snackbarStore.error(
        next ? '전달하지 못했어요.' : '전달을 중지하지 못했어요.'
      )
    } finally {
      isBusy = false
    }
  }
</script>

<BaseModal title="전달문 만들기" {closeModal} size="xl" bodyScrollable={false}>
  {#snippet body()}
    <!-- 본문 사방 20(§Components>modal) · 2분할 영역 사이 16(§Spacing).
         가운데 화살표 열은 auto — '재료 → 결과'라는 변환 방향을 그림으로 못박는다
         (좁은 화면에서는 위→아래로 쌓이므로 화살표도 90° 돌린다) -->
    <div
      class="grid h-[520px] max-h-full min-h-0 grid-cols-1 gap-4 overflow-hidden p-5 pb-7 lg:grid-cols-[1fr_auto_1fr]"
    >
      <!-- ── 좌: 재료 ── -->
      <section class="flex min-h-0 flex-col">
        <!-- 인셋 면(well) — 모달 20 ⊃ 이 블록 12(중첩 규칙: 바깥 > 안쪽).
             재료(스크롤) + 액션(고정)을 한 면 안에 담는다 — 버튼이 재료 밖으로 나가면
             '이 재료로 만든다'는 연결이 끊긴다. -->
        <div class="flex min-h-0 flex-1 flex-col rounded-xl bg-bg-base p-4">
          <div class="min-h-0 flex-1 space-y-6 overflow-y-auto">
            {#each materials as field (field.label)}
              <div>
                <span class="text-body-03-normal-medium text-title-subtitle">
                  {field.label}
                </span>
                <!-- 레이블 → 값 12(§Spacing ① 그룹 내부) · 여러 줄이라 reading 행간 -->
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
          <!-- AI 액션 — 재료 면 하단에 고정(위 목록만 스크롤).
               §button Medium: 높이 40 · 레이블 15 · 아이콘 20 · gap 8.
               폭은 면을 가득 채운다(w-full) — 좌우 여백은 면의 p-4(16)가 소유하므로
               버튼이 따로 좌우 패딩을 벌리지 않는다.
               면은 §AI 그라디언트 정본 유틸(.bg-ai-gradient) -->
          <button
            type="button"
            onclick={handleConvert}
            disabled={isConverting}
            class="bg-ai-gradient mt-4 flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg px-6 text-white transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <HighlightStarWhite20 />
            <span class="text-body-02-normal-medium">
              {isConverting
                ? '만드는 중이에요…'
                : hasDraft
                  ? '다시 만들기'
                  : '이 일지로 전달문 만들기'}
            </span>
          </button>
        </div>
      </section>

      <!-- ── 변환 방향 ── -->
      <!-- 우측 라벨 행(15 + mb-3 = 27)만큼 내려 두 박스의 세로 가운데에 선다 -->
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

      <!-- ── 우: 결과 ── -->
      <section class="flex min-h-0 flex-col">
        <div class="mb-3 flex items-baseline gap-2">
          <span class="text-body-02-normal-medium text-title-subtitle">
            이렇게 전달돼요
          </span>
          {#if toneLabel}
            <span
              class="truncate-safe text-body-03-normal-regular text-caption-subtle"
            >
              {toneLabel}
            </span>
          {/if}
        </div>
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <textarea
          bind:value={text}
          maxlength={4000}
          placeholder="내담자·보호자에게 전할 내용을 적어주세요. 아래 버튼으로 왼쪽 일지에서 만들 수도 있어요."
          class="min-h-0 flex-1 resize-none rounded-lg border border-input-border bg-white px-4 py-3 text-body-01-reading-regular text-gray-900 placeholder:text-placeholder focus:border-border-active focus:outline-none"
        ></textarea>
      </section>
    </div>
  {/snippet}

  {#snippet footer()}
    <!-- 좌: 전달 상태(+중지) / 우: 취소·전달하기.
         저장과 전달을 한 버튼으로 묶는다 — 저장만 하고 안 보내는 건 상담사가 원하는 상태가
         아니고, 두 버튼이면 "저장했는데 왜 안 갔지"가 생긴다 -->
    <div class="flex w-full items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="shrink-0 text-body-02-normal-medium {isShared
            ? 'text-gray-700'
            : 'text-caption-subtle'}"
        >
          {isShared ? '전달됨' : '전달 전'}
        </span>
        <span
          class="truncate-safe text-body-03-normal-regular text-caption-subtle"
        >
          {isShared
            ? '사본이 가는 게 아니라 앱에서 열람만 되고, 중지하면 즉시 닫혀요'
            : '전달해야 앱에서 볼 수 있어요'}
        </span>
        {#if isShared}
          <button
            type="button"
            onclick={() => setShared(false)}
            disabled={isBusy}
            class="shrink-0 text-body-03-normal-medium text-gray-500 underline underline-offset-2 transition-colors hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            전달 중지
          </button>
        {/if}
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onclick={() => closeModal()}
          class="h-11 rounded-lg border border-gray-200 bg-white px-5 text-body-01-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
        >
          취소
        </button>
        <button
          type="button"
          onclick={handleDeliver}
          disabled={isBusy || !hasDraft}
          class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isShared ? '수정 사항 전달' : '전달하기'}
        </button>
      </div>
    </div>
  {/snippet}
</BaseModal>
