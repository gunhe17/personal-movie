<script lang="ts">
	import type { ExperimentDetailVM } from '../experiments/view-model'
	import { COMPARE_LABELS } from '../constants'
	import OutputTextDisplay from './OutputTextDisplay.svelte'
	import JsonOutputRenderer from './JsonOutputRenderer.svelte'

	interface Props {
		panelA: ExperimentDetailVM | null
		panelB: ExperimentDetailVM | null
		isLoadingA: boolean
		isLoadingB: boolean
		type: 'stt' | 'llm'
		experimentType?: string
		onExit: () => void
	}

	let { panelA, panelB, isLoadingA, isLoadingB, type, experimentType, onExit }: Props = $props()

	const panels = $derived([
		{ label: COMPARE_LABELS[0], data: panelA, loading: isLoadingA },
		{ label: COMPARE_LABELS[1], data: panelB, loading: isLoadingB },
	])

	const isJsonType = $derived(experimentType === 'llm_counseling_note')

	const labelColors = {
		A: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
		B: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
	}
</script>

<!-- 비교 모드 헤더 -->
<div class="mb-4 flex items-center justify-between rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5">
	<div class="flex items-center gap-2">
		<svg class="h-4 w-4 text-violet-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
		</svg>
		<span class="text-body-03-normal-semibold text-violet-700">결과 비교</span>
		<span class="text-label-01-normal-regular text-violet-500">
			{type === 'stt' ? 'STT 트랜스크립트' : 'LLM 출력'} 비교
		</span>
	</div>
	<button
		class="rounded-md border border-violet-200 bg-white px-3 py-1 text-label-01-normal-medium text-violet-600 transition-colors hover:bg-violet-50"
		onclick={onExit}
	>
		목록으로
	</button>
</div>

<!-- 비교 패널 -->
<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
	{#each panels as panel}
		{@const colors = labelColors[panel.label as 'A' | 'B']}
		<div class="rounded-xl border border-gray-200 bg-white shadow-sm">
			<!-- 패널 헤더 -->
			<div class="border-b border-gray-100 px-4 py-3">
				<div class="flex items-center gap-2">
					<span class="inline-flex h-5 w-5 items-center justify-center rounded-md text-label-01-normal-bold {colors.bg} {colors.text}">
						{panel.label}
					</span>
					{#if panel.data}
						<span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-regular font-mono text-gray-500">
							{panel.data.modelName}
						</span>
						<span class="text-label-01-normal-regular text-gray-400">{panel.data.provider}</span>
					{/if}
				</div>
			</div>

			{#if panel.loading}
				<div class="flex items-center justify-center py-16">
					<div class="flex items-center gap-2 text-label-01-normal-regular text-gray-400">
						<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
						불러오는 중...
					</div>
				</div>
			{:else if panel.data}
				<!-- 메트릭 행 -->
				<div class="flex flex-wrap gap-3 border-b border-gray-50 px-4 py-2">
					{#if panel.data.latency !== '-'}
						<div class="text-center">
							<span class="block text-label-01-normal-regular text-gray-400">지연</span>
							<span class="text-label-01-normal-medium tabular-nums text-gray-700">{panel.data.latency}</span>
						</div>
					{/if}
					{#if panel.data.cost !== '-'}
						<div class="text-center">
							<span class="block text-label-01-normal-regular text-gray-400">비용</span>
							<span class="text-label-01-normal-medium tabular-nums text-gray-700">{panel.data.cost}</span>
						</div>
					{/if}
					{#if panel.data.inputTokens !== '-'}
						<div class="text-center">
							<span class="block text-label-01-normal-regular text-gray-400">입력</span>
							<span class="text-label-01-normal-regular tabular-nums text-gray-500">{panel.data.inputTokens}</span>
						</div>
					{/if}
					{#if panel.data.outputTokens !== '-'}
						<div class="text-center">
							<span class="block text-label-01-normal-regular text-gray-400">출력</span>
							<span class="text-label-01-normal-regular tabular-nums text-gray-500">{panel.data.outputTokens}</span>
						</div>
					{/if}
					{#if panel.data.audioDuration !== '-'}
						<div class="text-center">
							<span class="block text-label-01-normal-regular text-gray-400">오디오</span>
							<span class="text-label-01-normal-regular tabular-nums text-gray-500">{panel.data.audioDuration}</span>
						</div>
					{/if}
				</div>

				<!-- 출력 텍스트 -->
				<div class="p-4">
					{#if panel.data.errorMessage}
						<div class="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
							<p class="text-label-01-normal-regular text-red-600">{panel.data.errorMessage}</p>
						</div>
					{/if}

					{#if isJsonType && panel.data.outputJson}
						<JsonOutputRenderer jsonString={panel.data.outputJson} maxHeight="500px" />
					{:else}
						<OutputTextDisplay text={panel.data.outputText} maxHeight="500px" />
					{/if}
				</div>
			{:else}
				<div class="flex items-center justify-center py-16">
					<span class="text-label-01-normal-regular text-gray-400">데이터를 불러올 수 없습니다.</span>
				</div>
			{/if}
		</div>
	{/each}
</div>
