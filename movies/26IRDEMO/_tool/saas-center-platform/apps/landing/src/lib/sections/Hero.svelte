<script lang="ts">
	import { onMount } from 'svelte';
	import heroBackground from '$lib/assets/HeroBackground.jpg';
	import heroWebImage from '$lib/assets/HeroWebImage.png';

	const STEP_DELAY = 220;
	const TOTAL_STEPS = 5;

	let visible = $state(0);

	onMount(() => {
		const timers: ReturnType<typeof setTimeout>[] = [];
		for (let i = 0; i < TOTAL_STEPS; i++) {
			timers.push(
				setTimeout(
					() => {
						visible = i + 1;
					},
					150 + i * STEP_DELAY
				)
			);
		}
		return () => timers.forEach(clearTimeout);
	});

	const stepClass = (i: number) =>
		`transition-all duration-700 ease-out ${visible > i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`;
</script>

<section class="relative w-full overflow-hidden">
	<!-- 배경 이미지: 90도 회전 + opacity 40% -->
	<div class="pointer-events-none absolute inset-0 opacity-40">
		<img
			src={heroBackground}
			alt=""
			aria-hidden="true"
			class="absolute top-1/2 left-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 -rotate-90"
		/>
	</div>

	<!-- 콘텐츠 -->
	<div class="relative">
		<!-- 텍스트 + CTA -->
		<div class="flex flex-col items-center pt-16 text-center">
			<h1 class="text-[40px] leading-[1.3] font-bold tracking-tight">
				<span class="block text-gray-900 {stepClass(0)}">행정은 효율적으로</span>
				<span class="block text-[#4C87F6] {stepClass(1)}">상담은 전문적으로</span>
			</h1>
			<p class="mt-4 text-[15px] leading-relaxed text-gray-500 {stepClass(2)}">
				반복되는 운영 업무는 줄이고<br />
				아이와 보호자를 위한 상담에 더 집중해요
			</p>
			<a
				href="#contact"
				class="mt-8 rounded-xl bg-[#4C87F6] px-8 py-3.5 text-[15px] font-semibold text-white hover:bg-[#3A6FD8] {stepClass(3)}"
			>
				도입 문의
			</a>
		</div>

		<!-- 앱 스크린샷 -->
		<div class="mx-auto mt-12 w-[70%] {stepClass(4)}">
			<img src={heroWebImage} alt="마인드스코프 대시보드" class="block w-full" />
		</div>
	</div>

	<!-- 하단 페이드 -->
	<div
		class="pointer-events-none relative -mt-[140px] h-[140px]"
		style="background: linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.4) 25%, rgba(255,255,255,0.85) 45%, white 50%, white 100%)"
	></div>
</section>
