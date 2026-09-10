<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import ConfirmModal from './ConfirmModal.svelte'
  import Button from '$components/Button.svelte'
  import Typography from '$components/Typography.svelte'
  import Select from '$components/Select.svelte'
  import { modalStore } from '$lib/stores/modal'
  import { auth } from '$lib/stores/auth'
  import { formatDate } from '$lib/utils/format'
  import { ROLE_META, ROLE_GROUPS } from '$lib/utils/permissions'
  import { queryBuilder, mutationBuilder } from '$hooks/queries/builder'
  import {
    getAdminAccountDetail,
    patchAdminAccountRole,
    postLockAdminAccount,
    postUnlockAdminAccount,
    deleteAdminAccount,
    type AdminAccountDetail
  } from '$hooks/actions/admin-account.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    accountId: string
  }

  let { modalId = '', closeModal = () => {}, accountId }: Props = $props()

  // ─── 쿼리 ───
  const detailQuery = $derived(
    queryBuilder(getAdminAccountDetail, () => ({ accountId }))
  )
  const detail = $derived<AdminAccountDetail | null>(detailQuery.data ?? null)
  const isLoading = $derived(detailQuery.isPending)

  const myId = $derived($auth.user?.id)
  const isSelf = $derived(detail?.id === myId)
  /** 대상이 system_admin 또는 super_admin인지 (잠금/해임 불가 대상) */
  const isProtectedRole = $derived(
    detail ? ROLE_GROUPS.SUPER_PLUS.includes(detail.role as any) : false
  )

  // ─── 역할 변경 상태 ───
  let selectedRole = $state<'admin' | 'customer_service'>('admin')
  $effect(() => {
    if (detail && detail.role !== 'super_admin') {
      selectedRole = detail.role as 'admin' | 'customer_service'
    }
  })

  const ROLE_OPTIONS = [
    { value: 'admin', title: '관리자' },
    { value: 'customer_service', title: 'CS 담당자' }
  ]

  // ─── 뮤테이션 ───
  const roleMutation = mutationBuilder(
    patchAdminAccountRole,
    undefined,
    undefined,
    {
      successMessage: '역할이 변경되었습니다.'
    }
  )

  const lockMutation = mutationBuilder(
    postLockAdminAccount,
    undefined,
    undefined,
    {
      successMessage: '계정이 잠금되었습니다.',
      onSettled: () => closeModal()
    }
  )

  const unlockMutation = mutationBuilder(
    postUnlockAdminAccount,
    undefined,
    undefined,
    {
      successMessage: '잠금이 해제되었습니다.',
      onSettled: () => closeModal()
    }
  )

  const deleteMutation = mutationBuilder(
    deleteAdminAccount,
    undefined,
    undefined,
    {
      successMessage: '계정이 해임되었습니다.',
      onSettled: () => closeModal()
    }
  )

  // ─── 핸들러 ───
  async function handleRoleChange() {
    if (!detail) return
    if (selectedRole === detail.role) return

    const roleLabel = selectedRole === 'admin' ? '관리자' : 'CS 담당자'
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '역할 변경',
        message: `역할을 [${roleLabel}]로 변경하시겠습니까?`,
        confirmText: '변경',
        type: 'info'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      roleMutation.mutate({ accountId: detail.id, role: selectedRole })
    }
  }

  async function handleLock() {
    if (!detail) return
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '계정 잠금',
        message: '계정을 잠금하시겠습니까? 해당 계정은 즉시 로그아웃됩니다.',
        confirmText: '잠금',
        type: 'danger'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      lockMutation.mutate({ accountId: detail.id })
    }
  }

  async function handleUnlock() {
    if (!detail) return
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '잠금 해제',
        message: '계정 잠금을 해제하시겠습니까?',
        confirmText: '해제',
        type: 'info'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      unlockMutation.mutate({ accountId: detail.id })
    }
  }

  async function handleDelete() {
    if (!detail) return
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '계정 해임',
        message: '해당 계정을 해임하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
        confirmText: '해임',
        type: 'danger'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      deleteMutation.mutate({ accountId: detail.id })
    }
  }

  const ROLE_LABELS = ROLE_META
</script>

<BaseModal {modalId} {closeModal} headerClass="px-6 py-4" bodyClass="px-6 py-5">
  {#snippet header()}
    <Typography variant="title-02-semibold" color="text-gray-900"
      >어드민 계정 상세</Typography
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
              className="mb-1">이름</Typography
            >
            <div class="flex items-center gap-2">
              <Typography variant="body-02-normal-medium" color="text-gray-800"
                >{detail.name}</Typography
              >
              {#if isSelf}
                <span
                  class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                  >(나)</span
                >
              {/if}
            </div>
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-1">역할</Typography
            >
            {#if ROLE_LABELS[detail.role]}
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium {ROLE_LABELS[
                  detail.role
                ].bg} {ROLE_LABELS[detail.role].text}"
              >
                {ROLE_LABELS[detail.role].label}
              </span>
            {/if}
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-1">이메일</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800"
              >{detail.email}</Typography
            >
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-1">상태</Typography
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
              className="mb-1">최근 로그인</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800">
              {detail.last_login_at
                ? formatDate(detail.last_login_at, 'YYYY-MM-DD HH:mm')
                : '-'}
            </Typography>
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-1">가입일</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800">
              {formatDate(detail.created_at, 'YYYY-MM-DD')}
            </Typography>
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-1">로그인 실패</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800">
              {detail.failed_login_count}회
            </Typography>
          </div>

          <div>
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-1">잠금 해제 일시</Typography
            >
            <Typography variant="body-02-normal-medium" color="text-gray-800">
              {detail.locked_until
                ? formatDate(detail.locked_until, 'YYYY-MM-DD HH:mm')
                : '-'}
            </Typography>
          </div>
        </div>

        <!-- 역할 변경 (자기 자신 제외, system_admin/super_admin은 변경 불가) -->
        {#if !isSelf && !isProtectedRole}
          <div class="rounded-lg border border-gray-100 p-4">
            <Typography
              variant="body-03-normal-regular"
              color="text-gray-500"
              className="mb-3">역할 변경</Typography
            >
            <div class="flex items-center gap-2">
              <Select
                class="h-9 w-40 rounded-lg border border-gray-200"
                selected={selectedRole}
                options={ROLE_OPTIONS}
                on:change={(e) => (selectedRole = e.detail.value)}
              />
              <Button
                size="sm"
                color="light"
                content="변경"
                onclick={handleRoleChange}
              />
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if !isSelf && detail && !isProtectedRole}
      <Button color="light-red" content="해임" onclick={handleDelete} />
      {#if detail.is_active}
        <Button color="stroke-delete" content="잠금" onclick={handleLock} />
      {:else}
        <Button color="primary" content="잠금 해제" onclick={handleUnlock} />
      {/if}
    {:else}
      <Button color="primary" content="닫기" onclick={closeModal} />
    {/if}
  {/snippet}
</BaseModal>
