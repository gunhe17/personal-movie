<script lang="ts">
  import OnlineIcon from '$lib/assets/OnlineIcon.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    name_kr: string
    name_en: string
    symbol_color: string
    is_online_available: boolean
  }

  let { name_kr, name_en, symbol_color, is_online_available }: Props = $props()
</script>

<div class="flex items-center gap-3 py-3">
  <div class="flex-center relative h-12 w-12">
    <div
      class={`flex-center h-10 w-10 flex-wrap rounded-full ${symbol_color}`}
      style="background: {symbol_color};"
    >
      <Typography
        variant="caption-01-reading-medium"
        className="max-w-[31px] text-center"
        color={'text-white'}
      >
        {name_en}
      </Typography>
    </div>
    {#if is_online_available}
      <OnlineIcon className="absolute -right-0.5 -bottom-0.5" />
    {/if}
  </div>
  <div class="flex flex-col gap-2">
    <Typography variant="title-02-semibold" color={'text-gray-700'}
      >{name_en}</Typography
    >
    <Typography variant="body-02-regular" color={'text-gray-600'}
      >{name_kr}</Typography
    >
  </div>
</div>
