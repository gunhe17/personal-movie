<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Feature1 from '$lib/assets/Feature_slide_1.png';
	import Feature2 from '$lib/assets/Feature_slide_2.png';
	import Feature3 from '$lib/assets/Feature_slide_3.png';
	import Barolink from '$lib/assets/Barolink.png';

	const slides = [
		{ src: Feature1, alt: 'Feature 1' },
		{ src: Feature2, alt: 'Feature 2' },
		{ src: Feature3, alt: 'Feature 3' }
	];
	const AUTO_INTERVAL = 4000;

	let sectionEl: HTMLElement;
	let visibleSections = $state<Set<number>>(new Set());
	let currentIdx = $state(0);
	let autoTimer: ReturnType<typeof setInterval> | null = null;

	function startAuto() {
		stopAuto();
		if (slides.length <= 1) return;
		autoTimer = setInterval(() => {
			currentIdx = (currentIdx + 1) % slides.length;
		}, AUTO_INTERVAL);
	}

	function stopAuto() {
		if (autoTimer) {
			clearInterval(autoTimer);
			autoTimer = null;
		}
	}

	function goTo(idx: number) {
		currentIdx = idx;
		startAuto();
	}

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const idx = Number(entry.target.getAttribute('data-idx'));
					if (entry.isIntersecting) {
						visibleSections = new Set([...visibleSections, idx]);
					}
				});
			},
			{ threshold: 0.2 }
		);

		sectionEl.querySelectorAll('[data-idx]').forEach((el) => observer.observe(el));
		startAuto();
		return () => observer.disconnect();
	});

	onDestroy(() => {
		if (browser) stopAuto();
	});
</script>

<section id="features" bind:this={sectionEl} class="bg-white">
	<!-- Feature 1: 하나의 툴 -->
	<div
		data-idx="0"
		class="mx-auto max-w-[1200px] px-6 py-24 transition-all duration-700 ease-out"
		class:opacity-0={!visibleSections.has(0)}
		class:translate-y-8={!visibleSections.has(0)}
		class:opacity-100={visibleSections.has(0)}
		class:translate-y-0={visibleSections.has(0)}
	>
		<!-- 타이틀 -->
		<div class="text-center">
			<h2 class="text-[32px] leading-[1.4] font-bold text-gray-900">
				상담사·임상심리사·센터관리자<br />
				모두를 위한 하나의 서비스
			</h2>
			<p class="mt-4 text-[15px] text-gray-500">
				일정부터 검사·상담 관리까지, 흩어진 업무를 한 곳에서 관리요.
			</p>
		</div>

		<!-- 슬라이더 -->
		<div class="mt-14">
			<div class="relative overflow-hidden rounded-2xl">
				<div
					class="flex transition-transform duration-700 ease-in-out"
					style="transform: translateX(-{currentIdx * 100}%)"
				>
					{#each slides as slide (slide.src)}
						<img
							src={slide.src}
							alt={slide.alt}
							class="w-full flex-shrink-0 object-cover"
							draggable="false"
						/>
					{/each}
				</div>
			</div>

			<!-- 인디케이터 -->
			<div class="mt-6 flex items-center justify-center gap-2">
				{#each slides as _, i}
					<button
						type="button"
						onclick={() => goTo(i)}
						aria-label={`슬라이드 ${i + 1}로 이동`}
						aria-current={currentIdx === i}
						class="h-2 rounded-full bg-gray-300 transition-all duration-500 ease-out hover:bg-gray-400 {currentIdx ===
						i
							? 'w-6'
							: 'w-2'}"
					></button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Feature 2: 바로링크 -->
	<div
		data-idx="1"
		class="mx-auto max-w-[1200px] px-6 py-24 transition-all duration-700 ease-out"
		class:opacity-0={!visibleSections.has(1)}
		class:translate-y-8={!visibleSections.has(1)}
		class:opacity-100={visibleSections.has(1)}
		class:translate-y-0={visibleSections.has(1)}
	>
		<div class="grid grid-cols-1 items-center gap-[105px] md:grid-cols-2">
			<!-- 좌측: 텍스트 -->
			<div class="max-w-[420px] justify-self-end">
				<span
					class="inline-block rounded-full bg-[#256EF41A] px-4 py-2 text-[20px] font-medium text-[#256EF4]"
				>
					바로링크
				</span>
				<h2 class="mt-6 text-[32px] leading-[1.4] font-bold text-gray-900">
					<span class="text-[#256EF4]">링크 하나</span>로 온라인 검사<br />
					실시부터 결과까지
				</h2>
				<p class="mt-5 text-[15px] leading-[1.7] text-gray-500">
					온라인 검사 링크를 내담자에게 바로 전달하고, 검사가 끝<br />나면 결과도 즉시 공유할 수
					있어요. 복잡한 과정 없이, <br />상담사와 내담자 모두 편리해요.
				</p>
			</div>

			<!-- 우측: 이미지 -->
			<div class="flex justify-center md:justify-start">
				<img src={Barolink} alt="바로링크 알림톡 예시" class="w-full max-w-md" draggable="false" />
			</div>
		</div>
	</div>

	<!-- Feature 3: 필드노트 -->
	<div
		data-idx="2"
		class="mx-auto max-w-[1200px] px-6 py-24 transition-all duration-700 ease-out"
		class:opacity-0={!visibleSections.has(2)}
		class:translate-y-8={!visibleSections.has(2)}
		class:opacity-100={visibleSections.has(2)}
		class:translate-y-0={visibleSections.has(2)}
	>
		<div class="grid grid-cols-1 items-center gap-[105px] md:grid-cols-2">
			<!-- 좌측: 이미지 -->
			<div class="flex justify-center md:justify-end">
				<div
					class="aspect-[4/5] w-full max-w-md rounded-3xl bg-gradient-to-br from-[#FFE4E6] to-[#FECDD3]"
				></div>
			</div>

			<!-- 우측: 텍스트 -->
			<div class="max-w-[420px] justify-self-start">
				<span
					class="inline-block rounded-full bg-[#FB71851A] px-4 py-2 text-[20px] font-medium text-[#FB7185]"
				>
					필드노트
				</span>
				<h2 class="mt-6 text-[32px] leading-[1.4] font-bold text-gray-900">
					상담중엔 <span class="text-[#FB7185]">듣는데만</span><br />
					집중해도 괜찮아요
				</h2>
				<p class="mt-5 text-[15px] leading-[1.7] text-gray-500">
					녹음과 동시에 메모하고, AI가 핵심 인사이트를 뽑아줘요.<br />
					상담이 끝나면 일지 초안이 거의 완성돼 있어요.
				</p>
			</div>
		</div>
	</div>
</section>
