<script lang="ts">
	interface Props {
		text: string
		label?: string
		maxHeight?: string
		isCollapsible?: boolean
	}

	let { text, label, maxHeight = '320px', isCollapsible = false }: Props = $props()
	let isCollapsed = $state(true)
</script>

{#if label}
	{#if isCollapsible}
		<button
			class="mb-1.5 flex items-center gap-1.5 text-label-01-normal-medium text-gray-500 transition-colors hover:text-gray-700"
			onclick={() => (isCollapsed = !isCollapsed)}
		>
			<svg
				class="h-3 w-3 transition-transform {isCollapsed ? '' : 'rotate-90'}"
				fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
			><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
			{label}
		</button>
	{:else}
		<span class="mb-1.5 block text-label-01-normal-medium text-gray-500">{label}</span>
	{/if}
{/if}

{#if !isCollapsible || !isCollapsed}
	<div
		class="overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-3.5"
		style="max-height: {maxHeight};"
	>
		{#if text}
			<pre class="whitespace-pre-wrap break-words font-mono text-label-01-normal-regular leading-relaxed text-gray-600">{text}</pre>
		{:else}
			<span class="text-label-01-normal-regular text-gray-300">(출력 없음)</span>
		{/if}
	</div>
{/if}
