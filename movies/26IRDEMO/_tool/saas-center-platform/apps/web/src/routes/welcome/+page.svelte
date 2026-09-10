<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import ArrowLeftIcon24 from '$lib/assets/ArrowLeftIcon24.svelte'
  import MindScopeLogo from '$lib/assets/MindScopeLogo.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import Button from '$lib/components/Button.svelte'
  import {
    getCenters,
    type Center,
    type CenterApplication
  } from '$lib/hooks/actions/center.action'
  import { centerStore } from '$lib/stores/center.store'
  import { auth } from '$lib/stores/auth'
  import Typography from '@common/components/Typography.svelte'
  import BuildingIcon54 from '$root/src/lib/assets/BuildingIcon54.svelte'
  import PlusIcon20 from '$root/src/lib/assets/PlusIcon20.svelte'
  import PlusWhiteIcon20 from '$root/src/lib/assets/PlusWhiteIcon20.svelte'

  let centers = $state<Center[]>([])
  let applications = $state<CenterApplication[]>([])
  let loading = $state(true)
  let error = $state('')

  const userName = $derived(page.data?.user?.name ?? '')
  const pendingApps = $derived(
    applications.filter((a) => a.status === 'PENDING')
  )
  const hasContent = $derived(centers.length > 0 || pendingApps.length > 0)

  /**
   * 리스트 카드 — §Components>card / §Rounded.
   * radius 16(`rounded-2xl`) · 회색 배경 위이므로 외곽선 border-subtle ·
   * at-rest 그림자는 shadow-card · 패딩 좌우 20 / 상단 24 / 하단 20.
   */
  const CARD_CLASS =
    'flex items-center gap-4 rounded-2xl border border-border-subtle bg-white px-5 pt-6 pb-5 shadow-card'

  async function loadCenters() {
    loading = true
    error = ''
    try {
      const res = await getCenters().request({ limit: 100 })
      centers = res?.centers ?? []
      applications = res?.applications ?? []
      if (centers.length > 0) {
        centerStore.setCenters(res.centers)
      }
    } catch (err) {
      console.error('[welcome] getCenters', err)
      error = '센터 목록을 불러오는데 실패했습니다.'
    } finally {
      loading = false
    }
  }

  $effect(() => {
    if (page.data?.user) {
      loadCenters()
    }
  })

  function handleNewCenter() {
    goto('/welcome/register')
  }

  function handleSelectCenter(centerId: string) {
    centerStore.setCurrentCenterId(centerId)
    goto('/dashboard')
  }

  function handleSwitchAccount() {
    auth.logout()
    goto('/login')
  }
</script>

<!-- 헤더 -->
<header
  class="flex h-16 items-center justify-between border-b border-border-subtle bg-white px-4"
>
  <div class="flex items-center gap-2">
    <Tooltip text="뒤로가기">
      <!-- icon-button 44×44 · radius 8 (§Components>icon-button) -->
      <button
        type="button"
        onclick={handleSwitchAccount}
        class="flex h-11 w-11 items-center justify-center rounded-lg text-title-subtitle transition-colors hover:bg-bg-base"
        aria-label="뒤로가기"
      >
        <ArrowLeftIcon24 />
      </button>
    </Tooltip>
    <MindScopeLogo />
  </div>
  <button
    type="button"
    onclick={handleSwitchAccount}
    class="text-body-03-normal-regular text-body-subtle transition-colors hover:text-body-default"
  >
    다른 계정으로 로그인
  </button>
</header>

<div
  class="flex min-h-[calc(100vh-64px)] flex-col items-center bg-bg-base px-4 pt-16"
>
  <div class="w-full max-w-lg">
    <!-- 환영 인사 — 타이틀 XL(24 SemiBold) + 서브내용 Body_02(15) (§Title system) -->
    <div class="flex flex-col items-center text-center">
      <Typography
        variant="headline-01-normal-semibold"
        color="text-title-default"
        className="mb-1"
      >
        {userName}님, 반가워요!
      </Typography>
      {#if hasContent && !loading}
        <Typography variant="body-02-normal-regular" color="text-body-subtle">
          참여할 센터를 선택해주세요
        </Typography>
      {/if}
    </div>

    {#if loading}
      <!-- 로딩 스켈레톤 — 도착할 카드와 같은 치수(84 = 24+40+20) (§loading-skeleton) -->
      <div class="mt-8 flex flex-col gap-4">
        {#each [0, 1] as i (i)}
          <div class="skeleton h-21 w-full rounded-2xl"></div>
        {/each}
      </div>
    {:else if error}
      <div class="mt-8 text-center">
        <p class="text-body-02-normal-regular text-status-danger">{error}</p>
        <button
          type="button"
          onclick={loadCenters}
          class="mt-4 text-body-02-normal-medium text-action-primary hover:underline"
        >
          다시 시도
        </button>
      </div>
    {:else if !hasContent}
      <!-- 빈 상태 — 대형 컨테이너 카드(radius 16 · padding 24 · shadow-card) -->
      <div
        class="mt-8 rounded-2xl border border-border-subtle bg-white px-6 py-10 shadow-card"
      >
        <div class="flex flex-col items-center text-center">
          <div class="mb-5">
            <BuildingIcon54 />
          </div>
          <Typography
            variant="headline-02-normal-semibold"
            color="text-title-default"
            className="mb-3"
          >
            가입된 센터가 없어요
          </Typography>
          <Typography
            variant="body-01-reading-regular"
            color="text-body-default"
          >
            새 센터를 만들거나, 초대 링크로 기존 센터에 참여할 수 있어요.
          </Typography>
          <Button
            color="primary"
            size="lg"
            class="mt-6"
            contentClass="gap-2"
            onclick={handleNewCenter}
          >
            <PlusWhiteIcon20 />
            새 센터 등록
          </Button>
        </div>
      </div>
    {:else}
      <!-- 참여 중인 센터 -->
      {#if centers.length > 0}
        <div class="mt-8">
          <p class="text-body-02-normal-medium text-title-subtitle">
            참여 중인 센터
          </p>
          <div class="mt-3 flex flex-col gap-4">
            {#each centers as center}
              <div class={CARD_CLASS}>
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate-safe text-title-01-normal-semibold text-body-strong"
                  >
                    {center.name}
                  </p>
                </div>
                <Button
                  color="primary"
                  size="md"
                  content="참여"
                  class="shrink-0"
                  onclick={() => handleSelectCenter(center.id)}
                />
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 승인 대기 중인 센터 -->
      {#if pendingApps.length > 0}
        <div class="mt-8">
          <p class="text-body-02-normal-medium text-title-subtitle">
            승인 대기 중인 센터
          </p>
          <div class="mt-3 flex flex-col gap-4">
            {#each pendingApps as app}
              <div class={CARD_CLASS}>
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate-safe mb-2 text-title-01-normal-semibold text-body-strong"
                  >
                    {app.name}
                  </p>
                  <p class="text-body-02-normal-regular text-body-subtle">
                    서류를 검토하고 있어요
                  </p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 새 센터 등록 — outline-primary · Medium(40) (§button-outline / §추가 액션) -->
      <div class="mt-8 flex justify-center">
        <Button
          color="stroke-primary"
          size="md"
          contentClass="gap-2"
          onclick={handleNewCenter}
        >
          <PlusIcon20 />
          새 센터 등록
        </Button>
      </div>
    {/if}
  </div>
</div>
