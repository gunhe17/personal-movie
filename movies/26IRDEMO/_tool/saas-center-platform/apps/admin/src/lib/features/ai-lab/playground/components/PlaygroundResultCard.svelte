<script lang="ts">
	import type { PlaygroundResultVM } from '../view-model'
	import OutputTextDisplay from '../../components/OutputTextDisplay.svelte'
	import JsonOutputRenderer from '../../components/JsonOutputRenderer.svelte'

	interface Props {
		result: PlaygroundResultVM
		isSelected: boolean
		onToggleSelect: (id: string) => void
	}

	let { result, isSelected, onToggleSelect }: Props = $props()

	let isExpanded = $state(true)

	const isJsonType = $derived(result.experimentType === 'llm_counseling_note')
	const isFailed = $derived(result.status === 'failed')
	const isRunning = $derived(result.status === 'running')

	const statusStyles: Record<string, string> = {
		green: 'bg-green-50 border-green-200',
		red: 'bg-red-50 border-red-200',
		blue: 'bg-blue-50 border-blue-200',
		gray: 'bg-gray-50 border-gray-200',
	}
</script>

<div
	class="rounded-xl border shadow-sm transition-all {isSelected
		? 'border-violet-300 ring-1 ring-violet-200'
		: statusStyles[result.statusColor] ?? 'border-gray-200 bg-white'}"
>
	<!-- 헤더: 체크박스 + 모델 + 프롬프트 라벨 + 메트릭 -->
	<div class="flex items-start gap-2.5 px-4 py-3">
		<!-- 비교 체크박스 -->
		<label class="mt-0.5 flex shrink-0 cursor-pointer items-center">
			<input
				type="checkbox"
				checked={isSelected}
				onchange={() => onToggleSelect(result.id)}
				class="h-3.5 w-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
			/>
		</label>

		<!-- 정보 -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2 flex-wrap">
				<span class="rounded-md bg-gray-800 px-1.5 py-0.5 font-mono text-label-01-normal-medium text-white">
					{result.modelName}
				</span>
				<span class="truncate text-label-01-normal-regular text-gray-500">{result.promptLabel}</span>
				{#if isFailed}
					<span class="rounded-full bg-red-100 px-2 py-0.5 text-label-01-normal-medium text-red-600">실패</span>
				{:else if isRunning}
					<span class="rounded-full bg-blue-100 px-2 py-0.5 text-label-01-normal-medium text-blue-600">실행 중...</span>
				{/if}
			</div>

			<!-- 메트릭 바 -->
			{#if !isRunning}
				<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-label-01-normal-regular">
					{#if result.latency !== '-'}
						<span class="flex items-center gap-1 text-gray-500">
							<svg class="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="tabular-nums text-label-01-normal-medium text-gray-700">{result.latency}</span>
						</span>
					{/if}
					{#if result.cost !== '-'}
						<span class="flex items-center gap-1 text-gray-500">
							<svg class="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="tabular-nums text-label-01-normal-medium text-gray-700">{result.cost}</span>
						</span>
					{/if}
					{#if result.inputTokens !== '-'}
						<span class="text-gray-400">입력 <span class="tabular-nums text-gray-600">{result.inputTokens}</span></span>
					{/if}
					{#if result.outputTokens !== '-'}
						<span class="text-gray-400">출력 <span class="tabular-nums text-gray-600">{result.outputTokens}</span></span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- 접기/펼치기 -->
		<button
			class="mt-0.5 shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
			onclick={() => (isExpanded = !isExpanded)}
			title={isExpanded ? '접기' : '펼치기'}
		>
			<svg
				class="h-4 w-4 transition-transform {isExpanded ? 'rotate-180' : ''}"
				fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
			</svg>
		</button>
	</div>

	<!-- 출력 내용 (접기 가능) -->
	{#if isExpanded}
		<div class="border-t border-gray-100 px-4 py-3">
			{#if isFailed && result.errorMessage}
				<div class="rounded-lg border border-red-200 bg-red-50 p-3">
					<p class="text-label-01-normal-regular text-red-600">{result.errorMessage}</p>
				</div>
			{:else if isRunning}
				<div class="flex items-center justify-center py-8">
					<div class="flex items-center gap-2 text-label-01-normal-regular text-gray-400">
						<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
						실행 중...
					</div>
				</div>
			{:else if isJsonType && result.outputJson}
				<JsonOutputRenderer jsonString={result.outputJson} maxHeight="300px" />
			{:else}
				<OutputTextDisplay text={result.outputText} maxHeight="300px" />
			{/if}
		</div>
	{/if}
</div>
