<script lang="ts">
  import ModifyIcon from '$lib/assets/ModifyIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type {
    MePersonSummary,
    MeAccountSummary
  } from '$lib/hooks/actions/auth.action'

  interface Props {
    account: MeAccountSummary
    person: MePersonSummary | null
    onEdit?: () => void
    onLogout?: () => void
  }

  let { account, person, onEdit, onLogout }: Props = $props()

  // 레이블+데이터(가로형) — 레이블 열 auto, 값은 없으면 '-'
  const infoRows = $derived([
    { label: '이름', value: person?.name ?? '' },
    { label: '로그인 이메일', value: account.email },
    { label: '연락처', value: person?.phone ?? '' }
  ] as const)
</script>

<section
  class="flex h-full min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-6"
>
  <!-- 섹션 헤더(액션 있음) — 행 높이 32 · 타이틀→콘텐츠 12 -->
  <div class="mb-3 flex h-8 items-center justify-between">
    <Typography variant="title-01-semibold" color="text-gray-900">
      로그인 정보
    </Typography>

    <button
      type="button"
      class="flex-center items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
      onclick={onEdit}
      aria-label="수정"
    >
      <ModifyIcon />
      <span class="text-body-02-normal-medium">수정</span>
    </button>
  </div>

  <!-- 프로필 이미지 (정사각형, 라운드 코너) -->
  <div class="mb-6">
    <div
      class="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-400"
      aria-hidden="true"
    >
      <svg
        class="h-10 w-10"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        />
      </svg>
    </div>
  </div>

  <!-- 데이터 행: 정보 패널 공통 레시피 (행 높이 20 · 레이블↔값 24 · 행 사이 12) -->
  <dl class="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
    {#each infoRows as row (row.label)}
      <Typography variant="body-01-normal-regular" color="text-gray-600">
        {row.label}
      </Typography>
      <Typography
        variant="body-01-normal-regular"
        color={row.value ? 'text-gray-900' : 'text-gray-400'}
        className="min-h-5 break-all"
      >
        {row.value || '-'}
      </Typography>
    {/each}
  </dl>

  <!-- 로그아웃 — 카드 맨 아래. 구분선 없이 여백만으로 떼어놓는다 -->
  <div class="mt-auto pt-6">
    <button
      type="button"
      class="h-10 w-full rounded-lg border border-gray-200 bg-white px-6 text-body-02-normal-medium text-gray-700 transition-colors hover:bg-gray-50"
      onclick={onLogout}
    >
      로그아웃
    </button>
  </div>
</section>
