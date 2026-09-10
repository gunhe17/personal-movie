<script lang="ts">
	interface Props {
		jsonString: string | null
		maxHeight?: string
	}

	let { jsonString, maxHeight = '400px' }: Props = $props()

	const JSON_FIELD_LABELS: Record<string, string> = {
		main_issues: '주요 호소 문제',
		observations: '관찰 사항',
		intervention: '개입 내용',
		interventions: '개입 내용',
		recommendations: '추천 사항',
		next_steps: '다음 단계',
		risk_assessment: '위험 평가',
		progress: '진행 상황',
		goals: '상담 목표',
		summary: '요약',
		client_mood: '내담자 정서',
		counselor_notes: '상담사 메모',
	}

	const parsed = $derived(() => {
		if (!jsonString) return null
		try {
			return JSON.parse(jsonString) as Record<string, unknown>
		} catch {
			return null
		}
	})
</script>

<div class="overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-3.5" style="max-height: {maxHeight};">
	{#if parsed()}
		<dl class="space-y-3">
			{#each Object.entries(parsed()!) as [key, value]}
				<div>
					<dt class="text-label-01-normal-bold text-gray-500">
						{JSON_FIELD_LABELS[key] ?? key}
					</dt>
					<dd class="mt-1 text-label-01-normal-regular leading-relaxed text-gray-600">
						{#if Array.isArray(value)}
							<ul class="list-inside list-disc space-y-0.5">
								{#each value as item}
									<li>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
								{/each}
							</ul>
						{:else if typeof value === 'string'}
							<span class="whitespace-pre-wrap">{value}</span>
						{:else}
							<pre class="whitespace-pre-wrap font-mono text-label-01-normal-regular">{JSON.stringify(value, null, 2)}</pre>
						{/if}
					</dd>
				</div>
			{/each}
		</dl>
	{:else if jsonString}
		<pre class="whitespace-pre-wrap break-words font-mono text-label-01-normal-regular leading-relaxed text-gray-600">{jsonString}</pre>
	{:else}
		<span class="text-label-01-normal-regular text-gray-300">(출력 없음)</span>
	{/if}
</div>
