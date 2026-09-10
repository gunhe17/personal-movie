<script lang="ts">
  import { slide } from 'svelte/transition'
  import { quintOut } from 'svelte/easing'
  import TabBar from '$lib/components/TabBar.svelte'
  import Checkbox from '$lib/components/Checkbox.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { MeCenterSummary } from '$lib/hooks/actions/auth.action'
  import { isManager, isSuperAdmin } from '$lib/stores/permission.view'
  import SubscriptionBillingTab from './SubscriptionBillingTab.svelte'
  import { page } from '$app/state'
  import { showSubscription } from '$lib/config/environment'

  interface Props {
    centers: MeCenterSummary[]
    onLeaveCenter?: (centerId: string, centerName: string) => void
    onChangePassword?: (currentPassword: string, newPassword: string) => void
    onWithdraw?: () => void
    changePwLoading?: boolean
  }

  let {
    centers,
    onLeaveCenter,
    onChangePassword,
    onWithdraw,
    changePwLoading = false
  }: Props = $props()

  // 구독(결제 내역) 탭은 관리자(매니저/슈퍼관리자)에게만 노출 + 리빙랩·운영 숨김 (D5)
  const canSeeSubscription = $derived(
    ($isManager || $isSuperAdmin) && showSubscription(page.url.hostname)
  )

  // 센터 탈퇴 버튼 노출 여부 — 현재는 숨김(기능·모달은 그대로 두고 진입점만 차단).
  // 다시 열 때 이 값만 true로 되돌린다.
  const SHOW_LEAVE_CENTER = false

  // 탭 상태
  let activeTab = $state('centers')
  const tabs = $derived([
    { value: 'centers', label: '소속 센터' },
    ...(canSeeSubscription ? [{ value: 'subscription', label: '구독' }] : []),
    { value: 'settings', label: '계정 설정' }
  ])

  // 아코디언 상태
  let pwOpen = $state(false)
  let withdrawOpen = $state(false)

  // 비밀번호 변경 폼
  let currentPassword = $state('')
  let newPassword = $state('')
  let newPasswordConfirm = $state('')

  // 회원 탈퇴 폼
  let withdrawConfirmed = $state(false)

  function handleChangePassword() {
    if (newPassword !== newPasswordConfirm) return
    onChangePassword?.(currentPassword, newPassword)
  }

  function handleWithdraw() {
    if (!withdrawConfirmed) return
    onWithdraw?.()
  }

  // 비밀번호 변경 버튼 비활성화 조건
  let changePwDisabled = $derived(
    changePwLoading ||
      !currentPassword ||
      !newPassword ||
      !newPasswordConfirm ||
      newPassword !== newPasswordConfirm
  )

  // 센터장인 센터가 하나라도 있으면 회원 탈퇴 불가
  let isOwnerOfAnyCenter = $derived(
    centers.some((c) => c.role_code === 'ADMIN')
  )

  // 회원 탈퇴 버튼 비활성화 조건
  let withdrawDisabled = $derived(!withdrawConfirmed || isOwnerOfAnyCenter)

  function formatDate(isoStr: string | null | undefined): string {
    if (!isoStr) return '—'
    try {
      const d = new Date(isoStr)
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
    } catch {
      return '—'
    }
  }
</script>

<!-- 프레임 컨테이너(탭 패널) — 바깥 패딩 없이 내부 셀이 24 인셋을 담당한다
     (Web_Design.md §Layout Patterns > 콘텐츠 컨테이너 표준) -->
<section
  class="flex h-full min-h-0 min-w-0 flex-col rounded-2xl border border-gray-200 bg-white"
>
  <!-- 탭바 (탭 패널 플러시 — 내 정보 우측 패널과 동일).
       pb-2 = 탭 ↔ 아래 데이터 간격을 사다리 두 단계(+8) 올린 값 —
       각 탭의 첫 블록이 가진 상단 패딩(20/16)에 공통으로 더해진다 -->
  <div class="shrink-0 px-6 pt-3 pb-2">
    <TabBar {tabs} bind:activeTab />
  </div>

  <!-- 탭 콘텐츠 -->
  <div class="min-h-0 flex-1 overflow-y-auto">
    {#if activeTab === 'centers'}
      <!-- 소속 센터 목록 -->
      {#if centers.length === 0}
        <div class="flex items-center justify-center p-12">
          <Typography variant="body-02-normal-regular" color="text-gray-500">
            소속된 센터가 없어요
          </Typography>
        </div>
      {:else}
        {#each centers as center}
          <div
            class="flex items-center gap-4 border-b border-gray-100 px-6 py-5"
          >
            <!-- 센터 로고 (이미지·이니셜 동일 40) -->
            {#if center.logo_url}
              <img
                src={center.logo_url}
                alt={center.name}
                class="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            {:else}
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-500"
              >
                <Typography variant="body-02-normal-semibold">
                  {center.name?.charAt(0) ?? ''}
                </Typography>
              </div>
            {/if}

            <!-- 센터 정보 — 리스트 아이템 제목(18) + 카드 안 레이블·값(15 · 행 사이 8) -->
            <div class="min-w-0 flex-1">
              <Typography
                className="mb-3"
                variant="title-01-semibold"
                color="text-gray-900"
              >
                {center.name}
              </Typography>
              <dl
                class="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2"
              >
                {#if center.role_name}
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-600"
                    className="min-h-5"
                  >
                    역할
                  </Typography>
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-900"
                    className="min-h-5"
                  >
                    {center.role_name}
                  </Typography>
                {/if}
                {#if center.joined_at}
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-600"
                    className="min-h-5"
                  >
                    초대일
                  </Typography>
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-900"
                    className="min-h-5"
                  >
                    {formatDate(center.joined_at)}
                  </Typography>
                {/if}
              </dl>
            </div>

            <!-- 센터 탈퇴 버튼 (tertiary · Medium 40 · 좌우 24) — SHOW_LEAVE_CENTER로 노출 제어 -->
            {#if !SHOW_LEAVE_CENTER}
              <!-- 숨김 -->
            {:else if center.role_code === 'ADMIN'}
              <div class="flex shrink-0 flex-col items-end gap-2">
                <button
                  type="button"
                  class="flex h-10 items-center justify-center rounded-lg bg-gray-50 px-6 text-body-02-normal-medium text-gray-300"
                  disabled
                >
                  센터 탈퇴
                </button>
                <Typography
                  variant="body-03-normal-regular"
                  color="text-gray-500"
                >
                  센터장은 탈퇴할 수 없어요
                </Typography>
              </div>
            {:else}
              <button
                type="button"
                class="flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-gray-100 px-6 text-body-02-normal-medium text-gray-600 transition-colors hover:bg-gray-200"
                onclick={() => onLeaveCenter?.(center.id, center.name)}
              >
                센터 탈퇴
              </button>
            {/if}
          </div>
        {/each}
      {/if}
    {:else if activeTab === 'subscription'}
      <!-- 구독 (결제 내역) 탭 -->
      <SubscriptionBillingTab {centers} />
    {:else}
      <!-- 계정 설정 탭 -->
      <div>
        <!-- 비밀번호 재설정 아코디언 -->
        <div class="border-b border-gray-100">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between px-6 py-5 text-left"
            onclick={() => {
              pwOpen = !pwOpen
              if (pwOpen) withdrawOpen = false
            }}
          >
            <div class="flex flex-col gap-2">
              <Typography variant="title-01-semibold" color="text-gray-900">
                비밀번호 재설정
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-500"
              >
                안전한 이용을 위해 비밀번호를 주기적으로 변경해주세요
              </Typography>
            </div>
            <svg
              class="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 {pwOpen
                ? 'rotate-180'
                : ''}"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {#if pwOpen}
            <div
              class="px-6 pb-6"
              transition:slide={{ duration: 250, easing: quintOut }}
            >
              <div class="space-y-5">
                <div>
                  <label for="current-pw" class="field-label mb-2">
                    현재 비밀번호
                  </label>
                  <input
                    id="current-pw"
                    type="password"
                    bind:value={currentPassword}
                    placeholder="현재 사용중인 비밀번호를 입력해주세요"
                    class="field-input w-full"
                  />
                </div>
                <div>
                  <label for="new-pw" class="field-label mb-2">
                    새로운 비밀번호
                  </label>
                  <input
                    id="new-pw"
                    type="password"
                    bind:value={newPassword}
                    placeholder="8~16자 영문, 숫자, 특수문자 조합"
                    class="field-input w-full"
                  />
                </div>
                <div>
                  <label for="confirm-pw" class="field-label mb-2">
                    비밀번호 확인
                  </label>
                  <input
                    id="confirm-pw"
                    type="password"
                    bind:value={newPasswordConfirm}
                    placeholder="비밀번호를 다시 한번 입력해주세요"
                    class="field-input w-full"
                  />
                  {#if newPasswordConfirm && newPassword !== newPasswordConfirm}
                    <!-- 입력 하단 문구 — Body_03(14)/leading-5 · 입력↔문구 4 -->
                    <p class="mt-1 field-help is-error">
                      비밀번호가 일치하지 않습니다
                    </p>
                  {/if}
                </div>

                <!-- outline-secondary · Medium(40 · 좌우 24) -->
                <button
                  type="button"
                  class="h-10 cursor-pointer rounded-lg border border-gray-200 px-6 text-body-02-normal-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-400 disabled:hover:bg-white"
                  onclick={handleChangePassword}
                  disabled={changePwDisabled}
                >
                  {changePwLoading ? '변경 중...' : '변경'}
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- 회원 탈퇴 아코디언 -->
        <div class="border-b border-gray-100">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center justify-between px-6 py-5 text-left"
            onclick={() => {
              withdrawOpen = !withdrawOpen
              if (withdrawOpen) pwOpen = false
            }}
          >
            <Typography variant="title-01-semibold" color="text-gray-900">
              회원 탈퇴
            </Typography>
            <svg
              class="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-300 {withdrawOpen
                ? 'rotate-180'
                : ''}"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {#if withdrawOpen}
            <div
              class="px-6 pb-6"
              transition:slide={{ duration: 250, easing: quintOut }}
            >
              <!-- 경고 안내 카드 (인셋 well — radius 8 · padding 16) -->
              <div class="mb-6 rounded-lg bg-gray-50 p-4">
                <Typography
                  variant="body-02-normal-medium"
                  color="text-gray-700"
                  className="mb-3 block"
                >
                  탈퇴하시기 전 아래 정보를 꼭 확인해주세요
                </Typography>
                <ul class="space-y-2">
                  <li class="flex items-start gap-2">
                    <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"
                    ></span>
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-500"
                    >
                      계정과 관련된 모든 정보가 삭제돼요.
                    </Typography>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"
                    ></span>
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-500"
                    >
                      참여 중인 센터에서 자동으로 제외돼요.
                    </Typography>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"
                    ></span>
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-500"
                    >
                      탈퇴 후에는 계정을 다시 복구할 수 없어요.
                    </Typography>
                  </li>
                  <li class="flex items-start gap-2">
                    <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400"
                    ></span>
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-500"
                    >
                      관리 중인 센터가 있다면, 다른 구성원에게 권한을 위임한 후
                      탈퇴할 수 있어요.
                    </Typography>
                  </li>
                </ul>
              </div>

              <!-- 확인 체크박스 — 공용 Checkbox · 선택지 레이블 Body_01/Medium(16) -->
              <div class="mb-6 flex items-center gap-2">
                <Checkbox
                  id="withdraw-confirm"
                  bind:checked={withdrawConfirmed}
                />
                <label
                  for="withdraw-confirm"
                  class="cursor-pointer text-body-01-normal-medium text-gray-700"
                >
                  위 내용을 모두 확인했습니다
                </label>
              </div>

              <!-- outline-caution — 되돌릴 수 없는 파괴적 액션 -->
              <button
                type="button"
                class="h-10 cursor-pointer rounded-lg border border-red-200 px-6 text-body-02-normal-medium text-status-danger transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-400 disabled:hover:bg-white"
                onclick={handleWithdraw}
                disabled={withdrawDisabled}
              >
                탈퇴
              </button>
              {#if isOwnerOfAnyCenter}
                <Typography
                  variant="body-03-normal-regular"
                  color="text-gray-500"
                  className="mt-1 block leading-5"
                >
                  센터장은 회원 탈퇴가 불가능해요. 권한을 위임한 후 다시
                  시도해주세요
                </Typography>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</section>
