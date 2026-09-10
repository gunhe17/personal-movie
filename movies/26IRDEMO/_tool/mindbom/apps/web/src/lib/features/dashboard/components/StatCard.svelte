<script lang="ts">
  /**
   * 대시보드 상단 요약 카드.
   *
   * 상태 색은 카드 상단에 깔리는 블러 웨이브로 전한다 — 색 막대나 테두리처럼
   * 선으로 긋는 대신 면이 은은하게 번지게 해서 숫자가 계속 주인공으로 남는다.
   * 숫자가 주인공이므로 라벨·단위는 위계를 낮추고, 카드 전체를 링크로 둔다.
   */
  interface Props {
    label: string
    value: number
    /** 숫자 옆 단위 (건, 명 등) */
    unit?: string
    /** 웨이브 색 (상태 색 hex) */
    accent?: string
    /** Material Symbols 이름 */
    icon: string
    /** 클릭 시 이동할 경로. 없으면 정적 카드 */
    href?: string
    /** 주의가 필요한 값이면 강조 */
    alert?: boolean
  }

  let {
    label,
    value,
    unit = '건',
    accent = '#9ca3af',
    icon,
    href,
    alert = false
  }: Props = $props()

  // 그라디언트 id가 카드마다 겹치면 하나의 정의를 공유해 색이 뒤섞인다.
  const uid = $props.id()
</script>

{#snippet wave()}
  <!-- 상단 웨이브 — 왼쪽에서 시작해 오른쪽으로 흘러내리는 결.
       그라디언트는 대각선(좌상 → 우하)이라 색이 흐르는 방향과 파형이 같이 간다.
       blur는 아래 경계에만 걸어 좌우 잘림이 보이지 않게 한다. -->
  <svg
    class="pointer-events-none absolute inset-x-0 top-0 h-20 w-full"
    viewBox="0 0 200 60"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="g-{uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color={accent} stop-opacity="0.3" />
        <stop offset="55%" stop-color={accent} stop-opacity="0.14" />
        <stop offset="100%" stop-color={accent} stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- 뒤쪽 결 — 더 완만하게, 조금 아래에서 -->
    <path
      d="M0,0 H200 V30 C168,44 140,50 110,44 C74,37 38,20 0,14 Z"
      fill="url(#g-{uid})"
      opacity="0.55"
    />
    <!-- 앞쪽 결 — 좌상에서 우하로 기울어 떨어진다 -->
    <path
      d="M0,0 H200 V22 C170,38 138,42 106,34 C72,26 36,12 0,8 Z"
      fill="url(#g-{uid})"
    />
  </svg>
{/snippet}

{#snippet body()}
  <div class="relative flex items-start justify-between gap-2">
    <span class="text-body-03-normal-medium text-gray-600">{label}</span>
    <span
      class="material-icons-round text-[18px]! leading-none"
      style="color: {accent}; opacity: 0.75">{icon}</span
    >
  </div>

  <div class="relative mt-auto flex items-baseline gap-1">
    <span
      class="text-[28px] leading-none font-bold tabular-nums {alert
        ? 'text-orange-600'
        : 'text-gray-900'}">{value}</span
    >
    <span class="text-label-01-normal-regular text-gray-400">{unit}</span>
  </div>
{/snippet}

{#if href}
  <a
    {href}
    class="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
  >
    {@render wave()}
    {@render body()}
  </a>
{:else}
  <div
    class="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-5"
  >
    {@render wave()}
    {@render body()}
  </div>
{/if}
