<!--
  계정 상세 페이지 (관리자) — 센터 상세 페이지 디자인 패턴 따름
  /account/clients/[id]

  레이아웃:
  - 상단: 뒤로가기 + 이메일 + 상태 뱃지
  - 탭 바: 기본 정보 / 자격 정보
  - 기본 정보 탭: 기본 정보 카드 + 가입 센터 카드 (2-col grid)
  - 자격 정보 탭: AccountCredentialsTab
-->
<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'

  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import NoDataSection from '$components/NoDataSection.svelte'
  import { queryBuilder, mutationBuilder } from '$hooks/queries/builder'
  import { modalStore } from '$lib/stores/modal'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'
  import { formatDate } from '$lib/utils/format'
  import ConfirmModal from '$lib/components/modal/ConfirmModal.svelte'
  import CertifiedExpertBadge from '$lib/components/CertifiedExpertBadge.svelte'

  import {
    getAccountDetail,
    postLockAccount,
    postUnlockAccount,
    postForceLogout,
    type AccountSummary
  } from '$hooks/actions/account.action'

  import AccountCredentialsTab from './components/AccountCredentialsTab.svelte'

  // ─── 파라미터 ───
  const accountId = $derived(page.params.id!)

  // ─── 쿼리 ───
  const detailQuery = $derived(
    queryBuilder<any, any>(getAccountDetail, () => ({ accountId }))
  )

  const detail = $derived<AccountSummary | null>(detailQuery.data ?? null)
  const isLoading = $derived(detailQuery.isPending)

  // ─── 뮤테이션 ───
  const lockMutation = mutationBuilder(
    postLockAccount,
    ['getAccountDetail', 'getAccountList'],
    undefined,
    { successMessage: '계정이 잠금되었습니다.' }
  )

  const unlockMutation = mutationBuilder(
    postUnlockAccount,
    ['getAccountDetail', 'getAccountList'],
    undefined,
    { successMessage: '계정 잠금이 해제되었습니다.' }
  )

  const forceLogoutMutation = mutationBuilder(
    postForceLogout,
    ['getAccountDetail'],
    undefined,
    { successMessage: '강제 로그아웃되었습니다.' }
  )

  async function handleLock() {
    if (!detail) return
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '계정을 잠그시겠습니까?',
        message: `${detail.email} 계정의 로그인을 차단합니다.`,
        confirmText: '잠금',
        type: 'warning'
      },
      { size: 'sm' }
    )
    if (result === 'confirmed') {
      lockMutation.mutate({ accountId, reason: '관리자 잠금' })
    }
  }

  async function handleUnlock() {
    if (!detail) return
    unlockMutation.mutate({ accountId })
  }

  async function handleForceLogout() {
    if (!detail) return
    const result = await modalStore.openWithPromise(
      ConfirmModal,
      {
        title: '강제 로그아웃하시겠습니까?',
        message: `${detail.email} 계정의 모든 세션을 종료합니다.`,
        confirmText: '강제 로그아웃',
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

<div in:fade class="p-6">
  <!-- 뒤로가기 + 헤더 -->
  <div class="mb-3">
    <button
      onclick={() => goto('/account/clients')}
      class="mb-3 text-sm text-gray-500 transition-colors hover:text-gray-700"
    >
      ← 계정 목록
    </button>

    {#if isLoading}
      <Typography variant="headline-01-normal-bold" tag="h1">
        불러오는 중...
      </Typography>
    {:else if detail}
      <div class="flex items-center gap-2.5">
        {#if detail.credentials?.is_certified}
          <CertifiedExpertBadge size="md" iconOnly />
        {/if}
        <Typography variant="headline-01-normal-bold" tag="h1">
          {detail.name}({detail.email})
        </Typography>
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
    {/if}
  </div>

  {#if detail}
    <div class="space-y-4">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- 기본 정보 -->
        <div class="section-border p-6">
          <div class="mb-4 flex items-center justify-between">
            <Typography variant="title-01-normal-semibold" tag="h2">
              기본 정보
            </Typography>
            {#if canManage}
              <div class="flex items-center gap-2">
                {#if detail.is_active}
                  <Button
                    size="sm"
                    color="light-red"
                    content="강제 로그아웃"
                    onclick={handleForceLogout}
                  />
                  <Button
                    size="sm"
                    color="stroke-delete"
                    content="잠금"
                    onclick={handleLock}
                  />
                {:else}
                  <Button
                    size="sm"
                    color="stroke-primary"
                    content="잠금 해제"
                    onclick={handleUnlock}
                  />
                {/if}
              </div>
            {/if}
          </div>

          <dl class="space-y-3">
            <div class="flex">
              <dt class="w-32 shrink-0 text-sm text-gray-500">이메일</dt>
              <dd class="text-sm text-gray-900">{detail.email}</dd>
            </div>
            <div class="flex">
              <dt class="w-32 shrink-0 text-sm text-gray-500">이름</dt>
              <dd class="text-sm text-gray-900">{detail.name ?? '-'}</dd>
            </div>
            <div class="flex">
              <dt class="w-32 shrink-0 text-sm text-gray-500">연락처</dt>
              <dd class="text-sm text-gray-900">{detail.phone ?? '-'}</dd>
            </div>
            <div class="flex">
              <dt class="w-32 shrink-0 text-sm text-gray-500">가입 방식</dt>
              <dd class="text-sm text-gray-900">
                {#if providerConfig[detail.provider]}
                  {@const provider = providerConfig[detail.provider]}
                  <span
                    class="rounded-md px-2 py-0.5 text-xs font-medium {provider.bg} {provider.text}"
                  >
                    {provider.label}
                  </span>
                {:else}
                  {detail.provider}
                {/if}
              </dd>
            </div>
            <div class="flex">
              <dt class="w-32 shrink-0 text-sm text-gray-500">이메일 인증</dt>
              <dd class="text-sm text-gray-900">
                <span
                  class="rounded-md px-2 py-0.5 text-xs font-medium"
                  class:bg-green-50={detail.is_verified}
                  class:text-green-700={detail.is_verified}
                  class:bg-gray-100={!detail.is_verified}
                  class:text-gray-500={!detail.is_verified}
                >
                  {detail.is_verified ? '인증됨' : '미인증'}
                </span>
              </dd>
            </div>
            <div class="flex">
              <dt class="w-32 shrink-0 text-sm text-gray-500">가입일</dt>
              <dd class="text-sm text-gray-900">
                {formatDate(detail.created_at)}
              </dd>
            </div>
            <div class="flex">
              <dt class="w-32 shrink-0 text-sm text-gray-500">최근 로그인</dt>
              <dd class="text-sm text-gray-900">
                {detail.last_login_at ? formatDate(detail.last_login_at) : '-'}
              </dd>
            </div>
          </dl>
        </div>

        <!-- 가입 센터 -->
        <div class="section-border p-6">
          <Typography
            variant="title-01-normal-semibold"
            tag="h2"
            className="mb-4"
          >
            가입 센터 ({detail.centers.length}개)
          </Typography>

          {#if detail.centers.length === 0}
            <NoDataSection description="소속된 센터가 없습니다" />
          {:else}
            <div class="space-y-1">
              {#each detail.centers as center (center.center_id)}
                <button
                  type="button"
                  onclick={() => goto(`/center/manage/${center.center_id}`)}
                  class="flex w-full items-center justify-between rounded-lg border border-gray-100 px-3.5 py-2 text-left transition-colors hover:bg-gray-50"
                >
                  <Typography variant="body-03-normal-medium" tag="span">
                    {center.center_name}
                  </Typography>
                  <div class="flex items-center gap-2">
                    <span
                      class="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                    >
                      {center.role_name}
                    </span>
                    <span
                      class="h-2 w-2 rounded-full"
                      class:bg-green-500={center.status === 'active'}
                      class:bg-gray-300={center.status !== 'active'}
                    ></span>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
      <!-- 자격 정보 (풀폭) -->
      <div class="section-border p-6">
        <div class="mb-4 flex items-center justify-between">
          <Typography variant="title-01-normal-semibold" tag="h2">
            자격 정보
          </Typography>
          {#if detail.credentials && detail.credentials.pending > 0}
            <span
              class="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>
              검증 대기 {detail.credentials.pending}건
            </span>
          {/if}
        </div>
        <AccountCredentialsTab {accountId} />
      </div>
    </div>
  {/if}
</div>
