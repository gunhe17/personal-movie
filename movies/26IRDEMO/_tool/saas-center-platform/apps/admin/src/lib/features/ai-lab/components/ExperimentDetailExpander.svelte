<script lang="ts">
	import type { ExperimentDetailVM } from '../experiments/view-model'
	import OutputTextDisplay from './OutputTextDisplay.svelte'
	import JsonOutputRenderer from './JsonOutputRenderer.svelte'

	interface Props {
		detail: ExperimentDetailVM | null
		isLoading: boolean
		experimentType?: string
		qualityScore?: number | null
		onRate?: ((score: number) => void) | undefined
	}

	let { detail, isLoading, experimentType, qualityScore, onRate }: Props = $props()

	const isJsonType = $derived(
		experimentType === 'llm_counseling_note' && detail?.outputJson
	)
</script>

<div class="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<div class="flex items-center gap-2 text-label-01-normal-regular text-gray-400">
				<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
				</svg>
				결과 불러오는 중...
			</div>
		</div>
	{:else if detail}
		<!-- 메타데이터 바 -->
		<div class="mb-3 flex flex-wrap items-center gap-2">
			<span class="rounded-md bg-gray-100 px-2 py-0.5 text-label-01-normal-regular font-mono text-gray-500">{detail.modelName}</span>
			<span class="rounded-md bg-gray-100 px-2 py-0.5 text-label-01-normal-regular text-gray-500">{detail.provider}</span>
			{#if detail.latency !== '-'}
				<span class="text-label-01-normal-regular text-gray-400">지연 {detail.latency}</span>
			{/if}
			{#if detail.cost !== '-'}
				<span class="text-label-01-normal-medium text-gray-600">{detail.cost}</span>
			{/if}
			{#if detail.inputTokens !== '-'}
				<span class="text-label-01-normal-regular text-gray-400">입력 {detail.inputTokens}</span>
			{/if}
			{#if detail.outputTokens !== '-'}
				<span class="text-label-01-normal-regular text-gray-400">출력 {detail.outputTokens}</span>
			{/if}
			{#if detail.audioDuration !== '-'}
				<span class="text-label-01-normal-regular text-gray-400">오디오 {detail.audioDuration}</span>
			{/if}
		</div>

		<!-- 품질 평가 -->
		{#if onRate}
			<div class="mb-3 flex items-center gap-1.5">
				<span class="text-label-01-normal-regular text-gray-500">품질:</span>
				{#each [1, 2, 3, 4, 5] as score}
					<button
						class="h-6 w-6 rounded text-label-01-normal-medium transition-colors
							{qualityScore === score ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
						onclick={() => onRate?.(score)}
					>{score}</button>
				{/each}
			</div>
		{/if}

		<!-- 에러 메시지 -->
		{#if detail.errorMessage}
			<div class="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
				<span class="text-label-01-normal-medium text-red-700">오류</span>
				<p class="mt-1 text-label-01-normal-regular text-red-600">{detail.errorMessage}</p>
			</div>
		{/if}

		<!-- 출력 텍스트 -->
		{#if isJsonType}
			<span class="mb-1.5 block text-label-01-normal-medium text-gray-500">출력 결과 (구조화)</span>
			<JsonOutputRenderer jsonString={detail.outputJson} />
		{:else}
			<OutputTextDisplay text={detail.outputText} label="출력 결과" maxHeight="400px" />
		{/if}

		<!-- 입력 텍스트 (접을 수 있음) -->
		{#if detail.inputText}
			<div class="mt-3">
				<OutputTextDisplay
					text={detail.inputText}
					label="입력 텍스트 (미리보기)"
					maxHeight="200px"
					isCollapsible={true}
				/>
			</div>
		{/if}
	{:else}
		<div class="flex items-center justify-center py-6">
			<span class="text-label-01-normal-regular text-gray-400">상세 정보를 불러올 수 없습니다.</span>
		</div>
	{/if}
</div>
