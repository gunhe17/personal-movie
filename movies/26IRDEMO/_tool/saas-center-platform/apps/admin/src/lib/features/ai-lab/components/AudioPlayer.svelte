<script lang="ts">
	/**
	 * AudioPlayer — 샘플 오디오 재생 + 현재 시간 콜백
	 * presigned URL을 가져와서 재생
	 */
	import { getSampleAudioUrl } from '$hooks/actions/aiLab.action'

	interface Props {
		sampleId: string
		/** 예상 오디오 길이 (초) — presigned URL 응답 전 표시용 */
		estimatedDuration?: number
		onTimeUpdate?: (currentTime: number) => void
	}

	let { sampleId, estimatedDuration = 0, onTimeUpdate }: Props = $props()

	// 상태
	let isPlaying = $state(false)
	let isLoading = $state(false)
	let currentTime = $state(0)
	let duration = $state(0)
	let audioEl: HTMLAudioElement | null = $state(null)

	// URL 캐시
	let cachedUrl: { url: string; expiresAt: number; sampleId: string } | null = null

	// 표시용 총 길이 (실제 metadata 우선)
	const totalDuration = $derived(duration > 0 ? duration : estimatedDuration)

	// presigned URL 가져오기 (캐시)
	async function getUrl(): Promise<string> {
		if (cachedUrl && cachedUrl.sampleId === sampleId && cachedUrl.expiresAt > Date.now() + 60_000) {
			return cachedUrl.url
		}
		const res = await getSampleAudioUrl().request({
			sampleId,
			expires_in: 3600,
		})
		cachedUrl = {
			url: res.download_url,
			expiresAt: Date.now() + res.expires_in * 1000,
			sampleId,
		}
		return res.download_url
	}

	// 오디오 로드 및 재생
	async function loadAndPlay(startTime = 0) {
		isLoading = true
		try {
			const url = await getUrl()
			if (audioEl) {
				audioEl.src = url
				audioEl.currentTime = startTime
				await audioEl.play()
				isPlaying = true
			}
		} catch {
			isPlaying = false
		} finally {
			isLoading = false
		}
	}

	function handleLoadedMetadata() {
		if (!audioEl || !isFinite(audioEl.duration)) return
		duration = audioEl.duration
	}

	function handleTimeUpdate() {
		if (!audioEl) return
		currentTime = audioEl.currentTime
		onTimeUpdate?.(currentTime)
	}

	function handleEnded() {
		isPlaying = false
		currentTime = 0
	}

	function togglePlay() {
		if (!audioEl) return
		if (isPlaying) {
			audioEl.pause()
			isPlaying = false
		} else if (audioEl.src) {
			audioEl.play()
			isPlaying = true
		} else {
			loadAndPlay()
		}
	}

	function seek(e: Event) {
		const input = e.target as HTMLInputElement
		const seekTime = parseFloat(input.value)
		if (audioEl && audioEl.src) {
			audioEl.currentTime = seekTime
			currentTime = seekTime
		} else {
			loadAndPlay(seekTime)
		}
	}

	/** 외부에서 호출 가능한 시크 함수 */
	export function seekTo(globalSeconds: number) {
		if (audioEl && audioEl.src) {
			audioEl.currentTime = globalSeconds
			currentTime = globalSeconds
			if (!isPlaying) {
				audioEl.play()
				isPlaying = true
			}
		} else {
			loadAndPlay(globalSeconds)
		}
	}

	function formatTime(sec: number): string {
		const m = Math.floor(sec / 60)
		const s = Math.floor(sec % 60)
		return `${m}:${s.toString().padStart(2, '0')}`
	}
</script>

<div class="audio-player flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
	<!-- hidden audio element -->
	<audio
		bind:this={audioEl}
		onloadedmetadata={handleLoadedMetadata}
		ontimeupdate={handleTimeUpdate}
		onended={handleEnded}
		preload="none"
	></audio>

	<!-- 재생/일시정지 -->
	<button
		class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors
			{!sampleId
				? 'bg-gray-200 text-gray-400 cursor-not-allowed'
				: 'bg-violet-600 text-white hover:bg-violet-700 active:scale-95'}"
		disabled={!sampleId || isLoading}
		onclick={togglePlay}
	>
		{#if isLoading}
			<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
		{:else if isPlaying}
			<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
				<path d="M6 4h4v16H6zM14 4h4v16h-4z" />
			</svg>
		{:else}
			<svg class="h-4 w-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
				<path d="M8 5v14l11-7z" />
			</svg>
		{/if}
	</button>

	<!-- 시간 + 시크바 -->
	<div class="flex flex-1 items-center gap-2">
		<span class="w-10 text-right text-label-01-normal-regular tabular-nums text-gray-500">{formatTime(currentTime)}</span>
		<input
			type="range"
			class="seek-bar h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200"
			min="0"
			max={totalDuration || 1}
			step="0.1"
			value={currentTime}
			oninput={seek}
			disabled={!sampleId}
		/>
		<span class="w-10 text-label-01-normal-regular tabular-nums text-gray-400">{formatTime(totalDuration)}</span>
	</div>
</div>

<style>
	.seek-bar::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #7c3aed;
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
	}

	.seek-bar::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #7c3aed;
		cursor: pointer;
		border: 2px solid white;
		box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
	}

	.seek-bar::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 3px;
	}

	.seek-bar::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		background: #e5e7eb;
	}
</style>
