<script lang="ts">
	import { setContext } from 'svelte'
	import { queryBuilder } from '$hooks/queries/builder'
	import { getLabMetadata, type LabMetadataResponse } from '$hooks/actions/aiLab.action'

	let { children } = $props()

	const metadataQuery = $derived(
		queryBuilder<LabMetadataResponse, LabMetadataResponse>(
			getLabMetadata,
			undefined,
			() => ({ staleTime: 10 * 60 * 1000, throwOnError: false })
		)
	)

	const metadata = $derived(metadataQuery.data as LabMetadataResponse | undefined)
	setContext('labMetadata', () => metadata)
</script>

<div class="p-6">
	{@render children()}
</div>
