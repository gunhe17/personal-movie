<script lang="ts">
	export let strokeColor: string = '#111827';
	export let width: number = 10;
	export let height: number = 16;
</script>

<svg
	{width}
	{height}
	viewBox="0 0 10 16"
	fill="none"
	class={$$props['class']}
	xmlns="http://www.w3.org/2000/svg"
>
	<path
		d="M9 1.33301L1 7.99967L9 14.6663"
		stroke={strokeColor}
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
