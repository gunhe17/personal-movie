<script lang="ts">
	/**
	 * STTTestPanel — Production 페이지 내 STT 인라인 테스트
	 * 오디오 샘플 선택 + STT 실행 + 결과 표시
	 */
	import { queryBuilder } from '$hooks/queries/builder'
	import { useQueryClient } from '@tanstack/svelte-query'
	import {
		runSTTExperiment,
		getSampleList,
		getSampleDetail,
		uploadAudioSample,
		type SampleListResponse,
		type SampleDatasetResponse,
	} from '$hooks/actions/aiLab.action'
	import { formatLatency, formatCostUSD, formatCostKRW, formatDuration } from '../../constants'
	import { parseSyncSegments, type SyncSegment } from '../../shared/audio-sync'
	import AudioPlayer from '../../components/AudioPlayer.svelte'
	import SyncTranscript from '../../components/SyncTranscript.svelte'
	import { snackbarStore } from '$stores/snackbar'

	interface Props {
		modelName: string
	}

	let { modelName }: Props = $props()

	const queryClient = useQueryClient()

	// ── 상태 ──
	let selectedSampleId = $state('')
	let isRunning = $state(false)
	let isUploading = $state(false)
	let fileInputRef: HTMLInputElement | null = $state(null)
	let audioPlayerRef: AudioPlayer | null = $state(null)
	let currentAudioTime = $state(0)
	let isAudioPlaying = $state(false)

	let testResult = $state<{
		outputText: string
		latency: string
		cost: string
		costKRW: string
		audioDuration: string
		syncSegments: SyncSegment[] | null
	} | null>(null)

	// ── 오디오 샘플 쿼리 ──
	const samplesQuery = $derived(
		queryBuilder<SampleListResponse, SampleListResponse>(
			getSampleList,
			() => ({ input_type: 'audio', page: 1, size: 100 }),
			() => ({ throwOnError: false })
		)
	)

	const sampleItems = $derived(
		(samplesQuery.data as SampleListResponse)?.items ?? []
	)

	// ── 선택된 샘플 상세 ──
	const sampleDetailQuery = $derived(
		queryBuilder<SampleDatasetResponse, SampleDatasetResponse>(
			getSampleDetail,
			() => selectedSampleId ? { sampleId: selectedSampleId } : null,
			() => ({ enabled: !!selectedSampleId, throwOnError: false })
		)
	)

	const sampleDetail = $derived(sampleDetailQuery.data as SampleDatasetResponse | undefined)

	// ── 파일 업로드 ──
	function triggerFileInput() {
		fileInputRef?.click()
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file || isUploading) return

		const name = file.name.replace(/\.[^.]+$/, '')
		isUploading = true
		try {
			const result = await uploadAudioSample().request({ file, name, source_type: 'manual' })
			snackbarStore.success(`"${result.name}" 업로드 완료`)
			queryClient.invalidateQueries({ queryKey: ['getSampleList'], exact: false })
			selectedSampleId = result.id
		} catch (e) {
			snackbarStore.error(`업로드 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
		} finally {
			isUploading = false
			if (fileInputRef) fileInputRef.value = ''
		}
	}

	// ── STT 실행 ──
	async function handleRun() {
		if (!selectedSampleId || !modelName || isRunning) return
		isRunning = true
		testResult = null
		try {
			const raw = await runSTTExperiment().request({
				sample_id: selectedSampleId,
				model_name: modelName,
			})
			testResult = {
				outputText: raw.output_text ?? '',
				latency: formatLatency(raw.latency_ms),
				cost: formatCostUSD(raw.estimated_cost_usd),
				costKRW: formatCostKRW(raw.estimated_cost_usd),
				audioDuration: formatDuration(raw.input_audio_duration),
				syncSegments: parseSyncSegments(raw.output_json) ?? parseSyncSegments(raw.output_text),
			}
			snackbarStore.success(`STT 테스트 완료 (${testResult.latency})`)
		} catch (e) {
			snackbarStore.error(`테스트 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
		} finally {
			isRunning = false
		}
	}

	// ── 오디오 시간 추적 ──
	let playingTimer: ReturnType<typeof setTimeout> | null = null

	function handleAudioTimeUpdate(time: number) {
		currentAudioTime = time
		isAudioPlaying = true
		if (playingTimer) clearTimeout(playingTimer)
		playingTimer = setTimeout(() => { isAudioPlaying = false }, 500)
	}

	function handleSeekTo(globalSeconds: number) {
		audioPlayerRef?.seekTo(globalSeconds)
	}
</script>

<div class="space-y-3">
	<!-- 입력 영역 -->
	<input
		bind:this={fileInputRef}
		type="file"
		accept="audio/*"
		class="hidden"
		onchange={handleFileSelect}
	/>

	<div class="flex items-end gap-2">
		<!-- 샘플 선택 -->
		<div class="flex-1">
			<label class="mb-1 block text-label-01-normal-medium text-gray-500">오디오 샘플</label>
			<div class="flex gap-2">
				<select
					class="h-9 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-label-01-normal-regular text-gray-700 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
					value={selectedSampleId}
					onchange={(e) => { selectedSampleId = e.currentTarget.value; testResult = null }}
				>
					<option value="">선택하세요</option>
					{#each sampleItems as s}
						<option value={s.id}>{s.name}{s.tags ? ` [${s.tags}]` : ''}</option>
					{/each}
				</select>
				<button
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
					title="오디오 파일 업로드"
					disabled={isUploading}
					onclick={triggerFileInput}
				>
					{#if isUploading}
						<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
						</svg>
					{:else}
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
						</svg>
					{/if}
				</button>
			</div>
		</div>

		<!-- 실행 버튼 -->
		<button
			class="h-9 rounded-lg bg-violet-600 px-4 text-label-01-normal-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
			disabled={!selectedSampleId || !modelName || isRunning}
			onclick={handleRun}
		>
			{#if isRunning}
				<span class="flex items-center gap-1.5">
					<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					실행 중...
				</span>
			{:else}
				테스트 실행
			{/if}
		</button>
	</div>

	<!-- 오디오 플레이어 -->
	{#if selectedSampleId && sampleDetail?.input_type === 'audio'}
		<AudioPlayer
			bind:this={audioPlayerRef}
			sampleId={selectedSampleId}
			estimatedDuration={sampleDetail.audio_duration ?? 0}
			onTimeUpdate={handleAudioTimeUpdate}
		/>
	{/if}

	<!-- 결과 -->
	{#if testResult}
		<div class="rounded-lg border border-gray-100 bg-gray-50/50">
			<!-- 메트릭 뱃지 -->
			<div class="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
				<span class="rounded-md bg-emerald-50 px-1.5 py-0.5 text-label-01-normal-medium text-emerald-600">
					완료
				</span>
				<span class="text-label-01-normal-regular text-gray-500">응답 {testResult.latency}</span>
				<span class="text-label-01-normal-medium text-gray-600">{testResult.costKRW} <span class="font-normal text-gray-400">({testResult.cost})</span></span>
				{#if testResult.audioDuration !== '-'}
					<span class="text-label-01-normal-regular text-gray-500">오디오 {testResult.audioDuration}</span>
				{/if}
			</div>

			<!-- 변환 텍스트 -->
			{#if testResult.syncSegments}
				<div class="max-h-48">
					<SyncTranscript
						segments={testResult.syncSegments}
						currentTime={currentAudioTime}
						isPlaying={isAudioPlaying}
						onSeek={handleSeekTo}
					/>
				</div>
			{:else if testResult.outputText}
				<div class="max-h-48 overflow-y-auto px-3 py-2">
					<pre class="whitespace-pre-wrap font-mono text-label-01-normal-regular leading-relaxed text-gray-600">{testResult.outputText}</pre>
				</div>
			{:else}
				<div class="px-3 py-4 text-center text-label-01-normal-regular text-gray-400">변환 결과가 없습니다.</div>
			{/if}
		</div>
	{/if}
</div>
