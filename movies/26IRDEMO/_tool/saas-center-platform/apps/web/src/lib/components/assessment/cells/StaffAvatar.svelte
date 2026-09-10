<script lang="ts">
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    name: string
    avatarUrl?: string
    size?: 'sm' | 'md'
  }

  let { name, avatarUrl, size = 'sm' }: Props = $props()

  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm'
  }

  const initial = $derived(name.charAt(0))
</script>

<div class="flex items-center justify-center gap-2">
  <!-- {#if avatarUrl}
		<img src={avatarUrl} alt={name} class="rounded-full object-cover {sizeClasses[size]}" />
	{:else}
		<div
			class="flex items-center justify-center rounded-full bg-gray-200 text-gray-600 {sizeClasses[size]}"
		>
			{initial}
		</div>
	{/if} -->
  <Typography variant="body-02-normal-regular" color="text-gray-800"
    >{name}</Typography
  >
</div>
