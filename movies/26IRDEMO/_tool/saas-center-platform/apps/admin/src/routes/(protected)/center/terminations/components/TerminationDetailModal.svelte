<script lang="ts">
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Button from '$components/Button.svelte'
  import Typography from '$components/Typography.svelte'
  import { formatDate } from '$lib/utils/format'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'
  import {
    getRemainingDaysBadge,
    EXPORT_STATUS_LABELS
  } from '$lib/features/center-terminations/constants'
  import { createTerminationService } from '$lib/features/center-terminations/termination-service'
  import type { TerminatedCenterSummary } from '$hooks/actions/center.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    center: TerminatedCenterSummary
  }

  let { modalId = '', closeModal = () => {}, center }: Props = $props()

  const queryClient = useQueryClient()
  const service = createTerminationService({ queryClient })
  const canManage = $derived(canOperate($auth.user?.role))

  const badge = $derived(
    getRemainingDaysBadge(center.retention_remaining_days, center.is_expired)
  )

  // ─── 목업: 내보내기 요청 목록 ───
  const mockExports = [
    {
      id: '1',
      requested_by_email: 'kim@example.com',
      export_types: ['clients', 'assessments'],
      format: 'csv',
      status: 'completed',
      created_at: '2026-03-10T09:00:00'
    }
  ]
</script>

<BaseModal {modalId} {closeModal} headerClass="px-6 py-4" bodyClass="px-6 py-5">
  {#snippet header()}
    <div class="flex items-center gap-3">
      <Typography variant="title-02-semibold" color="text-gray-900">
        해지 센터 상세
      </Typography>
      <span
        class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium {badge.bg} {badge.text}"
      >
        {badge.label}
      </span>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="space-y-5">
      <!-- 기본 정보 -->
      <div class="grid grid-cols-2 gap-x-4 gap-y-4">
        <div>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="mb-2"
          >
            센터명
          </Typography>
          <Typography variant="body-02-normal-medium" color="text-gray-800">
            {center.name}
          </Typography>
        </div>
        <div>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="mb-2"
          >
            센터 코드
          </Typography>
          <span
            class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-medium text-gray-600"
          >
            {center.code}
          </span>
        </div>
        <div>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="mb-2"
          >
            대표자
          </Typography>
          <Typography variant="body-02-normal-medium" color="text-gray-800">
            {center.representative_name ?? '-'}
          </Typography>
        </div>
        <div>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="mb-2"
          >
            해지일
          </Typography>
          <Typography variant="body-02-normal-medium" color="text-gray-800">
            {formatDate(center.deleted_at)}
          </Typography>
        </div>
        <div>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="mb-2"
          >
            보관 만료일
          </Typography>
          <Typography variant="body-02-normal-medium" color="text-gray-800">
            {formatDate(center.retention_expires_at)}
          </Typography>
        </div>
        <div>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="mb-2"
          >
            잔여일
          </Typography>
          <span
            class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium {badge.bg} {badge.text}"
          >
            {center.is_expired
              ? '만료'
              : `${center.retention_remaining_days}일`}
          </span>
        </div>
      </div>

      <!-- 데이터 내보내기 요청 -->
      <div>
        <div class="mb-3 flex items-center justify-between">
          <Typography variant="body-02-normal-medium" color="text-gray-700">
            데이터 내보내기 요청
          </Typography>
          {#if !center.is_expired}
            <button
              class="text-xs font-medium text-primary-500 hover:text-primary-700"
              onclick={() => service.requestExport()}
            >
              + 요청 접수
            </button>
          {/if}
        </div>

        {#if mockExports.length > 0}
          <div class="space-y-2">
            {#each mockExports as exp}
              <div class="rounded-lg border border-gray-100 px-4 py-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-800">{exp.requested_by_email}</span>
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium
                      {exp.status === 'completed'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'}"
                  >
                    {EXPORT_STATUS_LABELS[exp.status] ?? exp.status}
                  </span>
                </div>
                <div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <div class="flex items-center gap-1">
                    {#each exp.export_types as type}
                      <span class="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{type}</span>
                    {/each}
                  </div>
                  <span class="uppercase">{exp.format}</span>
                  <span>{formatDate(exp.created_at)}</span>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div
            class="flex items-center justify-center rounded-lg border border-gray-100 py-6"
          >
            <Typography variant="body-03-normal-regular" color="text-gray-400">
              내보내기 요청이 없습니다
            </Typography>
          </div>
        {/if}
      </div>

      <!-- 안내 문구 -->
      <div class="rounded-lg bg-gray-50 px-4 py-3">
        <Typography
          variant="body-03-reading"
          color="text-gray-500"
          className="whitespace-pre-wrap"
        >
          {#if center.is_expired}
            {'보관 기간이 만료되었습니다.\n데이터를 완전 삭제하면 복구할 수 없습니다.'}
          {:else}
            {'해지 후 30일간 데이터가 보관됩니다.\n보관 기간 내 데이터 내보내기를 요청할 수 있습니다.'}
          {/if}
        </Typography>
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full items-center justify-between">
      <Button color="light" content="닫기" onclick={closeModal} />
      {#if canManage}
        <div class="flex items-center gap-2">
          {#if !center.is_expired}
            <Button
              content="해지 철회"
              onclick={() => {
                closeModal()
                service.restore(center.id, center.name)
              }}
            />
          {:else}
            <Button
              color="stroke-delete"
              content="데이터 완전 삭제"
              onclick={() => service.purge()}
            />
          {/if}
        </div>
      {/if}
    </div>
  {/snippet}
</BaseModal>
