<script lang="ts">
	/**
	 * SyncTranscript — 오디오 재생 시간에 맞춰 세그먼트 하이라이팅
	 * - 현재 세그먼트 배경 강조 + 세그먼트 내 진행률 바
	 * - 자동 스크롤 (현재 세그먼트가 화면 안에 보이도록)
	 * - 세그먼트 클릭 → 해당 시간으로 시크
	 */
	import {
		type SyncSegment,
		findActiveSegment,
		getSegmentProgress,
	} from '../shared/audio-sync'

	interface Props {
		segments: SyncSegment[]
		currentTime: number
		isPlaying?: boolean
		onSeek?: (globalSeconds: number) => void
	}

	let { segments, currentTime, isPlaying = false, onSeek }: Props = $props()

	// RAF throttle로 activeIdx 계산
	let activeIdx = $state(-1)
	let rafId = 0
	let scrollContainer: HTMLDivElement | null = $state(null)

	$effect(() => {
		// currentTime이 변경될 때마다 RAF로 계산
		const time = currentTime
		cancelAnimationFrame(rafId)
		rafId = requestAnimationFrame(() => {
			activeIdx = findActiveSegment(segments, time)
		})
		return () => cancelAnimationFrame(rafId)
	})

	// 자동 스크롤: activeIdx 변경 시
	let lastScrolledIdx = -1
	$effect(() => {
		if (activeIdx >= 0 && activeIdx !== lastScrolledIdx && isPlaying) {
			lastScrolledIdx = activeIdx
			const el = document.getElementById(`sync-seg-${activeIdx}`)
			if (el && scrollContainer) {
				const containerRect = scrollContainer.getBoundingClientRect()
				const elRect = el.getBoundingClientRect()
				// 화면 안에 있으면 스크롤 안 함
				if (elRect.top < containerRect.top || elRect.bottom > containerRect.bottom) {
					el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
				}
			}
		}
	})

	function formatTimestamp(sec: number): string {
		const m = Math.floor(sec / 60)
		const s = Math.floor(sec % 60)
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
	}

	// 화자별 색상 매핑
	const SPEAKER_COLORS: Record<string, { bg: string; text: string; active: string; progress: string }> = {
		A: { bg: 'bg-blue-50/60', text: 'text-blue-700', active: 'bg-blue-100', progress: 'bg-blue-400' },
		B: { bg: 'bg-amber-50/60', text: 'text-amber-700', active: 'bg-amber-100', progress: 'bg-amber-400' },
		C: { bg: 'bg-emerald-50/60', text: 'text-emerald-700', active: 'bg-emerald-100', progress: 'bg-emerald-400' },
		D: { bg: 'bg-purple-50/60', text: 'text-purple-700', active: 'bg-purple-100', progress: 'bg-purple-400' },
	}

	function getSpeakerColor(speaker: string) {
		return SPEAKER_COLORS[speaker] ?? { bg: 'bg-gray-50/60', text: 'text-gray-600', active: 'bg-gray-100', progress: 'bg-gray-400' }
	}

	function handleSegmentClick(idx: number) {
		onSeek?.(segments[idx].start)
	}
</script>

<div class="sync-transcript flex-1 overflow-y-auto" bind:this={scrollContainer}>
	<div class="space-y-1 px-3 py-2">
		{#each segments as seg, idx}
			{@const isActive = idx === activeIdx}
			{@const isPast = activeIdx >= 0 && idx < activeIdx}
			{@const color = getSpeakerColor(seg.speaker)}
			{@const progress = isActive ? getSegmentProgress(seg, currentTime) : 0}
			<button
				id="sync-seg-{idx}"
				class="group relative w-full rounded-lg px-3 py-2.5 text-left transition-all duration-150
					{isActive
						? `${color.active} ring-1 ring-inset ring-current/10 shadow-sm`
						: isPast
							? 'bg-gray-50/50 opacity-60'
							: `${color.bg} hover:brightness-95`}"
				onclick={() => handleSegmentClick(idx)}
			>
				<!-- 헤더: 타임스탬프 + 화자 -->
				<div class="mb-1 flex items-center gap-2">
					<span class="rounded bg-black/5 px-1.5 py-0.5 font-mono text-label-01-normal-regular tabular-nums text-gray-400">
						{formatTimestamp(seg.start)}
					</span>
					<span class="text-label-01-normal-bold {color.text}">
						화자 {seg.speaker}
					</span>
					{#if isActive}
						<span class="ml-auto flex items-center gap-1">
							<span class="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500"></span>
							<span class="text-label-01-normal-medium text-violet-500">재생 중</span>
						</span>
					{/if}
				</div>

				<!-- 텍스트 -->
				<p class="leading-relaxed {isActive ? 'text-gray-800 text-label-01-normal-medium' : 'text-gray-600 text-label-01-normal-regular'}">
					{seg.text}
				</p>

				<!-- 세그먼트 내 진행률 바 (active일 때만) -->
				{#if isActive}
					<div class="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/5">
						<div
							class="h-full rounded-full {color.progress} transition-[width] duration-200 ease-linear"
							style="width: {progress * 100}%"
						></div>
					</div>
				{/if}
			</button>
		{/each}
	</div>
</div>
