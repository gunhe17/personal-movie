<script lang="ts">
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { snackbarStore } from '$lib/stores/snackbar'
  import Badge from '$components/ui/Badge.svelte'
  import { MEMBER_ROLE_CONFIG } from '$lib/features/members/constants'
  import {
    listPendingInvitations,
    revokeInvitation,
    resendInvitation,
    type InvitationListResponse,
  } from '$lib/services/api/invitations'

  const { institutionId }: { institutionId: string } = $props()

  const queryClient = useQueryClient()

  const invitationsQuery = queryBuilder<InvitationListResponse, InvitationListResponse>(
    () => ({
      key: ['listPendingInvitations'],
      request: async (params?: { institutionId: string }) => {
        if (!params?.institutionId) return { items: [], total: 0 }
        return await listPendingInvitations(params.institutionId)
      },
    }),
    () => ({ institutionId }),
    () => ({ enabled: Boolean(institutionId) })
  )

  let invitations = $derived(invitationsQuery.data?.items ?? [])
  let isLoading = $derived(invitationsQuery.isLoading)

  let actionInFlightId = $state<string | null>(null)

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  function daysUntil(dateStr: string): number {
    const d = new Date(dateStr).getTime()
    const now = Date.now()
    return Math.max(0, Math.ceil((d - now) / (1000 * 60 * 60 * 24)))
  }

  async function handleResend(invId: string) {
    if (actionInFlightId) return
    actionInFlightId = invId
    try {
      await resendInvitation(institutionId, invId)
      snackbarStore.success('초대 메일을 재발송했습니다.')
      queryClient.invalidateQueries({ queryKey: ['listPendingInvitations'], exact: false })
    } catch (err: any) {
      snackbarStore.error(err?.response?.data?.detail || '재발송에 실패했습니다.')
    } finally {
      actionInFlightId = null
    }
  }

  async function handleRevoke(invId: string) {
    if (actionInFlightId) return
    if (!confirm('이 초대를 취소하시겠습니까? 초대받은 분의 링크가 무효화됩니다.')) return
    actionInFlightId = invId
    try {
      await revokeInvitation(institutionId, invId)
      snackbarStore.success('초대를 취소했습니다.')
      queryClient.invalidateQueries({ queryKey: ['listPendingInvitations'], exact: false })
    } catch (err: any) {
      snackbarStore.error(err?.response?.data?.detail || '취소에 실패했습니다.')
    } finally {
      actionInFlightId = null
    }
  }
</script>

<div class="rounded-2xl border border-gray-200 bg-white overflow-hidden">
  {#if isLoading}
    <div class="flex h-60 items-center justify-center">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600"></div>
    </div>
  {:else if invitations.length === 0}
    <div class="flex h-60 flex-col items-center justify-center gap-3 text-gray-400">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-300">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      <p class="text-sm font-medium">대기 중인 초대가 없습니다</p>
      <p class="text-xs">발송한 초대가 수락되거나 취소되면 사라집니다</p>
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="w-full min-w-205">
        <thead>
          <tr class="border-b border-gray-100 bg-gray-50/80">
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500">이름</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">이메일</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">역할</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">발송자</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">발송일</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-gray-500">만료까지</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-gray-500">액션</th>
          </tr>
        </thead>
        <tbody>
          {#each invitations as inv (inv.id)}
            {@const roleCfg = MEMBER_ROLE_CONFIG[inv.role] ?? { label: inv.role, color: 'gray' as const }}
            {@const days = daysUntil(inv.expires_at)}
            <tr class="border-b border-gray-50 last:border-0">
              <td class="px-6 py-3.5">
                <span class="text-sm font-medium text-gray-900">{inv.name}</span>
              </td>
              <td class="px-4 py-3.5 text-sm text-gray-600">{inv.email}</td>
              <td class="px-4 py-3.5">
                <Badge label={roleCfg.label} color={roleCfg.color} />
              </td>
              <td class="px-4 py-3.5 text-sm text-gray-600">{inv.inviter_name ?? '-'}</td>
              <td class="px-4 py-3.5 text-sm text-gray-500">{formatDate(inv.created_at)}</td>
              <td class="px-4 py-3.5 text-sm">
                <span class={days <= 1 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                  {days === 0 ? '오늘 만료' : `${days}일`}
                </span>
              </td>
              <td class="px-4 py-3.5 text-right">
                <div class="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onclick={() => handleResend(inv.id)}
                    disabled={actionInFlightId !== null}
                    class="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    재발송
                  </button>
                  <button
                    type="button"
                    onclick={() => handleRevoke(inv.id)}
                    disabled={actionInFlightId !== null}
                    class="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    취소
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
