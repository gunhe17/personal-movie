<script lang="ts">
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'
	onMount(() => goto('/ai-lab/dashboard', { replaceState: true }))
</script>

<div class="flex items-center justify-center py-24">
	<div class="flex flex-col items-center gap-3">
		<div class="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-primary-500"></div>
		<span class="text-body-03-normal-regular text-gray-400">이동 중...</span>
	</div>
</div>
