<script lang="ts">
  /**
   * 필터 초기화 버튼 — 리스트/캘린더 화면 필터 바 공통.
   *
   * 규격 정본 = Web_Design.md §Components>filter-reset.
   * - `icon`(기본): 44×44 정사각 흰 버튼. 아이콘만 두므로 **툴팁이 이름을 대신한다.**
   * - `label`: 아이콘+"초기화" 회색 pill (필터가 한 줄로 끝나는 좁은 화면용).
   *
   * 두 변형 모두 hover에서 아이콘이 180° 돌고 색이 진해진다 —
   * "인터랙션만 있고 툴팁이 없다 / 툴팁만 있고 인터랙션이 없다"가 페이지마다 갈리던 것을 하나로 묶었다.
   * `disabled`(초기화할 필터 없음)면 회전·색 변화·hover 면을 전부 죽이고
   * **툴팁도 붙이지 않는다** — 누를 수 없는 버튼이 말을 걸면 상태가 흐려진다.
   */
  import RefreshIcon from '$lib/assets/RefreshIcon.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    onclick?: () => void
    /** 기본값과 다른 필터가 하나도 없으면 true */
    disabled?: boolean
    variant?: 'icon' | 'label'
    label?: string
  }

  let {
    onclick,
    disabled = false,
    variant = 'icon',
    label = '초기화'
  }: Props = $props()
</script>

<Tooltip text="필터 초기화" {disabled}>
  <button
    type="button"
    {onclick}
    {disabled}
    aria-label="필터 초기화"
    class="group flex h-11 shrink-0 items-center justify-center rounded-lg transition-colors {variant ===
    'icon'
      ? 'w-11 border bg-white'
      : 'gap-2 px-4'} {disabled
      ? variant === 'icon'
        ? 'cursor-not-allowed border-gray-100'
        : 'cursor-not-allowed bg-gray-50'
      : variant === 'icon'
        ? 'border-gray-200 hover:bg-gray-50'
        : 'bg-gray-100 hover:bg-gray-200'}"
  >
    <span
      class="transition-all duration-300 {disabled
        ? 'text-gray-300'
        : 'text-gray-500 group-hover:rotate-180 group-hover:text-gray-700'}"
    >
      <RefreshIcon />
    </span>
    {#if variant === 'label'}
      <Typography
        variant="body-01-normal-medium"
        color={disabled ? 'text-gray-300' : 'text-gray-600'}
        tag="span"
      >
        {label}
      </Typography>
    {/if}
  </button>
</Tooltip>
