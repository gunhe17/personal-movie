<script lang="ts">
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

	const stats = [
		{
			label: '협력 전문가',
			value: '47+',
			desc: '기획부터 설계까지\n현장 전문가가 직접 참여'
		},
		{
			label: '반영된 현장 피드백',
			value: '120+',
			desc: '리빙랩을 통해 수집한\n실제 개선 사항'
		},
		{
			label: '협력 전문가',
			value: '47+',
			desc: '기획부터 설계까지\n현장 전문가가 직접 참여'
		}
	];

	const experts = [
		{ center: '마음의온도심리상담센터 센터장', name: '이다운' },
		{ center: '마음의온도심리상담센터 센터장', name: '이다운' },
		{ center: '마음의온도심리상담센터 센터장', name: '이다운' },
		{ center: '마음의온도심리상담센터 센터장', name: '이다운' }
	];

	const flow = [
		{
			title: '서울어린이미래활짝센터',
			desc: '초기 도입 센터',
			iconColor: '#256EF4',
			iconBg: 'bg-[#256EF41A]',
			icon: 'building'
		},
		{
			title: '현장 피드백 수집',
			desc: '불편함·개선 요청을 실시간으로 전달',
			iconColor: '#F59E0B',
			iconBg: 'bg-[#F59E0B1A]',
			icon: 'chat'
		},
		{
			title: '피드백 반영',
			desc: '다음 업데이트에 즉시 적용',
			iconColor: '#10B981',
			iconBg: 'bg-[#10B9811A]',
			icon: 'arrow-up'
		}
	];
</script>

<section
	bind:this={sectionEl}
	class="bg-white px-6 py-24 transition-all duration-700 ease-out"
	class:opacity-0={!visible}
	class:translate-y-8={!visible}
	class:opacity-100={visible}
	class:translate-y-0={visible}
>
	<div class="mx-auto max-w-[1200px]">
		<!-- 타이틀 -->
		<div class="text-center">
			<h2 class="text-[32px] leading-[1.4] font-bold text-gray-900">
				상담 현장의 <span>&lsquo;진짜 필요&rsquo;</span>를 담았어요
			</h2>
			<p class="mt-4 text-[15px] leading-[1.7] text-gray-500">
				실제 상담 현장의 목소리를 담아<br />
				기획부터 설계까지 전문가와 함께 만들었어요
			</p>
		</div>

		<!-- 3 스탯 카드 -->
		<div class="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
			{#each stats as stat, i (i)}
				<div
					class="flex flex-col items-center rounded-2xl border border-gray-100 bg-white px-6 py-10 text-center"
				>
					<span class="text-[15px] font-medium text-gray-700">{stat.label}</span>
					<strong class="mt-3 text-[40px] leading-none font-bold text-[#256EF4]">{stat.value}</strong>
					<p class="mt-4 text-[13px] leading-[1.7] whitespace-pre-line text-gray-500">
						{stat.desc}
					</p>
				</div>
			{/each}
		</div>

		<!-- 2개 세로 카드 -->
		<div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
			<!-- 좌측: 전문가와 함께 설계한 기능 -->
			<div class="rounded-2xl bg-[#F7F8F8] p-8">
				<span class="text-[13px] font-medium text-[#256EF4]">함께 만든 사람들</span>
				<h3 class="mt-2 text-[24px] leading-[1.4] font-bold text-[#1A1D2E]">
					전문가와 함께 설계한 기능
				</h3>
				<p class="mt-3 text-[14px] leading-[1.7] text-gray-500">
					기획부터 기능 설계까지,<br />
					리빙랩을 진행하며 현장 전문가들의 의견을 수집하고 반영했어요
				</p>

				<div class="relative mt-10 space-y-3">
					{#each experts as expert, i (i)}
						<div
							class="rounded-xl border border-gray-100 bg-white px-5 py-4"
							class:opacity-40={i === experts.length - 1}
						>
							<span class="text-[12px] text-gray-500">{expert.center}</span>
							<p class="mt-1 text-[15px] font-bold text-[#1A1D2E]">{expert.name}</p>
						</div>
					{/each}
					<!-- 하단 페이드 그라데이션 -->
					<div
						class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#F7F8F8] to-transparent"
					></div>
				</div>
			</div>

			<!-- 우측: 실제 센터와 함께 개선 중 -->
			<div class="rounded-2xl bg-[#F7F8F8] p-8">
				<span class="text-[13px] font-medium text-[#256EF4]">지금 운영 중인 곳</span>
				<h3 class="mt-2 text-[24px] leading-[1.4] font-bold text-[#1A1D2E]">
					실제 센터와 함께 개선 중
				</h3>
				<p class="mt-3 text-[14px] leading-[1.7] text-gray-500">
					도입 센터와 함께 사용하며 운영 과정에서의 불편함을<br />
					지속적으로 반영하고 있어요.
				</p>

				<div class="mt-10 space-y-2">
					{#each flow as item, i (item.title)}
						<div class="flex items-center gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg {item.iconBg}"
								style:color={item.iconColor}
							>
								{#if item.icon === 'building'}
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
										<rect width="16" height="20" x="4" y="2" rx="2" />
										<path d="M9 22v-4h6v4" />
										<path d="M8 6h.01" />
										<path d="M16 6h.01" />
										<path d="M12 6h.01" />
										<path d="M12 10h.01" />
										<path d="M12 14h.01" />
										<path d="M16 10h.01" />
										<path d="M16 14h.01" />
										<path d="M8 10h.01" />
										<path d="M8 14h.01" />
									</svg>
								{:else if item.icon === 'chat'}
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
										<path
											d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
										/>
									</svg>
								{:else if item.icon === 'arrow-up'}
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
										<circle cx="12" cy="12" r="10" />
										<path d="m16 12-4-4-4 4" />
										<path d="M12 16V8" />
									</svg>
								{/if}
							</div>
							<div>
								<p class="text-[15px] font-bold text-[#1A1D2E]">{item.title}</p>
								<span class="text-[13px] text-gray-500">{item.desc}</span>
							</div>
						</div>

						{#if i < flow.length - 1}
							<div class="flex justify-center py-1">
								<svg width="12" height="16" viewBox="0 0 12 16" fill="none">
									<path
										d="M6 0v14m0 0l-4-4m4 4l4-4"
										stroke="#9CA3AF"
										stroke-width="1"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-dasharray="2 2"
									/>
								</svg>
							</div>
						{/if}
					{/each}
				</div>

				<!-- 하단 상태 pill -->
				<div class="mt-6 inline-flex items-center gap-2 rounded-full bg-[#10B98114] px-3 py-1.5">
					<span class="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span>
					<span class="text-[12px] font-medium text-[#10B981]">지금도 피드백이 반영되고 있어요</span>
				</div>
			</div>
		</div>
	</div>
</section>
