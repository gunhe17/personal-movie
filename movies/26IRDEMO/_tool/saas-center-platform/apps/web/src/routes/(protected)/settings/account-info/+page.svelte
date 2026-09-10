<script lang="ts">
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import LoginInfoCard from '$lib/components/account-info/LoginInfoCard.svelte'
  import AccountSettingsPanel from '$lib/components/account-info/AccountSettingsPanel.svelte'
  import ConfirmModal from '$lib/components/modal/ConfirmModal.svelte'
  import PasswordConfirmModal from '$lib/components/modal/PasswordConfirmModal.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import {
    getMe,
    postLogout,
    postChangePassword,
    patchUpdatePerson,
    deleteWithdraw
  } from '$lib/hooks/actions/auth.action'
  import AccountEditModal from '$lib/components/modal/AccountEditModal.svelte'
  import { deleteLeaveCenter } from '$lib/hooks/actions/center.action'
  import { modalStore } from '$lib/stores/modal'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { auth } from '$lib/stores/auth'
  import { centerStore } from '$lib/stores/center.store'
  import { responsive } from '$lib/stores/responsive.svelte'

  const isOverlayMode = $derived(!responsive.isDesktop)

  const queryClient = useQueryClient()
  const meQuery = queryBuilder(getMe)

  const me = $derived(meQuery.data)
  const isLoading = $derived(meQuery.isPending)
  const isError = $derived(meQuery.isError)
  const error = $derived(meQuery.error)

  // 비밀번호 변경 로딩 상태
  let changePwLoading = $state(false)

  async function handleEditAccountInfo() {
    if (!me?.person) return

    await modalStore.openWithPromise(
      AccountEditModal,
      {
        email: me.account.email,
        name: me.person.name,
        phone: me.person.phone,
        onConfirm: async (data: { name: string; phone: string }) => {
          await patchUpdatePerson().request({
            personId: me!.person!.id,
            payload: { name: data.name, phone: data.phone }
          })
          snackbarStore.success('계정 정보가 수정되었습니다.')
          queryClient.invalidateQueries({ queryKey: ['getMe'] })
        }
      },
      { customWidth: 540 }
    )
  }

  async function handleLogout() {
    try {
      await postLogout().request()
      goto('/login')
    } catch {
      snackbarStore.error('로그아웃에 실패했습니다.')
    }
  }

  async function handleChangePassword(
    currentPassword: string,
    newPassword: string
  ) {
    if (!currentPassword || !newPassword) {
      snackbarStore.error('비밀번호를 입력해 주세요.')
      return
    }
    if (newPassword.length < 8) {
      snackbarStore.error('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }

    // 확인 모달
    const confirmed = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '비밀번호를 변경할까요?',
        cancelText: '닫기',
        confirmText: '변경',
        type: 'warning'
      },
      { size: 'sm' }
    )

    if (confirmed !== 'confirmed') return

    changePwLoading = true
    try {
      await postChangePassword().request({
        current_password: currentPassword,
        new_password: newPassword
      })

      snackbarStore.success('비밀번호가 변경되었어요. 다시 로그인해 주세요.')
      goto('/login')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || '비밀번호 변경에 실패했습니다.'
      snackbarStore.error(msg)
    } finally {
      changePwLoading = false
    }
  }

  async function handleLeaveCenter(centerId: string, centerName: string) {
    const confirmed = await modalStore.openWithPromise(
      PasswordConfirmModal,
      {
        title: `'${centerName}' 센터에서 탈퇴할까요?`,
        message: '탈퇴 후에는 해당 센터의 데이터에 접근할 수 없어요.',
        passwordLabel: '본인 확인을 위해 비밀번호를 입력해주세요',
        cancelText: '닫기',
        confirmText: '탈퇴',
        type: 'warning'
      },
      { size: 'sm' }
    )

    if (confirmed !== 'confirmed') return

    try {
      await deleteLeaveCenter().request({ centerId })

      const currentCenterId = centerStore.getCurrentCenterId()

      if (currentCenterId === centerId) {
        snackbarStore.success(
          `'${centerName}' 센터에서 탈퇴했습니다. 다시 로그인해 주세요.`
        )
        await auth.logout()
        goto('/login')
      } else {
        snackbarStore.success(`'${centerName}' 센터에서 탈퇴했습니다.`)
        queryClient.invalidateQueries({ queryKey: ['getMe'] })
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || '센터 탈퇴에 실패했습니다.'
      snackbarStore.error(msg)
    }
  }

  async function handleWithdraw() {
    const confirmed = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '정말 탈퇴하시겠어요?',
        message: '탈퇴시 계정이 삭제되며, 복구되지 않아요',
        cancelText: '닫기',
        confirmText: '탈퇴',
        type: 'warning'
      },
      { size: 'sm' }
    )

    if (confirmed !== 'confirmed') return

    try {
      await deleteWithdraw().request()
      snackbarStore.success('회원 탈퇴가 완료되었습니다.')
      await auth.logout()
      goto('/login')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || '회원 탈퇴에 실패했습니다.'
      snackbarStore.error(msg)
    }
  }
</script>

<div in:fade class="flex min-h-full bg-gray-50 flex-col">
  <PageTitleSection title="계정 정보" className="mb-4" />

  {#if isLoading}
    <div class="rounded-2xl border border-gray-200 bg-white p-6">
      <p class="text-body-02-normal-regular text-gray-500">로딩 중...</p>
    </div>
  {:else if isError && error}
    <div class="rounded-2xl border border-gray-200 bg-white p-6">
      <p class="text-body-02-normal-regular text-status-danger">
        {error instanceof Error
          ? error.message
          : '계정 정보를 불러오지 못했어요'}
      </p>
    </div>
  {:else if me}
    <!-- 상세 2분할 — 좌측 폭은 비율 토큰(--spacing-detail-side), 카드 사이 gap 16.
         (Web_Design.md §Layout Patterns > 2분할 좌측 패널 폭 · 콘텐츠 컨테이너 표준) -->
    <div
      class={isOverlayMode
        ? 'flex flex-col gap-4'
        : 'grid flex-1 grid-cols-[var(--spacing-detail-side)_1fr] items-stretch gap-4'}
      style="min-height: 0"
    >
      <!-- 왼쪽: 로그인 정보 -->
      <LoginInfoCard
        account={me.account}
        person={me.person}
        onEdit={handleEditAccountInfo}
        onLogout={handleLogout}
      />

      <!-- 오른쪽: 탭 콘텐츠 -->
      <AccountSettingsPanel
        centers={me.centers}
        onLeaveCenter={handleLeaveCenter}
        onChangePassword={handleChangePassword}
        onWithdraw={handleWithdraw}
        {changePwLoading}
      />
    </div>
  {:else}
    <div class="rounded-2xl border border-gray-200 bg-white p-6">
      <p class="text-body-02-normal-regular text-gray-500">
        계정 정보를 불러올 수 없어요
      </p>
    </div>
  {/if}
</div>
