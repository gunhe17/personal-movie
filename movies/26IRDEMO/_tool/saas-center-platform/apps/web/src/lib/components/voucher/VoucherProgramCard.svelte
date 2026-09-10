<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import VoucherCardIcon from '$lib/assets/VoucherCardIcon.svelte'
  import type { VoucherProgramCardVM } from '$lib/features/voucher/detail/view-model'

  interface Props {
    card: VoucherProgramCardVM
    onClick?: (id: string) => void
  }

  let { card, onClick }: Props = $props()
</script>

<button
  type="button"
  onclick={() => onClick?.(card.id)}
  class="flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:shadow-md"
>
  <!-- 일러스트 영역 (톤) -->
  <div
    class="relative flex h-[92px] w-full items-center justify-end overflow-hidden pr-[21px] {card.isActive
      ? 'bg-primary-50'
      : 'bg-gray-100'}"
  >
    <VoucherCardIcon
      class="shrink-0 {card.isActive ? 'text-primary-500' : 'text-gray-600'}"
    />
  </div>

  <!-- 텍스트 영역 (흰색) -->
  <div class="px-4 py-3">
    <Typography
      variant="body-02-normal-semibold"
      color={card.isActive ? 'text-gray-900' : 'text-gray-600'}
      className="truncate-safe"
      tag="p"
    >
      {card.programName}
    </Typography>
    <div class="mt-1 flex items-center gap-1.5 whitespace-nowrap">
      {#if card.year}
        <Typography
          variant="body-03-normal-regular"
          color="text-gray-500"
          tag="span"
        >
          {card.year}
        </Typography>
        <span class="h-2.5 w-px bg-gray-300" aria-hidden="true"></span>
      {/if}
      <Typography
        variant="body-03-normal-regular"
        color="text-gray-500"
        tag="span"
      >
        {card.organization || '-'}
      </Typography>
    </div>
  </div>
</button>
