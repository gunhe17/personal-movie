<script lang="ts">
  import { fade } from 'svelte/transition'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { useQueryClient } from '@tanstack/svelte-query'

  import Typography from '@common/components/Typography.svelte'
  import ArrowBackIcon from '$lib/assets/ArrowBackIcon.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import SecretModeToggle from '$lib/components/SecretModeToggle.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import TemplateSearchModal from '$lib/components/clients/detail/TemplateSearchModal.svelte'
  import VoucherFormModal from '$lib/components/clients/detail/VoucherFormModal.svelte'
  import PreAdminssionModal from '$lib/components/modal/PreAdminssionModal.svelte'

  import { centerId, requireCenterId } from '$lib/stores/center.store'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import { dateToString, formatUtcToKst } from '$lib/utils/date'
  import { calcScheduleDDay } from '$lib/types/assessmentStatus'
  import { modalStore, modalUtils } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getClientDetail } from '$lib/hooks/actions/client.action'
  import {
    deleteClientVoucher,
    getClientVoucherDetail,
    getVoucherUsage,
    patchClientVoucher
  } from '$lib/hooks/actions/clientVoucher.action'
  import type { VoucherFormData } from '$lib/features/clients/detail/voucher'
  import {
    deleteVoucherFormInstance,
    getFormInstance,
    getFormTemplate,
    getFormTemplates,
    getVoucherFormInstances,
    postLinkVoucherFormInstance,
    postSubmitFormInstance,
    putSaveFormAnswers,
    type AnswerItem,
    type ClientFormInstanceItem
  } from '$lib/hooks/actions/form.action'
  import { openCounselingJournalModal } from '$lib/features/counseling/detail'
  import {
    buildSessionJournalMap,
    deriveCounselorName,
    mapToVoucherDocCardVM,
    mapToVoucherUsageRowVM,
    type VoucherDocCardVM,
    type VoucherUsageRowVM
  } from '$lib/features/voucher/detail/view-model'
  import { getVoucherRelatedCases } from '$lib/features/voucher/detail/query-builders'

  // 라우트는 바우처 1건(client_voucher_id)만 받는다 — 목록이 사업 기준이라
  // 내담자별 중간 뎁스가 없어졌고, 내담자는 바우처 응답에서 따라온다.
  const voucherId = $derived(page.params.voucherId!)

  const queryClient = useQueryClient()

  // ── 쿼리 ──
  const voucherQuery = $derived(
    queryBuilder(getClientVoucherDetail, () => ({
      centerId: $centerId,
      clientVoucherId: voucherId
    }))
  )
  const clientId = $derived(voucherQuery.data?.client_id ?? '')
  const clientQuery = $derived(
    queryBuilder(
      getClientDetail,
      () => ({
        centerId: $centerId!,
        clientId
      }),
      () => ({ enabled: !!clientId })
    )
  )
  const usageQuery = $derived(
    queryBuilder(getVoucherUsage, () => ({
      centerId: $centerId,
      clientVoucherId: voucherId
    }))
  )
  const formsQuery = $derived(
    queryBuilder(
      getVoucherFormInstances,
      () => ({ centerId: $centerId, clientVoucherId: voucherId }),
      { enabled: browser && !!$centerId && !!voucherId }
    )
  )
  const templatesQuery = $derived(
    queryBuilder(getFormTemplates, () => ({ centerId: $centerId! }), {
      enabled: browser && !!$centerId
    })
  )

  // ── 파생: 바우처/통계 ──
  const voucher = $derived(voucherQuery.data)
  const programName = $derived(
    voucher?.catalog?.program_name ?? voucher?.catalog?.name ?? '바우처'
  )
  const usedSessions = $derived(
    Math.max(
      0,
      (voucher?.total_sessions ?? 0) - (voucher?.remaining_sessions ?? 0)
    )
  )
  const validUntilLabel = $derived(
    voucher?.valid_until
      ? formatUtcToKst(voucher.valid_until, 'YYYY. MM. DD')
      : null
  )
  const dday = $derived(calcScheduleDDay(voucher?.valid_until ?? null))
  /** 회기당 지원금액 (센터 바우처 단가) */
  const unitPrice = $derived(voucher?.center_voucher?.unit_price ?? null)
  /** 만료 임박 표시 기준 — D-7 이하에만 붙인다 */
  const URGENT_DAYS = 7
  const ddayNum = $derived.by(() => {
    const until = voucher?.valid_until
    if (!until) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(`${String(until).slice(0, 10)}T00:00:00`)
    return Math.round((target.getTime() - today.getTime()) / 86400000)
  })

  // ── 파생: 사용 내역 + 케이스(담당자/일지) ──
  const usageRows = $derived(
    (usageQuery.data?.items ?? [])
      .map(mapToVoucherUsageRowVM)
      .sort((a: VoucherUsageRowVM, b: VoucherUsageRowVM) =>
        b.billableDate.localeCompare(a.billableDate)
      )
  )
  const caseIds = $derived([
    ...new Set(
      usageRows
        .map((r: VoucherUsageRowVM) => r.relatedCaseId)
        .filter((id: string | null): id is string => !!id)
    )
  ])
  const casesQuery = $derived(
    queryBuilder(
      getVoucherRelatedCases,
      () => ({ centerId: $centerId, caseIds }),
      { enabled: browser && !!$centerId && caseIds.length > 0 }
    )
  )
  const journalMap = $derived(
    buildSessionJournalMap(casesQuery.data ?? [], clientId)
  )
  const counselorName = $derived(
    deriveCounselorName(usageRows, casesQuery.data ?? [])
  )

  // ── 파생: 제출 서류 ──
  const templateNames = $derived(
    new Map(
      (
        (templatesQuery.data?.items ?? []) as { id: string; name: string }[]
      ).map((t) => [t.id, t.name])
    )
  )
  const docCards = $derived(
    ((formsQuery.data?.items ?? []) as ClientFormInstanceItem[]).map((i) =>
      mapToVoucherDocCardVM(i, templateNames)
    )
  )

  /** 이 바우처가 요구하는 서식 id (공용 원본 기준) — 추가 모달이 위로 묶어 보여준다 */
  const voucherTemplateIds = $derived(
    (voucherQuery.data?.catalog?.form_template_ids ?? []) as string[]
  )

  /** 아직 작성되지 않은 연결 서류 수 — 푸터 문구·비활성 판정 */
  const pendingDocCount = $derived(
    docCards.filter((c) => !c.isSubmitted).length
  )

  const clientName = $derived(clientQuery.data?.name ?? '')
  const displayClientName = $derived(
    $isSecretMode ? maskName(clientName) : clientName
  )

  const fmtAmount = (n: number | null | undefined) =>
    `${(n ?? 0).toLocaleString()}`

  // ── invalidate ──
  const invalidateForms = () => {
    queryClient.invalidateQueries({
      queryKey: ['getVoucherFormInstances'],
      exact: false
    })
    queryClient.invalidateQueries({
      queryKey: ['getClientFormInstances'],
      exact: false
    })
  }

  // ── 서류: 추가 (서식 검색 → 발급+연결) ──
  function openAddDocument() {
    modalStore.open({
      component: TemplateSearchModal,
      props: {
        voucherTemplateIds,
        onSelect: async (template: { id: string; name: string }) => {
          try {
            await postLinkVoucherFormInstance().request({
              centerId: requireCenterId(),
              clientVoucherId: voucherId,
              templateId: template.id
            })
            snackbarStore.success(`"${template.name}" 문서가 연결되었어요`)
            invalidateForms()
          } catch (err) {
            console.error('[postLinkVoucherFormInstance] failed', err)
            snackbarStore.error('문서 연결에 실패했어요')
            throw err
          }
        }
      },
      options: { size: 'md' }
    })
  }

  // ── 서류: 작성하기 / 미리보기 (저장 후 queue가 있으면 다음 서류로 이어감) ──
  async function openWriteDocument(
    card: VoucherDocCardVM,
    queue: VoucherDocCardVM[] = []
  ) {
    const cid = requireCenterId()
    try {
      const [template, instance] = await Promise.all([
        getFormTemplate().request({
          centerId: cid,
          templateId: card.templateId
        }),
        getFormInstance().request({
          centerId: cid,
          instanceId: card.instanceId
        })
      ])
      modalStore.open({
        component: PreAdminssionModal,
        props: {
          title: card.name,
          template: { id: template.id, schema: template.schema },
          existingAnswers: instance.answers,
          isEditMode: card.isSubmitted,
          onSave: async (answers: AnswerItem[]) => {
            try {
              await putSaveFormAnswers().request({
                centerId: cid,
                instanceId: card.instanceId,
                answers
              })
              if (!card.isSubmitted) {
                await postSubmitFormInstance().request({
                  centerId: cid,
                  instanceId: card.instanceId
                })
              }
              snackbarStore.success(`"${card.name}" 서류가 저장되었어요`)
              modalStore.close()
              invalidateForms()
              const [next, ...rest] = queue
              if (next) openWriteDocument(next, rest)
            } catch (err) {
              console.error('[saveVoucherDocument] failed', err)
              snackbarStore.error('서류 저장에 실패했어요')
            }
          }
        },
        // 서식은 원본 위에 얹어 보므로 폭이 곧 가독성 — 문서용 wide(1000)
        options: { size: 'wide' }
      })
    } catch (err) {
      console.error('[openWriteDocument] failed', err)
      snackbarStore.error('서류를 불러오지 못했어요')
    }
  }

  // ── 서류: 전체 작성 (미작성분 순차 작성) ──
  function startWriteAll() {
    const drafts = docCards.filter((c: VoucherDocCardVM) => !c.isSubmitted)
    if (drafts.length === 0) {
      snackbarStore.success('작성할 서류가 없어요')
      return
    }
    const [first, ...rest] = drafts
    openWriteDocument(first, rest)
  }

  // ── 서류: 연결 해제 ──
  async function handleUnlinkDocument(card: VoucherDocCardVM) {
    const confirmed = await modalUtils.confirm(
      '연결을 해제할까요?',
      `"${card.name}" 문서의 바우처 연결만 해제돼요. 작성본은 내담자 문서에 남아요.`,
      { type: 'warning', confirmText: '해제', cancelText: '취소' }
    )
    if (!confirmed) return
    try {
      await deleteVoucherFormInstance().request({
        centerId: requireCenterId(),
        clientVoucherId: voucherId,
        mappingId: card.mappingId
      })
      snackbarStore.success('연결이 해제되었어요')
      invalidateForms()
    } catch (err) {
      console.error('[deleteVoucherFormInstance] failed', err)
      snackbarStore.error('연결 해제에 실패했어요')
    }
  }

  // ── 일지 보기/작성 ──
  function openJournal(row: VoucherUsageRowVM) {
    if (!row.relatedSessionId) return
    const info = journalMap.get(row.relatedSessionId)
    if (!info) return
    openCounselingJournalModal({
      session: info.session,
      caseClients: info.caseClients,
      programName: info.programName,
      initialClientId: clientId,
      isSecretMode: $isSecretMode
    })
  }

  // ── 바우처 수정 ──
  function openEditVoucher() {
    if (!voucher?.id) return
    modalStore.open({
      component: VoucherFormModal,
      props: {
        mode: 'edit',
        initial: {
          centerVoucherId: voucher.center_voucher_id,
          totalSessions: String(voucher.total_sessions ?? ''),
          totalAmount:
            voucher.total_amount != null ? String(voucher.total_amount) : '',
          remainingSessions: String(voucher.remaining_sessions ?? ''),
          remainingAmount:
            voucher.remaining_amount != null
              ? String(voucher.remaining_amount)
              : '',
          validFrom: voucher.valid_from
            ? formatUtcToKst(voucher.valid_from, 'YYYY-MM-DD')
            : '',
          validUntil: voucher.valid_until
            ? formatUtcToKst(voucher.valid_until, 'YYYY-MM-DD')
            : ''
        } satisfies VoucherFormData,
        onSubmit: async (form: VoucherFormData) => {
          try {
            await patchClientVoucher().request({
              centerId: requireCenterId(),
              clientVoucherId: voucherId,
              payload: {
                total_sessions: Number(form.totalSessions),
                remaining_sessions: form.remainingSessions.trim()
                  ? Number(form.remainingSessions)
                  : null,
                total_amount: form.totalAmount.trim()
                  ? Number(form.totalAmount)
                  : null,
                remaining_amount: form.remainingAmount.trim()
                  ? Number(form.remainingAmount)
                  : null,
                valid_from: form.validFrom || null,
                valid_until: form.validUntil || null
              }
            })
            snackbarStore.success('바우처가 수정되었어요')
            queryClient.invalidateQueries({
              queryKey: ['getClientVoucherDetail'],
              exact: false
            })
            queryClient.invalidateQueries({
              queryKey: ['getClientVoucherList'],
              exact: false
            })
            queryClient.invalidateQueries({
              queryKey: ['getVoucherClientList'],
              exact: false
            })
          } catch (err) {
            console.error('[patchClientVoucher] failed', err)
            snackbarStore.error('바우처 수정에 실패했어요')
            throw err // 모달 닫지 않도록
          }
        }
      },
      options: { customWidth: 540 }
    })
  }

  // ── 바우처 삭제 ──
  async function handleDeleteVoucher() {
    const confirmed = await modalUtils.confirm(
      '바우처를 삭제할까요?',
      `"${programName}" 바우처가 삭제돼요. 삭제 후에는 되돌릴 수 없어요.`,
      { type: 'danger', confirmText: '삭제', cancelText: '취소' }
    )
    if (!confirmed) return
    try {
      await deleteClientVoucher().request({
        centerId: requireCenterId(),
        clientVoucherId: voucherId
      })
      snackbarStore.success('바우처가 삭제되었어요')
      queryClient.invalidateQueries({
        queryKey: ['getClientVoucherList'],
        exact: false
      })
      queryClient.invalidateQueries({
        queryKey: ['getVoucherClientList'],
        exact: false
      })
      goto('/vouchers')
    } catch (err) {
      console.error('[deleteClientVoucher] failed', err)
      snackbarStore.error('바우처 삭제에 실패했어요')
    }
  }

  // 바우처 목록이 사업 기준으로 바뀌면서 내담자별 2뎁스 목록은 폐기 — 목록으로 바로 돌아간다
  const goBack = () => goto('/vouchers')
  const goBill = () => goto('/billing')
</script>

<div in:fade class="mx-auto flex h-full min-h-0 flex-col bg-gray-50">
  <!-- 브레드크럼 + 시크릿 모드 -->
  <div class="mb-2 flex h-11 shrink-0 items-center justify-between">
    <div class="flex items-center gap-2">
      <button
        onclick={goBack}
        aria-label="뒤로"
        class="rounded p-1 text-gray-500 hover:bg-gray-100"
      >
        <ArrowBackIcon />
      </button>
      <button
        onclick={() => goto('/vouchers')}
        class="transition-colors hover:text-body-default"
      >
        <Typography variant="body-02-normal-regular" color="text-body-subtle">
          바우처
        </Typography>
      </button>
      <Typography variant="body-02-normal-regular" color="text-gray-300">
        /
      </Typography>
      <Typography variant="body-02-normal-medium" color="text-body-default">
        {programName}
      </Typography>
    </div>
    <SecretModeToggle />
  </div>

  <!-- 메인 컨테이너 -->
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-card"
  >
    <!-- 헤더: 뒤로 + 프로그램명 + 케밥 -->
    <header
      class="flex shrink-0 items-center gap-3 border-b border-gray-100 p-5"
    >
      <ClientAvatar
        profileImageUrl={clientQuery.data?.profile_image_url ?? null}
        name={displayClientName}
        gender={clientQuery.data?.gender}
        sizeClass="h-10 w-10"
        textClass="text-body-02-normal-semibold"
      />
      <div class="min-w-0 flex-1">
        <Typography
          variant="title-01-normal-semibold"
          color="text-gray-900"
          className="truncate-safe block"
          tag="h2"
        >
          {displayClientName}
        </Typography>
        <ClientBirthGender
          birthDate={dateToString(clientQuery.data?.birth_date, 'YYYY-MM-DD') ||
            null}
          gender={clientQuery.data?.gender}
          class="mt-2"
        />
      </div>
      <div class="-mr-2 shrink-0">
        <KebabMenu
          items={[
            {
              label: '바우처 수정',
              onClick: openEditVoucher
            },
            {
              label: '바우처 삭제',
              onClick: handleDeleteVoucher,
              variant: 'danger'
            }
          ]}
        />
      </div>
    </header>

    <!-- 본문 스크롤 영역 -->
    <div class="min-h-0 flex-1 overflow-y-auto p-5">
      <!-- 통계 바 (단일 컨테이너 + 세로 구분선) -->
      <div class="flex items-center rounded-xl bg-gray-50">
        <!-- 담당 상담사 -->
        <div class="min-w-0 flex-1 p-5">
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="block"
          >
            담당 상담사
          </Typography>
          <Typography
            variant="title-01-normal-semibold"
            color="text-gray-900"
            className="mt-3 block truncate-safe"
          >
            {counselorName
              ? $isSecretMode
                ? maskName(counselorName)
                : counselorName
              : '-'}
          </Typography>
        </div>

        <span
          class="h-12 w-px shrink-0 self-center bg-gray-200"
          aria-hidden="true"
        ></span>

        <!-- 사용 회기 -->
        <div class="min-w-0 flex-1 p-5">
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="block"
          >
            사용 회기
          </Typography>
          <div class="mt-3 flex items-baseline gap-1">
            <Typography
              variant="title-01-normal-semibold"
              color="text-gray-900"
            >
              {usedSessions}
            </Typography>
            <Typography variant="body-02-normal-medium" color="text-gray-400">
              / {voucher?.total_sessions ?? 0}회
            </Typography>
          </div>
        </div>

        <span
          class="h-12 w-px shrink-0 self-center bg-gray-200"
          aria-hidden="true"
        ></span>

        <!-- 잔여 지원금 — 지원금액은 내담자마다 다르다(사업 단위 숫자가 아니다) -->
        <div class="min-w-0 flex-1 p-5">
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="block"
          >
            잔여 지원금
          </Typography>
          <div class="mt-3 flex items-baseline gap-2">
            <Typography
              variant="title-01-normal-semibold"
              color={voucher?.remaining_amount != null &&
              voucher.remaining_amount < 0
                ? 'text-status-danger'
                : 'text-gray-900'}
            >
              {fmtAmount(voucher?.remaining_amount)}원
            </Typography>
            {#if unitPrice != null}
              <Typography
                variant="body-03-normal-regular"
                color="text-gray-400"
              >
                회기당 {unitPrice.toLocaleString()}원
              </Typography>
            {/if}
          </div>
        </div>

        <span
          class="h-12 w-px shrink-0 self-center bg-gray-200"
          aria-hidden="true"
        ></span>

        <!-- 유효기간 -->
        <div class="min-w-0 flex-1 p-5">
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="block"
          >
            유효기간
          </Typography>
          <div class="mt-3 flex items-baseline gap-2">
            <Typography
              variant="title-01-normal-semibold"
              color="text-gray-900"
            >
              {validUntilLabel ? `~${validUntilLabel}` : '-'}
            </Typography>
            <!-- 배지는 D-7 이하에만 (그 위는 날짜만) -->
            {#if ddayNum !== null && ddayNum >= 0 && ddayNum <= URGENT_DAYS}
              <Typography
                variant="body-03-normal-medium"
                color="text-status-danger"
              >
                D-{ddayNum}
              </Typography>
            {/if}
          </div>
        </div>
      </div>

      <!-- 제출 서류 -->
      <section class="mt-8">
        <div class="mb-3 flex h-8 items-center justify-between">
          <div class="flex items-center gap-2">
            <Typography
              variant="title-01-normal-semibold"
              color="text-gray-900"
            >
              제출 서류
            </Typography>
            <Typography variant="body-02-normal-regular" color="text-gray-400">
              {docCards.length}
            </Typography>
          </div>
          <button
            type="button"
            onclick={openAddDocument}
            class="flex h-8 items-center rounded-lg px-2 transition-colors hover:bg-gray-50"
          >
            <Typography variant="body-02-normal-regular" color="text-gray-500">
              추가
            </Typography>
          </button>
        </div>

        {#if formsQuery.isLoading}
          <Typography variant="body-02-normal-regular" color="text-gray-400">
            로딩 중...
          </Typography>
        {:else if docCards.length === 0}
          <!-- 빈 상태 — 아이콘 없이 안내 + 보조 액션(tertiary). 사용 내역과 같은 규격 -->
          <div class="flex flex-col items-center justify-center gap-3 py-10">
            <Typography
              variant="body-02-normal-regular"
              color="text-body-subtle"
            >
              연결된 서류가 없어요
            </Typography>
            <button
              type="button"
              onclick={openAddDocument}
              class="h-10 rounded-lg bg-gray-100 px-6 text-body-02-normal-medium text-gray-600 transition-colors hover:bg-gray-200"
            >
              서류 추가
            </button>
          </div>
        {:else}
          <div
            class="grid gap-3"
            style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));"
          >
            {#each docCards as card (card.mappingId)}
              <div class="flex flex-col rounded-xl border border-gray-200 p-4">
                <div class="flex items-center justify-between">
                  <span
                    class="flex h-6 w-fit items-center rounded-sm px-2 text-label-01-normal-medium {card.isSubmitted
                      ? 'bg-status-success-bg text-status-success'
                      : 'bg-gray-100 text-gray-500'}"
                  >
                    {card.isSubmitted ? '작성 완료' : '미작성'}
                  </span>
                  <Tooltip text="연결 해제">
                    <button
                      type="button"
                      onclick={() => handleUnlinkDocument(card)}
                      aria-label="연결 해제"
                      class="flex items-center justify-center rounded-lg p-1 transition-colors hover:bg-status-danger-bg"
                    >
                      <TrashIcon />
                    </button>
                  </Tooltip>
                </div>
                <Typography
                  variant="body-01-normal-semibold"
                  color="text-gray-900"
                  className="mt-3 block truncate-safe"
                >
                  {card.name}
                </Typography>
                {#if card.isSubmitted}
                  <button
                    type="button"
                    onclick={() => openWriteDocument(card)}
                    class="mt-3 h-10 w-full rounded-lg bg-gray-100 text-body-02-normal-medium text-gray-600 transition-colors hover:bg-gray-200"
                  >
                    미리보기
                  </button>
                {:else}
                  <button
                    type="button"
                    onclick={() => openWriteDocument(card)}
                    class="mt-3 h-10 w-full rounded-lg border border-primary-400 text-body-02-normal-medium text-primary-500 transition-colors hover:bg-primary-50"
                  >
                    작성
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </section>

      <!-- 사용 내역 -->
      <section class="mt-10">
        <div class="mb-2 flex items-center gap-1.5">
          <Typography variant="title-01-normal-semibold" color="text-gray-900">
            사용 내역
          </Typography>
          {#if usageRows.length > 0}
            <Typography variant="body-02-normal-regular" color="text-gray-400">
              {usageRows.length}
            </Typography>
          {/if}
        </div>

        {#if usageQuery.isLoading}
          <div class="py-10 text-center">
            <Typography variant="body-02-normal-regular" color="text-gray-400">
              로딩 중...
            </Typography>
          </div>
        {:else if usageRows.length === 0}
          <!-- 빈 상태 — 제출 서류와 같은 규격(아이콘 없음 · 한 줄 안내) -->
          <div class="flex flex-col items-center justify-center gap-3 py-10">
            <Typography
              variant="body-02-normal-regular"
              color="text-body-subtle"
            >
              아직 이 바우처로 청구한 내역이 없어요
            </Typography>
          </div>
        {:else}
          <ul>
            {#each usageRows as row (row.billableItemId)}
              {@const journal = row.relatedSessionId
                ? journalMap.get(row.relatedSessionId)
                : undefined}
              <li
                class="flex items-center gap-4 border-b border-gray-100 py-4 last:border-b-0"
              >
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-500"
                  className="w-20 shrink-0"
                >
                  {row.dateLabel}
                </Typography>

                <div class="min-w-0 flex-1">
                  <Typography
                    variant="body-01-normal-semibold"
                    color="text-gray-900"
                    className="block truncate-safe"
                  >
                    {row.description}
                  </Typography>
                  <div class="mt-2 flex items-center gap-2.5">
                    <span class="flex items-baseline gap-1">
                      <Typography
                        variant="body-02-normal-regular"
                        color="text-gray-500"
                      >
                        단가
                      </Typography>
                      <Typography
                        variant="body-02-normal-medium"
                        color="text-gray-700"
                      >
                        {fmtAmount(row.amount)}원
                      </Typography>
                    </span>
                    <span class="h-3 w-px bg-gray-300" aria-hidden="true"
                    ></span>
                    <span class="flex items-baseline gap-1">
                      <Typography
                        variant="body-02-normal-regular"
                        color="text-gray-500"
                      >
                        지원 금액
                      </Typography>
                      <Typography
                        variant="body-02-normal-medium"
                        color="text-gray-700"
                      >
                        {fmtAmount(row.subsidyAmount)}원
                      </Typography>
                    </span>
                  </div>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onclick={goBill}
                    class="flex h-10 items-center justify-center gap-2 rounded-lg border border-billing-line px-6 text-billing-fg transition-colors hover:border-billing-line-hover hover:bg-billing-surface-hover hover:text-billing-fg-hover"
                  >
                    {@render billIcon()}
                    <Typography
                      variant="body-02-normal-medium"
                      color="text-current"
                    >
                      청구서
                    </Typography>
                  </button>

                  {#if journal}
                    {#if journal.hasNote}
                      <button
                        type="button"
                        onclick={() => openJournal(row)}
                        class="flex h-10 items-center rounded-lg border border-gray-200 px-6 text-body-02-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <Typography
                          variant="body-02-normal-medium"
                          color="text-gray-700"
                        >
                          일지 보기
                        </Typography>
                      </button>
                    {:else}
                      <Tooltip text="작성 안된 상담일지가 있어요">
                        <button
                          type="button"
                          onclick={() => openJournal(row)}
                          class="flex h-10 items-center rounded-lg border border-primary-400 px-6 text-body-02-normal-medium text-primary-500 transition-colors hover:bg-primary-50"
                        >
                          일지 작성
                        </button>
                      </Tooltip>
                    {/if}
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>

    <!-- 푸터: 미작성 서류 일괄 작성 (목록의 `서류 준비`와 짝) -->
    <!-- 하단 고정 버튼 영역 = §Components>modal Footer 규격
         (패딩 좌우·하단 20 · 상단 16 · 상단 1px 보더 · 버튼 높이 44 · 버튼 간 12) -->
    <footer
      class="flex shrink-0 items-center justify-between border-t border-gray-200 bg-white px-5 pt-4 pb-5"
    >
      <!-- 연결된 서류가 없으면 완료 문구를 띄우지 않는다(작성할 게 없는 것과 다 쓴 것은 다르다) -->
      {#if docCards.length > 0}
        <Typography
          variant="body-01-normal-medium"
          color={pendingDocCount > 0 ? 'text-gray-800' : 'text-primary-500'}
        >
          {pendingDocCount > 0
            ? `미작성 ${pendingDocCount}건`
            : '서류가 모두 작성됐어요'}
        </Typography>
      {:else}
        <span></span>
      {/if}
      <button
        type="button"
        disabled={pendingDocCount === 0}
        onclick={startWriteAll}
        class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600 disabled:bg-action-primary-disabled disabled:text-action-primary-disabled-fg"
      >
        전체 서류 작성
      </button>
    </footer>
  </div>
</div>

{#snippet billIcon()}
  <!-- Medium(40) 버튼의 아이콘 = 20 (§button 높이→아이콘 매핑) -->
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
    <path
      d="M4 2.5h6l2.5 2.5V13a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V3A.5.5 0 0 1 4 2.5Z"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linejoin="round"
    />
    <path
      d="M6 7.5h4M6 10h3"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
    />
  </svg>
{/snippet}
