<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import { FIELD_TYPE_OPTIONS } from '../../constants'

  let {
    onSelect,
    onClose
  }: { onSelect: (type: string) => void; onClose: () => void } = $props()

  // 장식(레이아웃: heading/divider)은 별도 요소 — 필드 생성 모달에서는 제외
  const groups = FIELD_TYPE_OPTIONS.filter((g) => g.group !== '레이아웃')
</script>

<div class="fixed inset-0 z-50">
  <button
    class="absolute inset-0 bg-black/30"
    aria-label="닫기"
    onclick={onClose}
  ></button>

  <div
    class="absolute left-1/2 top-1/2 max-h-[80vh] w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
  >
    <div class="mb-4 flex items-center justify-between">
      <Typography variant="title-01-normal-semibold" tag="h2"
        >요소 추가</Typography
      >
      <button
        onclick={onClose}
        aria-label="닫기"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <svg
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <div class="flex flex-col gap-4">
      {#each groups as group (group.group)}
        <div>
          <p class="mb-1.5 px-0.5 text-body-03-normal-medium text-gray-400">
            {group.group}
          </p>
          <div class="grid grid-cols-3 gap-1.5">
            {#each group.items as item (item.value)}
              <button
                onclick={() => onSelect(item.value)}
                class="h-11 rounded-lg border border-gray-200 bg-white text-body-03-normal-medium text-gray-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600"
              >
                {item.label}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
