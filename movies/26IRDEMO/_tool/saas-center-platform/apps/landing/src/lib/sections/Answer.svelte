<script lang="ts">
	import { onMount } from 'svelte'
	import { browser } from '$app/environment'

	let wrapperEl: HTMLElement
	let progress = $state(0)
	let visible = $state(false)

	onMount(() => {
		function onScroll() {
			if (!wrapperEl) return
			const rect = wrapperEl.getBoundingClientRect()
			const wrapperHeight = wrapperEl.offsetHeight
			const viewportHeight = window.innerHeight

			// 스크롤 가능한 여분 높이 (wrapper - viewport)
			const scrollableDistance = wrapperHeight - viewportHeight

			if (scrollableDistance <= 0) return

			// wrapper 상단이 뷰포트 상단 위로 올라간 거리
			const scrolled = -rect.top

			if (scrolled >= 0) {
				visible = true
				progress = Math.min(Math.max(scrolled / scrollableDistance, 0), 1)
			}
		}

		window.addEventListener('scroll', onScroll, { passive: true })
		return () => window.removeEventListener('scroll', onScroll)
	})
</script>

<!-- 래퍼: 추가 스크롤 높이 (100vh + 50vh 밑줄 + 50vh 머무름) -->
<div bind:this={wrapperEl} class="relative h-[200vh]">
	<section
		class="sticky top-0 flex h-screen w-full items-center justify-center"
		style="background: linear-gradient(180deg, #0F1724 0%, #151E30 50%, #111827 100%)"
	>
		<div
			class="text-center transition-all duration-700 ease-out"
			class:opacity-0={!visible}
			class:translate-y-6={!visible}
			class:opacity-100={visible}
			class:translate-y-0={visible}
		>
			<h2 class="text-[40px] font-bold leading-[1.4] text-white">
				모든 불편함에는
			</h2>
			<p class="relative mt-1 inline-block text-[40px] font-bold text-[#4C87F6]">
				답이 있어요
				<!-- 스크롤 기반 밑줄 SVG 애니메이션 -->
				<svg
					class="absolute -bottom-2 left-1/2 -translate-x-1/2"
					width="280"
					height="16"
					viewBox="0 0 367 21"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M4.5002 15.5673C4.7365 15.5512 4.97279 15.5352 52.4079 13.1164C99.8431 10.6976 194.47 5.87648 252.687 4.75955C310.903 3.64261 329.843 6.37593 341.535 8.3225C353.227 10.2691 357.098 11.3461 361.913 14.0239"
						stroke="#284F96"
						stroke-width="9"
						stroke-linecap="round"
						stroke-dasharray="400"
						stroke-dashoffset={400 - 400 * progress}
					/>
				</svg>
			</p>
		</div>
	</section>
</div>
