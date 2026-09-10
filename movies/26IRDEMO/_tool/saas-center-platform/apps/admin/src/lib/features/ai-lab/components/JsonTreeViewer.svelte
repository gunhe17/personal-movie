<script lang="ts">
	/**
	 * JSON Tree Viewer — 접고 펼 수 있는 구문 하이라이팅 JSON 뷰어
	 */
	interface Props {
		data: unknown
		rootOpen?: boolean
	}

	let { data, rootOpen = true }: Props = $props()
</script>

<!-- 재귀 렌더링용 snippet -->
{#snippet jsonNode(value: unknown, key: string | null, depth: number, defaultOpen: boolean)}
	{#if value === null}
		<span class="json-line">
			{#if key !== null}<span class="json-key">"{key}"</span><span class="json-colon">: </span>{/if}
			<span class="json-null">null</span>
		</span>
	{:else if typeof value === 'boolean'}
		<span class="json-line">
			{#if key !== null}<span class="json-key">"{key}"</span><span class="json-colon">: </span>{/if}
			<span class="json-bool">{String(value)}</span>
		</span>
	{:else if typeof value === 'number'}
		<span class="json-line">
			{#if key !== null}<span class="json-key">"{key}"</span><span class="json-colon">: </span>{/if}
			<span class="json-number">{value}</span>
		</span>
	{:else if typeof value === 'string'}
		<span class="json-line">
			{#if key !== null}<span class="json-key">"{key}"</span><span class="json-colon">: </span>{/if}
			<span class="json-string">"{value}"</span>
		</span>
	{:else if Array.isArray(value)}
		{@const items = value as unknown[]}
		<details class="json-details" open={defaultOpen}>
			<summary class="json-summary">
				{#if key !== null}<span class="json-key">"{key}"</span><span class="json-colon">: </span>{/if}
				<span class="json-bracket">[</span>
				<span class="json-count">{items.length}개</span>
			</summary>
			<div class="json-children">
				{#each items as item, i}
					<div class="json-child">
						{@render jsonNode(item, null, depth + 1, depth < 1)}
						{#if i < items.length - 1}<span class="json-comma">,</span>{/if}
					</div>
				{/each}
			</div>
			<span class="json-bracket">]</span>
		</details>
	{:else if typeof value === 'object'}
		{@const entries = Object.entries(value as Record<string, unknown>)}
		<details class="json-details" open={defaultOpen}>
			<summary class="json-summary">
				{#if key !== null}<span class="json-key">"{key}"</span><span class="json-colon">: </span>{/if}
				<span class="json-bracket">{'{'}</span>
				<span class="json-count">{entries.length}개 필드</span>
			</summary>
			<div class="json-children">
				{#each entries as [k, v], i}
					<div class="json-child">
						{@render jsonNode(v, k, depth + 1, depth < 1)}
						{#if i < entries.length - 1}<span class="json-comma">,</span>{/if}
					</div>
				{/each}
			</div>
			<span class="json-bracket">{'}'}</span>
		</details>
	{/if}
{/snippet}

<div class="json-tree">
	{@render jsonNode(data, null, 0, rootOpen)}
</div>

<style>
	.json-tree {
		font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace;
		font-size: 11.5px;
		line-height: 1.6;
		color: #374151;
		background: #f9fafb;
		border-radius: 0.5rem;
		padding: 1rem;
		overflow-x: auto;
	}

	.json-details {
		display: inline;
	}

	.json-summary {
		display: inline;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	.json-summary::-webkit-details-marker {
		display: none;
	}

	.json-summary::before {
		content: '▶';
		display: inline-block;
		width: 14px;
		font-size: 9px;
		color: #9ca3af;
		transition: transform 0.15s;
	}

	details[open] > .json-summary::before {
		transform: rotate(90deg);
	}

	.json-children {
		padding-left: 20px;
		border-left: 1px solid #e5e7eb;
		margin-left: 4px;
	}

	.json-child {
		display: block;
	}

	.json-key {
		color: #7c3aed;
	}

	.json-colon {
		color: #6b7280;
	}

	.json-string {
		color: #059669;
	}

	.json-number {
		color: #2563eb;
	}

	.json-bool {
		color: #d97706;
		font-weight: 600;
	}

	.json-null {
		color: #9ca3af;
		font-style: italic;
	}

	.json-bracket {
		color: #6b7280;
		font-weight: 600;
	}

	.json-comma {
		color: #9ca3af;
	}

	.json-count {
		color: #9ca3af;
		font-size: 10px;
		margin-left: 4px;
	}

	/* 닫힌 상태에서 count 표시 */
	details:not([open]) > .json-summary > .json-count {
		display: inline;
	}

	/* 열린 상태에서 count 숨김 */
	details[open] > .json-summary > .json-count {
		display: none;
	}
</style>
