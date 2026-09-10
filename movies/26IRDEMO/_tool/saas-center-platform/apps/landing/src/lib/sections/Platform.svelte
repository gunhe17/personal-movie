<script lang="ts">
	import Report44 from '$lib/assets/Report44.svelte';
	import Stack44 from '$lib/assets/Stack44.svelte';
	import Step44 from '$lib/assets/Step44.svelte';
	import { onMount } from 'svelte';

	let sectionEl: HTMLElement;
	let visible = $state(false);

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) visible = true;
				});
			},
			{ threshold: 0.15 }
		);
		observer.observe(sectionEl);
		return () => observer.disconnect();
	});

	const cards = [
		{
			title: '상담사가 더 상담사답게\n일할 수 있게',
			desc: '기록은 AI가 대신해요. 녹음과 간단한 메모만으로 일지 초안까지 자동으로 정리해요. 상담사는 상담에 더 집중해요.',
			iconBg: 'bg-[#256EF41A]',
			iconColor: '#256EF4',
			icon: 'pencil'
		},
		{
			title: '모든 단계를\n하나로',
			desc: '내담자는 앱에서 일정을 확인하고 변경 요청과 결과 확인까지 할 수 있어요. 상담사와 내담자가 하나의 플랫폼으로 연결돼요.',
			iconBg: 'bg-[#FB71851A]',
			iconColor: '#FB7185',
			icon: 'grid'
		},
		{
			title: '데이터로 확인하는\n치료 과정',
			desc: '회기별 변화를 기록하고 누적해서내담자의 치료 흐름을 한눈에 볼 수 있어요. 상담의 방향을 잡는 데 실질적인 근거가 돼요.',
			iconBg: 'bg-[#7C3AED1A]',
			iconColor: '#7C3AED',
			icon: 'gem'
		}
	];
</script>

<section
	bind:this={sectionEl}
	class="bg-[#0F1221] py-24 transition-all duration-700 ease-out"
	class:opacity-0={!visible}
	class:translate-y-8={!visible}
	class:opacity-100={visible}
	class:translate-y-0={visible}
>
	<div class="mx-auto max-w-[1200px]">
		<!-- 타이틀 -->
		<div class="text-center">
			<h2 class="text-[54px] leading-[1.4] font-bold text-white">
				상담센터 운영의 시작점이 달라요
			</h2>
			<p class="mt-4 text-[28px] font-medium text-white">
				구성원의 하루 전체가 가벼워지도록 설계했어요
			</p>
		</div>

		<!-- 3 카드 -->
		<div class="flex-shirnk mt-14 flex justify-center gap-6">
			{#each cards as card (card.title)}
				<div class="h-[420px] !w-[460px] rounded-2xl bg-[#ffffff] p-9">
					<!-- 아이콘 -->
					<div class="" style:color={card.iconColor}>
						{#if card.icon === 'pencil'}
							<Report44 />
						{:else if card.icon === 'grid'}
							<Step44 />
						{:else if card.icon === 'gem'}
							<Stack44 />
						{/if}
					</div>

					<!-- 제목 -->
					<h3 class="mt-6 text-[32px] leading-[1.4] font-bold whitespace-pre-line text-[#1D2227]">
						{card.title}
					</h3>

					<!-- 설명 -->
					<p class="mt-6 text-[20px] leading-[1.7] font-medium text-gray-400">
						{card.desc}
					</p>
				</div>
			{/each}
		</div>

		<!-- 와이드 카드: 올인원 플랫폼 -->
		<div
			class="mt-6 flex flex-col justify-between gap-8 overflow-hidden rounded-2xl bg-gradient-to-br from-[#E9E6FF] to-[#D9D2FA] p-10 md:flex-row md:items-center"
		>
			<!-- 좌측 텍스트 -->
			<div class="max-w-[480px]">
				<h3
					class="bg-gradient-to-r from-[#A84DF2] to-[#1C87FF] bg-clip-text text-[32px] leading-[1.4] font-bold tracking-[-0.41px] text-transparent"
				>
					상담사, 센터 관리자, 내담자를<br />
					하나로 연결하는 올인원 플랫폼
				</h3>
				<p class="mt-5 text-[14px] leading-[1.7] text-gray-600">
					운영, 검사, 기록, 소통, 결과 관리까지<br />
					상담에 필요한 모든 기능을 하나로 담았어요.
				</p>
			</div>

			<!-- 우측 그래픽: 중앙 로고 + 주변 3개 원 -->
			<div class="relative h-[200px] w-[280px] shrink-0">
				<!-- 연결선 -->
				<svg
					class="absolute inset-0 h-full w-full text-white/60"
					viewBox="0 0 280 200"
					fill="none"
					stroke="currentColor"
					stroke-width="1"
					stroke-dasharray="4 4"
				>
					<line x1="140" y1="100" x2="210" y2="40" />
					<line x1="140" y1="100" x2="70" y2="100" />
					<line x1="140" y1="100" x2="210" y2="160" />
				</svg>

				<!-- 중앙 원 -->
				<div
					class="absolute top-1/2 left-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#1A1D2E] shadow-md"
				>
					마인드스코프
				</div>

				<!-- 위쪽 원 (보라) -->
				<div
					class="absolute flex h-11 w-11 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-md"
					style="top: 20px; left: 190px;"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<rect width="18" height="18" x="3" y="3" rx="2" />
						<path d="M8 12h8" />
						<path d="M12 8v8" />
					</svg>
				</div>

				<!-- 왼쪽 원 (블루) -->
				<div
					class="absolute flex h-11 w-11 items-center justify-center rounded-full bg-[#256EF4] text-white shadow-md"
					style="top: 80px; left: 30px;"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 7h-9" />
						<path d="M14 17H5" />
						<circle cx="17" cy="17" r="3" />
						<circle cx="7" cy="7" r="3" />
					</svg>
				</div>

				<!-- 아래쪽 원 (레드) -->
				<div
					class="absolute flex h-11 w-11 items-center justify-center rounded-full bg-[#FB7185] text-white shadow-md"
					style="top: 140px; left: 190px;"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
					</svg>
				</div>
			</div>
		</div>
	</div>
</section>
