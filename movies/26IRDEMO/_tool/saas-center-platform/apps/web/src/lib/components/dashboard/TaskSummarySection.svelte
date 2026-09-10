<script lang="ts">
  /**
   * 처리할 일 — 피그마 대시보드 시안(node 10655:184268).
   * 지표 카드(라벨 → 값+단위)를 가로로 나열하고, 각 카드는 처리 화면으로 이동한다.
   */
  import Typography from '@common/components/Typography.svelte'
  import TodoIcon24 from '$lib/assets/TodoIcon24.svelte.svg'

  export interface TaskSummaryItem {
    id: string
    label: string
    count: number
  }

  interface Props {
    items: TaskSummaryItem[]
    /** 건수를 아직 못 받았을 때 — 라벨은 그대로 두고 숫자 자리만 스켈레톤으로 */
    loading?: boolean
    /** 카드를 누르면 그 큐의 드릴다운 모달을 연다 */
    onOpen?: (id: string) => void
  }

  let { items, loading = false, onOpen }: Props = $props()
</script>

<section class="mx-auto flex w-full max-w-[960px] flex-col gap-4">
  <!-- 섹션 타이틀 (M 레벨 · 높이 24) -->
  <div class="flex h-6 items-center gap-1">
    <!-- 아이콘은 에셋 네이티브 크기(24) 그대로 -->
    <img src={TodoIcon24} alt="" class="block size-6 shrink-0" />
    <Typography
      variant="title-01-normal-semibold"
      color="text-gray-900"
      tag="h2"
    >
      처리할 일
    </Typography>
  </div>

  <div class="flex items-stretch gap-4">
    {#each items as item (item.id)}
      <!--
        모달이 닫히면 포커스가 이 버튼으로 돌아오며 :focus-visible 링이 남는다.
        마우스 클릭(e.detail > 0)일 때만 포커스를 놓아 링을 없애고,
        키보드 활성화(e.detail === 0)는 포커스를 유지해 접근성을 지킨다.
      -->
      <button
        type="button"
        disabled={loading}
        onclick={(e) => {
          if (e.detail > 0) e.currentTarget.blur()
          onOpen?.(item.id)
        }}
        class="group ease-smooth flex min-w-0 flex-1 flex-col gap-5 rounded-2xl bg-white p-4 text-left shadow-card transition-[translate,box-shadow] duration-500 hover:-translate-y-1.5 hover:shadow-card-hover active:-translate-y-0.5 active:duration-100 disabled:pointer-events-none motion-reduce:translate-none! motion-reduce:transition-none"
      >
        <span class="flex h-5 items-center justify-between gap-1">
          <Typography
            variant="body-02-normal-medium"
            color="text-title-subtitle"
            tag="span"
            className="min-w-0 truncate-safe"
          >
            {item.label}
          </Typography>
          <!-- hover 시 슬라이드 인 되는 이동 힌트 화살표 -->
          <svg
            class="size-4 shrink-0 -translate-x-1 text-primary-500 opacity-0 transition-[translate,opacity] duration-300 group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:translate-x-0 motion-reduce:transition-none"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <!-- 건수 행(높이 24) — 로딩 중에도 같은 높이를 차지해 카드가 튀지 않는다 -->
        {#if loading}
          <span class="flex h-6 items-center">
            <span class="skeleton h-5 w-9"></span>
          </span>
        {:else}
          <span class="flex items-center gap-1">
            <Typography
              variant="headline-01-normal-semibold"
              color="text-gray-900"
              tag="span"
              className="transition-colors duration-300 group-hover:text-primary-500"
            >
              {item.count}
            </Typography>
            <Typography
              variant="body-01-normal-medium"
              color="text-gray-700"
              tag="span"
            >
              건
            </Typography>
          </span>
        {/if}
      </button>
    {/each}
  </div>
</section>
