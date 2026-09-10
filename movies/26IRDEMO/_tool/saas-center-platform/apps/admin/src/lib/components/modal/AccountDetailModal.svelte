<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import ConfirmModal from './ConfirmModal.svelte'
  import Button from '$components/Button.svelte'
  import Typography from '$components/Typography.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'
  import { formatDate } from '$lib/utils/format'
  import { queryBuilder, mutationBuilder } from '$hooks/queries/builder'
  import {
    getAccountDetail,
    postLockAccount,
    postUnlockAccount,
    postForceLogout,
    type AccountSummary
  } from '$hooks/actions/account.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    accountId: string
  }

  let { modalId = '', closeModal = () => {}, accountId }: Props = $props()

  // ─── 쿼리 ───
  const detailQuery = $derived(
    queryBuilder(getAccountDetail, () => ({ accountId }))
  )

  const detail = $derived<AccountSummary | null>(detailQuery.data ?? null)
  const isLoading = $derived(detailQuery.isPending)

  // ─── 뮤테이션 ───
  const lockMutation = mutationBuilder(postLockAccount, undefined, undefined, {
    successMessage: '계정이 잠금되었습니다.',
    onSettled: () => closeModal()
  })

  const unlockMutation = mutationBuilder(
    postUnlockAccount,
    undefined,
    undefined,
    {
      successMessage: '계정 잠금이 해제되었습니다.',
      onSettled: () => closeModal()
    }
  )

  const forceLogoutMutation = mutationBuilder(
    postForceLogout,
    undefined,
    undefined,
    {
      successMessage: '강제 로그아웃되었습니다.'
    }
  )

  // ─── 확인 모달 후 실행 ───
  async function handleLock() {
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '계정 잠금',
        message: '해당 계정을 잠금 처리하시겠습니까?',
        confirmText: '잠금',
        type: 'danger'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      lockMutation.mutate({ accountId, reason: '관리자에 의한 잠금' })
    }
  }

  async function handleUnlock() {
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '잠금 해제',
        message: '해당 계정의 잠금을 해제하시겠습니까?',
        confirmText: '해제',
        type: 'info'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      unlockMutation.mutate({ accountId })
    }
  }

  async function handleForceLogout() {
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '강제 로그아웃',
        message: '해당 계정을 강제 로그아웃 하시겠습니까?',
        confirmText: '로그아웃',
        type: 'warning'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      forceLogoutMutation.mutate({ accountId })
    }
  }

  const canManage = $derived(canOperate($auth.user?.role))

  const providerConfig: Record<
    string,
    { label: string; bg: string; text: string }
  > = {
    email: { label: '이메일', bg: 'bg-gray-100', text: 'text-gray-600' },
    kakao: { label: '카카오', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    naver: { label: '네이버', bg: 'bg-green-50', text: 'text-green-700' },
    google: { label: '구글', bg: 'bg-blue-50', text: 'text-blue-700' }
  }
</script>

<BaseModal {modalId} {closeModal} headerClass="px-6 py-4" bodyClass="px-6 py-5">
  {#snippet header()}
    <Typography variant="title-02-semibold" color="text-gray-900"
      >계정 상세</Typography
    >
  {/snippet}

  {#snippet body()}
    {#if isLoading}
      <div class="flex items-center justify-center py-16">
        <Typography variant="body-02-regular" color="text-gray-400"
          >불러오는 중...</Typography
        >
      </div>
    {:else if detail}
      <div class="space-y-5">
        <!-- 기본 정보 그리드 -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">이메일</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.email}</Typography
            >
          </div>
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">상태</Typography
            >
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              class:bg-green-50={detail.is_active}
              class:text-green-700={detail.is_active}
              class:bg-red-50={!detail.is_active}
              class:text-red-600={!detail.is_active}
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                class:bg-green-500={detail.is_active}
                class:bg-red-500={!detail.is_active}
              ></span>
              {detail.is_active ? '활성' : '잠금'}
            </span>
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">이름</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.name ?? '-'}</Typography
            >
          </div>
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">연락처</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.phone ?? '-'}</Typography
            >
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">가입 방식</Typography
            >
            {#if providerConfig[detail.provider]}
              {@const provider = providerConfig[detail.provider]}
              <span
                class="rounded-md px-2 py-0.5 text-xs font-medium {provider.bg} {provider.text}"
              >
                {provider.label}
              </span>
            {:else}
              <Typography variant="body-02-normal-medium" color="text-gray-800"
                >{detail.provider}</Typography
              >
            {/if}
          </div>
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">가입일</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{formatDate(detail.created_at)}</Typography
            >
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">최근 로그인</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.last_login_at
                ? formatDate(detail.last_login_at)
                : '-'}</Typography
            >
          </div>
          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-2">이메일 인증</Typography
            >
            <span
              class="rounded-md px-2 py-0.5 text-xs font-medium"
              class:bg-green-50={detail.is_verified}
              class:text-green-700={detail.is_verified}
              class:bg-gray-100={!detail.is_verified}
              class:text-gray-500={!detail.is_verified}
            >
              {detail.is_verified ? '인증됨' : '미인증'}
            </span>
          </div>
        </div>

        <!-- 소속 센터 -->
        <div>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-500"
            className="mb-2">소속 센터</Typography
          >
          {#if detail.centers.length > 0}
            <div class="rounded-lg border border-gray-100 overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-100 bg-gray-50">
                    <th
                      class="px-3 py-2 text-left text-body-03-normal-medium text-gray-500"
                      >센터명</th
                    >
                    <th
                      class="px-3 py-2 text-left text-body-03-normal-medium text-gray-500"
                      >역할</th
                    >
                    <th
                      class="px-3 py-2 text-left text-body-03-normal-medium text-gray-500"
                      >상태</th
                    >
                  </tr>
                </thead>
                <tbody>
                  {#each detail.centers as center}
                    <tr class="border-b border-gray-50 last:border-0">
                      <td
                        class="px-3 py-2 text-body-02-normal-medium text-gray-800"
                        >{center.center_name}</td
                      >
                      <td
                        class="px-3 py-2 text-body-02-normal-regular text-gray-600"
                        >{center.role_name}</td
                      >
                      <td class="px-3 py-2">
                        <span
                          class="rounded-md px-2 py-0.5 text-xs font-medium"
                          class:bg-green-50={center.status === 'active'}
                          class:text-green-700={center.status === 'active'}
                          class:bg-gray-100={center.status !== 'active'}
                          class:text-gray-500={center.status !== 'active'}
                        >
                          {center.status === 'active' ? '활성' : '비활성'}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div
              class="flex items-center justify-center rounded-lg border border-gray-100 py-6"
            >
              <Typography variant="body-03-normal-regular" color="text-gray-400"
                >소속된 센터가 없습니다</Typography
              >
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if canManage && detail?.is_active}
      <Button color="light-red" onclick={handleForceLogout}>
        <Typography variant="body-02-regular" color="text-[#ef4967]"
          >강제 로그아웃</Typography
        >
      </Button>
      <Button color="stroke-delete" content="잠금" onclick={handleLock} />
    {:else if canManage && detail && !detail.is_active}
      <Button color="primary" content="잠금 해제" onclick={handleUnlock} />
    {:else}
      <Button color="light" content="닫기" onclick={closeModal} />
    {/if}
  {/snippet}
</BaseModal>
