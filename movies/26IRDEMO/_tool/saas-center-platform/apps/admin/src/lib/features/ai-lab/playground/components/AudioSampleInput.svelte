<script lang="ts">
	/**
	 * AudioSampleInput — Playground STT 모드용 오디오 입력 컴포넌트
	 * 오디오 샘플 드롭다운 + 업로드 + 선택된 샘플 AudioPlayer 표시
	 */
	import { queryBuilder } from '$hooks/queries/builder'
	import { useQueryClient } from '@tanstack/svelte-query'
	import {
		getSampleList,
		getSampleDetail,
		uploadAudioSample,
		type SampleListResponse,
		type SampleDatasetResponse,
	} from '$hooks/actions/aiLab.action'
	import { formatDuration } from '../../constants'
	import AudioPlayer from '../../components/AudioPlayer.svelte'
	import { snackbarStore } from '$stores/snackbar'

	interface Props {
		selectedSampleId: string
		onSampleChange: (id: string) => void
		onUploadStart: () => void
		onUploadEnd: () => void
	}

	let { selectedSampleId, onSampleChange, onUploadStart, onUploadEnd }: Props = $props()

	const queryClient = useQueryClient()
	let fileInputRef: HTMLInputElement | null = $state(null)
	let isUploading = $state(false)

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
		onUploadStart()
		try {
			const result = await uploadAudioSample().request({ file, name, source_type: 'manual' })
			snackbarStore.success(`"${result.name}" 업로드 완료`)
			queryClient.invalidateQueries({ queryKey: ['getSampleList'], exact: false })
			onSampleChange(result.id)
		} catch (e) {
			snackbarStore.error(`업로드 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
		} finally {
			isUploading = false
			onUploadEnd()
			if (fileInputRef) fileInputRef.value = ''
		}
	}
</script>

<div class="flex h-full flex-col">
	<input
		bind:this={fileInputRef}
		type="file"
		accept="audio/*"
		class="hidden"
		onchange={handleFileSelect}
	/>

	<!-- 샘플 선택 -->
	<div class="mb-3">
		<label class="mb-1.5 block text-label-01-normal-medium text-gray-500">오디오 샘플</label>
		<div class="flex gap-2">
			<select
				class="h-10 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-label-01-normal-regular text-gray-700 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400"
				value={selectedSampleId}
				onchange={(e) => onSampleChange(e.currentTarget.value)}
			>
				<option value="">선택하세요</option>
				{#each sampleItems as s}
					<option value={s.id}>{s.name}{s.tags ? ` [${s.tags}]` : ''}</option>
				{/each}
			</select>
			<button
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
				title="오디오 파일 업로드"
				disabled={isUploading}
				onclick={triggerFileInput}
			>
				{#if isUploading}
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
				{:else}
					<svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
					</svg>
				{/if}
			</button>
		</div>
	</div>

	<!-- 선택된 샘플 정보 + 플레이어 -->
	{#if selectedSampleId && sampleDetail}
		<div class="space-y-3">
			<!-- 샘플 메타 -->
			<div class="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-label-01-normal-regular text-gray-500">
				<span class="text-label-01-normal-medium text-gray-700">{sampleDetail.name}</span>
				{#if sampleDetail.audio_duration}
					<span>길이: {formatDuration(sampleDetail.audio_duration)}</span>
				{/if}
				{#if sampleDetail.tags}
					<span class="rounded bg-gray-200 px-1.5 py-0.5 text-label-01-normal-regular">{sampleDetail.tags}</span>
				{/if}
			</div>

			<!-- 오디오 플레이어 -->
			{#if sampleDetail.input_type === 'audio'}
				<AudioPlayer
					sampleId={selectedSampleId}
					estimatedDuration={sampleDetail.audio_duration ?? 0}
				/>
			{/if}
		</div>
	{:else if !selectedSampleId}
		<div class="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-12">
			<div class="text-center">
				<svg class="mx-auto h-8 w-8 text-gray-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
				</svg>
				<p class="mt-2 text-label-01-normal-regular text-gray-400">오디오 샘플을 선택하거나 업로드하세요</p>
			</div>
		</div>
	{/if}
</div>
