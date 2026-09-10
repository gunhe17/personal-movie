<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'
  import { browser } from '$app/environment'
  import { useQueryClient } from '@tanstack/svelte-query'

  // Components
  import Typography from '@common/components/Typography.svelte'
  import ArrowBackIcon from '$root/src/lib/assets/ArrowBackIcon.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import ModifyIcon from '$lib/assets/ModifyIcon.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import ActiveToggle from '$lib/components/common/ActiveToggle.svelte'
  import Table from '$lib/components/Table.svelte'
  import type { TableColumn } from '$lib/components/Table.svelte'

  // Queries
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getFormTemplate,
    listFormSends,
    resendFormSend
  } from '$lib/hooks/actions/form.action'
  import { centerId } from '$lib/stores/center.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalUtils } from '$lib/stores/modal'

  // Feature modules
  import {
    CENTER_PAGE_ACCESS_RULE,
    CENTER_EDIT_RULE
  } from '$lib/features/center/permissions'
  import { buildTemplateDetailInput } from '$lib/features/form/template/query-builders'
  import {
    mapToTemplateDetailVM,
    mapToIssuanceRows,
    type IssuanceRowVM
  } from '$lib/features/form/template/view-model'
  import { createTemplateService } from '$lib/features/form/template/template-service'
  import FormSnapshot from '$lib/features/form/template/components/FormSnapshot.svelte'

  const queryClient = useQueryClient()
  const service = createTemplateService({ queryClient })

  const templateId = $derived($page.params.templateId ?? '')

  const detailQuery = $derived(
    queryBuilder(
      getFormTemplate,
      () => buildTemplateDetailInput($centerId!, templateId),
      {
        enabled: browser && !!$centerId && !!templateId
      }
    )
  )

  const templateDetail = $derived(
    detailQuery.data ? mapToTemplateDetailVM(detailQuery.data) : null
  )

  // 발급 내역 (전송 + 대상 + 작성 여부)
  const sendsQuery = $derived(
    queryBuilder(listFormSends, () => ({ centerId: $centerId!, templateId }), {
      enabled: browser && !!$centerId && !!templateId
    })
  )
  const issuanceRows = $derived(mapToIssuanceRows(sendsQuery.data ?? []))

  // 재전송
  let resendingKey = $state<string | null>(null)
  async function handleResend(row: IssuanceRowVM) {
    const ok = await modalUtils.confirm(
      `${row.name}님에게 작성 요청 문자를 다시 보낼까요?`,
      '재전송',
      {
        description: '동일한 내용의 문자가 재발송됩니다.',
        confirmText: '재전송',
        type: 'info'
      }
    )
    if (!ok) return

    resendingKey = row.key
    try {
      await resendFormSend().request({
        centerId: $centerId!,
        sendId: row.sendId
      })
      snackbarStore.success('작성 요청을 재전송했습니다')
      queryClient.invalidateQueries({
        queryKey: ['listFormSends'],
        exact: false
      })
    } catch {
      snackbarStore.error('재전송에 실패했습니다')
    } finally {
      resendingKey = null
    }
  }

  const issuanceColumns: TableColumn<IssuanceRowVM>[] = [
    { key: 'name', label: '대상', render: targetCell },
    { key: 'phone', label: '연락처', render: phoneCell },
    { key: 'sentAt', label: '발급 일시', render: sentAtCell },
    {
      key: 'channelLabel',
      label: '방식',
      width: '80px',
      align: 'center',
      render: channelCell
    },
    {
      key: 'statusLabel',
      label: '작성 여부',
      width: '100px',
      align: 'center',
      render: statusCell
    },
    {
      key: 'action',
      label: '',
      width: '110px',
      align: 'right',
      stopPropagation: true,
      render: actionCell
    }
  ]

  function goBack() {
    goto('/center/form-templates')
  }
</script>

{#snippet targetCell({ item }: { item: IssuanceRowVM })}
  <div class="flex min-w-0 items-center gap-2">
    <Typography
      variant="body-02-normal-medium"
      color="text-gray-800"
      tag="span"
      className="truncate-safe"
    >
      {item.name}
    </Typography>
    {#if item.relation}
      <BadgeRectangle label={item.relation} color="gray" size="sm" />
    {/if}
  </div>
{/snippet}

{#snippet phoneCell({ item }: { item: IssuanceRowVM })}
  <Typography variant="body-02-normal-regular" color="text-gray-600" tag="span">
    {item.phone}
  </Typography>
{/snippet}

{#snippet sentAtCell({ item }: { item: IssuanceRowVM })}
  <Typography variant="body-02-normal-regular" color="text-gray-600" tag="span">
    {item.sentAt}
  </Typography>
{/snippet}

{#snippet channelCell({ item }: { item: IssuanceRowVM })}
  <Typography variant="body-02-normal-regular" color="text-gray-600" tag="span">
    {item.channelLabel}
  </Typography>
{/snippet}

{#snippet statusCell({ item }: { item: IssuanceRowVM })}
  <span
    class="inline-flex h-8 w-fit items-center rounded-full px-3 text-body-02-normal-medium {item.statusBadgeText} {item.statusBadgeBg}"
  >
    {item.statusLabel}
  </span>
{/snippet}

{#snippet actionCell({ item }: { item: IssuanceRowVM })}
  <div class="flex justify-end">
    <button
      onclick={() => handleResend(item)}
      disabled={resendingKey === item.key}
      class="h-8 rounded-lg border border-primary-300 bg-white px-4 text-body-03-normal-medium text-primary-500 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
    >
      {resendingKey === item.key ? '전송 중...' : '재전송'}
    </button>
  </div>
{/snippet}

<PermissionGuard rule={CENTER_PAGE_ACCESS_RULE} showError>
  <div in:fade class="flex min-h-full flex-col bg-gray-50">
    <!-- 뒤로가기 — XL 타이틀('문서 양식')은 /center/+layout.svelte가 소유하므로
         여기서는 경로만 밝힌다(페이지당 XL은 하나, §Title system) -->
    <div class="mb-4 flex h-11 shrink-0 items-center gap-2">
      <button
        onclick={goBack}
        class="rounded-lg p-1 transition-colors hover:bg-gray-100"
        aria-label="뒤로가기"
      >
        <ArrowBackIcon />
      </button>

      <button
        onclick={goBack}
        class="transition-colors hover:text-body-default"
      >
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-body-subtle">문서 양식</Typography
        >
      </button>
      {#if templateDetail}
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-gray-300"
        >
          /
        </Typography>
        <Typography
          variant="body-02-normal-medium"
          tag="span"
          color="text-body-default"
        >
          {templateDetail.name}
        </Typography>
      {/if}
    </div>

    {#if detailQuery.isLoading}
      <div class="flex items-center justify-center py-20">
        <Typography variant="body-02-normal-regular" color="text-gray-500"
          >불러오는 중...</Typography
        >
      </div>
    {:else if templateDetail}
      <div class="flex flex-col gap-4 pb-6">
        <!-- 정보 카드 (센터 정보 스타일: 라벨–값 그리드) -->
        <div class="rounded-2xl border border-gray-200 bg-white p-6">
          <!-- 헤더: 양식명 + 액션 -->
          <section class="mb-3 flex h-11 items-center justify-between gap-4">
            <Typography
              variant="headline-02-normal-semibold"
              color="text-gray-900"
              tag="h2"
            >
              {templateDetail.name}
            </Typography>
            <PermissionGuard rule={CENTER_EDIT_RULE}>
              <div class="flex shrink-0 items-center gap-2">
                {#if templateDetail.isSystem}
                  <!-- 페이지의 Primary는 아래 '발급' 하나 — 복제는 tonal(secondary)로 한 단 낮춘다 -->
                  <button
                    onclick={() => service.openCloneModal(templateDetail)}
                    class="h-11 rounded-lg bg-primary-100 px-5 text-body-01-normal-medium text-primary-500 transition-colors hover:bg-primary-200"
                  >
                    센터용으로 복제
                  </button>
                {:else if templateDetail.isActive}
                  <button
                    onclick={() =>
                      goto(`/center/form-templates/${templateId}/edit`)}
                    aria-label="수정"
                    class="flex-center items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
                  >
                    <ModifyIcon />
                    <span class="text-body-02-normal-medium">수정</span>
                  </button>
                {/if}
              </div>
            </PermissionGuard>
          </section>

          <!-- 기본 정보 -->
          <div
            class="grid grid-cols-1 items-center gap-x-6 gap-y-3 xl:grid-cols-[auto_1fr]"
          >
            <Typography variant="body-01-normal-regular" color="text-gray-600"
              >상태</Typography
            >
            <div class="flex min-h-5 items-center">
              <ActiveToggle
                active={templateDetail.isActive}
                disabled={templateDetail.isSystem}
                onToggle={(next) =>
                  service.changeStatus(templateDetail.id, next)}
              />
            </div>

            <Typography variant="body-01-normal-regular" color="text-gray-600"
              >버전</Typography
            >
            <Typography
              variant="body-01-normal-regular"
              color="text-gray-900"
              className="min-h-5"
            >
              v{templateDetail.version}
            </Typography>

            <Typography variant="body-01-normal-regular" color="text-gray-600"
              >생성일</Typography
            >
            <Typography
              variant="body-01-normal-regular"
              color={templateDetail.createdAt
                ? 'text-gray-900'
                : 'text-gray-400'}
              className="min-h-5"
            >
              {templateDetail.createdAt || '-'}
            </Typography>

            <!-- 미리보기 (문서 스냅샷) — 위 행들과 같은 그리드라 레이블 열이 한 폭으로 정렬된다 -->
            <Typography
              variant="body-01-normal-regular"
              color="text-gray-600"
              className="self-start"
            >
              미리보기
            </Typography>
            <div class="self-start overflow-x-auto">
              <div class="flex w-max gap-4 pb-1">
                <!-- 1페이지: 문서 스냅샷 (호버 시 수정) -->
                <div
                  class="group relative aspect-[210/297] w-[220px] shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-card"
                >
                  <FormSnapshot schema={templateDetail.schema} />
                  {#if templateDetail.stats.pageCount > 1}
                    <span
                      class="absolute bottom-2 left-1/2 flex h-6 -translate-x-1/2 items-center rounded-full bg-black/50 px-2 text-label-02-normal-medium text-white"
                    >
                      1 / {templateDetail.stats.pageCount}
                    </span>
                  {/if}
                  {#if !templateDetail.isSystem && templateDetail.isActive}
                    <PermissionGuard rule={CENTER_EDIT_RULE}>
                      <button
                        onclick={() =>
                          goto(`/center/form-templates/${templateId}/edit`)}
                        aria-label="양식 수정"
                        class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-500 group-hover:bg-black/25 group-hover:opacity-100"
                      >
                        <span
                          class="flex h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-body-02-normal-medium text-gray-800 shadow-card"
                        >
                          <EditIcon class="h-5 w-5" />
                          양식 수정
                        </span>
                      </button>
                    </PermissionGuard>
                  {/if}
                </div>
                <!-- 2페이지 이후: 자리표시 (여러 페이지 대비 우측 공간 확보) -->
                {#each Array(Math.max(0, templateDetail.stats.pageCount - 1)) as _, i (i)}
                  <div
                    class="flex aspect-[210/297] w-[220px] shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-body-03-normal-regular text-gray-400"
                  >
                    {i + 2}페이지
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>

        <!-- 발급 내역 (전송 내역 · 발급 대상 · 작성 여부) -->
        <div class="rounded-2xl border border-gray-200 bg-white p-6">
          <div class="mb-3 flex h-11 items-center justify-between gap-2">
            <div class="flex items-baseline gap-1">
              <Typography
                variant="headline-02-normal-semibold"
                color="text-gray-900"
                tag="h2"
              >
                발급 내역
              </Typography>
              <Typography
                variant="body-03-normal-regular"
                color="text-title-subtitle"
                tag="span"
              >
                {issuanceRows.length}
              </Typography>
            </div>
            <PermissionGuard rule={CENTER_EDIT_RULE}>
              {#if templateDetail.isActive}
                <!-- 이 화면의 Primary(주행동) -->
                <button
                  onclick={() => service.openSendModal(templateDetail)}
                  class="h-11 rounded-lg bg-primary-500 px-5 text-body-01-normal-medium text-white transition-colors hover:bg-primary-600"
                >
                  발급
                </button>
              {/if}
            </PermissionGuard>
          </div>

          {#if sendsQuery.isLoading}
            <p
              class="py-8 text-center text-body-02-normal-regular text-gray-500"
            >
              불러오는 중...
            </p>
          {:else if issuanceRows.length > 0}
            <div class="overflow-hidden rounded-lg border border-gray-200">
              <Table
                columns={issuanceColumns}
                data={issuanceRows}
                keyField="key"
                headerClass="bg-white border-b border-gray-200"
                hoverEnabled
              />
            </div>
          {:else}
            <p
              class="py-8 text-center text-body-02-normal-regular text-gray-500"
            >
              아직 발급한 내역이 없어요
            </p>
          {/if}
        </div>
      </div>
    {:else}
      <div class="flex items-center justify-center py-20">
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          양식을 찾을 수 없어요
        </Typography>
      </div>
    {/if}
  </div>
</PermissionGuard>
