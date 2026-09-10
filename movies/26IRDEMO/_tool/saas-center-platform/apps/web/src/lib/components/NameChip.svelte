<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    name: string
    onClick: () => void
    isActive: boolean
  }

  let { name, onClick, isActive = false }: Props = $props()
</script>

<button
  class="flex h-[44px] w-fit items-center rounded-lg border px-4 transition-colors {isActive
    ? 'border-primary-500 bg-primary-500'
    : 'border-gray-200 bg-white hover:bg-gray-50'}"
  onclick={onClick}
>
  <Typography
    className=""
    variant="body-02-medium"
    color={isActive ? 'text-white' : 'text-gray-500'}>{name}</Typography
  >
</button>
