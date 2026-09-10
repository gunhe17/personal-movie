<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import DoubleArrow from '$lib/assets/DoubleArrowIcon.svelte';

	export let totalItems: number = 0;
	export let itemsPerPage: number = 10;
	export let currentPage: number = 1;
	export let maxVisiblePages: number = 5;

	$: totalPages = Math.ceil(totalItems / itemsPerPage);
	$: isFirstPage = currentPage === 1;
	$: isLastPage = currentPage === totalPages || totalPages === 0;
	$: pageRange = calculatePageRange(currentPage, totalPages, maxVisiblePages);

	const calculatePageRange = (current: number, total: number, maxVisible: number) => {
		const currentGroup = Math.ceil(current / maxVisible);
		const start = (currentGroup - 1) * maxVisible + 1;
		const end = Math.min(currentGroup * maxVisible, total);

		return Array.from({ length: end - start + 1 }, (_, i) => start + i);
	};

	const handlePageChange = (page: number) => {
		if (page >= 1 && page <= totalPages && page !== currentPage) {
			currentPage = page;
		}
	};

	const goToFirstPage = () => {
		handlePageChange(1);
	};

	const goToLastPage = () => {
		handlePageChange(totalPages);
	};

	const goToPreviousPage = () => {
		handlePageChange(currentPage - 1);
	};

	const goToNextPage = () => {
		handlePageChange(currentPage + 1);
	};
</script>

{#if totalPages > 0}
	<div class={twMerge('flex-center shrink-0', $$props['class'])}>
		<div class="flex items-center space-x-2">
			<button
				class="flex-center h-8 w-8 rounded-lg ring-1 ring-gray-200 ring-inset"
				on:click={goToFirstPage}
				disabled={isFirstPage}
			>
				<DoubleArrow />
			</button>
			<button
				class="flex-center h-8 w-8 rounded-lg ring-1 ring-gray-200 ring-inset"
				on:click={goToPreviousPage}
				disabled={isFirstPage}
			>
				<DoubleArrow isDouble={false} className="-translate-x-1/5" />
			</button>

			<!-- Page numbers in current group -->
			{#each pageRange as page}
				<button
					class="flex-center h-8 w-8 rounded-lg text-[13px] ring-1 ring-gray-200 transition duration-200 ring-inset {currentPage ===
					page
						? 'bg-primary-500 text-white ring-primary-400 hover:bg-primary-400'
						: 'text-gray-800  hover:bg-gray-50'}"
					on:click={() => handlePageChange(page)}
				>
					{page}
				</button>
			{/each}
			<button
				class="flex-center h-8 w-8 rounded-lg ring-1 ring-gray-200 ring-inset"
				on:click={goToNextPage}
				disabled={isLastPage}
			>
				<DoubleArrow isDouble={false} className="rotate-180 translate-x-1/5" />
			</button>
			<button
				class="flex-center h-8 w-8 rounded-lg ring-1 ring-gray-200 ring-inset"
				on:click={goToLastPage}
				disabled={isLastPage}
			>
				<DoubleArrow className="rotate-180" />
			</button>
		</div>
	</div>
{/if}
