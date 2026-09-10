<script lang="ts">
	import { onMount } from 'svelte'

	// tail: 중앙 텍스트를 향하는 방향 (bottom-right = 꼬리가 오른쪽 아래로)
	const bubbles = [
		{ role: '센터 관리자', text: '일정 변경 요청을\n놓치는 경우가 생겨요', top: '28%', left: '18%', delay: 0, tail: 'bottom-right' },
		{ role: '상담사', text: '상담일지 쓰는데 너무 오래걸려요', top: '18%', left: '32%', delay: 200, tail: 'bottom-right' },
		{ role: '상담사', text: '메모하다 보면 내담자에게\n집중하기가 어려워요', top: '26%', right: '15%', delay: 400, tail: 'bottom-left' },
		{ role: '임상 심리사', text: '검사 진행 과정이\n복잡해요', top: '60%', left: '18%', delay: 600, tail: 'top-right' },
		{ role: '임상 심리사', text: '일정 변경 요청을\n놓치는 경우가 생겨요', top: '64%', left: '38%', delay: 800, tail: 'top-right' },
		{ role: '센터 관리자', text: '결제 내역 정리가\n너무 번거로워요', top: '58%', right: '16%', delay: 500, tail: 'top-left' },
		{ role: '상담사', text: '보호자 연락을\n자주 놓쳐요', top: '72%', right: '25%', delay: 1000, tail: 'top-left' },
	]

	const ghostBubbles = [
		{ text: '센터가 운영하기 쉬워졌으면', top: '8%', left: '5%' },
		{ text: '서류 작업으로 너무 번거로워요', top: '6%', right: '6%' },
		{ text: '상담목표 관리가 어려워요', top: '50%', right: '5%' },
		{ text: '결과 보고서 학부모에 다시 전달하기가 불편해요', bottom: '12%', left: '5%' },
		{ text: '저는 스케줄을 매번 확인해야해요', bottom: '16%', right: '6%' },
	]

	let visible = $state(false)
	let sectionEl: HTMLElement

	onMount(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) visible = true
			},
			{ threshold: 0.3 }
		)
		observer.observe(sectionEl)
		return () => observer.disconnect()
	})
</script>

<section
	bind:this={sectionEl}
	class="relative flex h-screen w-full items-center justify-center overflow-hidden"
	style="background: linear-gradient(135deg, #5B9BF6 0%, #4C87F6 40%, #3A6FD8 100%)"
>
	<!-- 배경 고스트 말풍선 -->
	{#each ghostBubbles as ghost}
		<div
			class="absolute rounded-2xl bg-white/10 px-5 py-3 text-sm text-white/30 blur-[1px]"
			style:top={ghost.top ?? ''}
			style:left={ghost.left ?? ''}
			style:right={ghost.right ?? ''}
			style:bottom={ghost.bottom ?? ''}
		>
			{ghost.text}
		</div>
	{/each}

	<!-- 중앙 타이틀 -->
	<h2 class="relative z-10 text-center text-[44px] font-bold leading-[1.3] text-white">
		이런 불편함,<br />겪어본 적 있나요?
	</h2>

	<!-- 말풍선들 -->
	{#each bubbles as bubble}
		<div
			class="absolute z-20 transition-all duration-700 ease-out"
			class:opacity-0={!visible}
			class:translate-y-4={!visible}
			class:scale-95={!visible}
			class:opacity-100={visible}
			class:translate-y-0={visible}
			class:scale-100={visible}
			style:top={bubble.top ?? ''}
			style:left={bubble.left ?? ''}
			style:right={bubble.right ?? ''}
			style:transition-delay="{bubble.delay}ms"
		>
			<div class="relative">
				<!-- 말풍선 꼬리: 중앙 텍스트 방향으로 -->
				{#if bubble.tail === 'bottom-right'}
					<div class="absolute -bottom-2 right-4 h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-white"></div>
				{:else if bubble.tail === 'bottom-left'}
					<div class="absolute -bottom-2 left-4 h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-white"></div>
				{:else if bubble.tail === 'top-right'}
					<div class="absolute -top-2 right-4 h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-white"></div>
				{:else if bubble.tail === 'top-left'}
					<div class="absolute -top-2 left-4 h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-white"></div>
				{/if}
				<div class="flex items-start gap-3 rounded-2xl bg-white px-5 py-4 shadow-lg">
					<!-- 아바타 -->
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
						<svg class="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
						</svg>
					</div>
					<div>
						<p class="mb-1 text-xs text-gray-400">{bubble.role}</p>
						<p class="text-[15px] font-semibold leading-snug text-gray-900 whitespace-pre-line">{bubble.text}</p>
					</div>
				</div>
			</div>
		</div>
	{/each}
</section>
