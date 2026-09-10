<script lang="ts">
  import type { PipelineConfigVM } from '../../production/view-model'

  let {
    configs = [],
    onSelect,
  }: {
    configs: PipelineConfigVM[]
    onSelect: (config: PipelineConfigVM) => void
  } = $props()

  // ── 기능 그룹 기반 구조 ──

  interface StepGroup {
    title: string
    icon: string
    badge: { label: string; color: string }
    trigger: string
    steps: string[]
    flow?: boolean // false 면 카드 사이 화살표 미표시(순차 흐름이 아닌 '대안' 그룹)
  }

  const STEP_GROUPS: StepGroup[] = [
    {
      title: '실시간 상담',
      icon: '🎙️',
      badge: { label: 'STT + LLM', color: 'bg-amber-50 text-amber-600' },
      trigger: '5분 단위 자동',
      steps: ['stt_transcribe', 'stt_streaming', 'refine', 'recommendation'],
    },
    {
      title: '녹음 완료 후 처리',
      icon: '🎤',
      badge: { label: 'STT + LLM', color: 'bg-violet-50 text-violet-600' },
      trigger: '녹음 완료 시 자동',
      steps: ['chain_stt_refine', 'summary'],
    },
    {
      title: '화자분리 비교 (실험)',
      icon: '🧪',
      badge: { label: 'STT', color: 'bg-fuchsia-50 text-fuchsia-600' },
      trigger: '수동 · 비교용',
      steps: ['stt_diarize', 'stt_text_diarize', 'stt_aws_text_diarize'],
      flow: false,
    },
    {
      title: '상담일지',
      icon: '📋',
      badge: { label: 'LLM', color: 'bg-blue-50 text-blue-600' },
      trigger: '수동 트리거',
      steps: ['counseling_note'],
    },
    {
      title: '사례 분석',
      icon: '📊',
      badge: { label: 'LLM', color: 'bg-indigo-50 text-indigo-600' },
      trigger: '종단 분석 요청 시',
      steps: ['case_analysis'],
    },
    {
      title: 'AI 에이전트',
      icon: '🤖',
      badge: { label: 'AGENT', color: 'bg-rose-50 text-rose-600' },
      trigger: '에이전트 호출 시',
      steps: ['skill_selection'],
    },
    {
      title: '바우처 문서 처리',
      icon: '📄',
      badge: { label: 'LLM', color: 'bg-teal-50 text-teal-600' },
      trigger: '바우처 등록 시 자동',
      steps: ['voucher_pdf_to_md', 'voucher_md_to_json'],
    },
  ]

  const STEP_HINTS: Record<string, string> = {
    stt_transcribe: 'N분 청크 단위 전사 (Whisper / GPT-4o)',
    stt_streaming: 'AWS Transcribe 실시간 스트리밍 전사',
    stt_diarize: '오디오 기반 화자분리 (gpt-4o-diarize) · 비교 레퍼런스',
    stt_text_diarize: 'whisper 전사 → LLM이 텍스트로 화자 추론 (실험)',
    stt_aws_text_diarize: 'AWS 실시간 전사 그대로 → LLM 화자 라벨만 (재전사 없음 · 싱크 검증)',
    chain_stt_refine: 'STT 화자분리 → LLM 보정 한번에',
    refine: '프롬프트로 전사 보정 품질 튜닝',
    summary: '보정된 전사 기반 핵심 요약',
    counseling_note: '구조화된 상담일지 자동 생성',
    recommendation: '실시간 전사 기반 상담 방향 제안',
    case_analysis: '여러 회기에 걸친 상담 기록 종단적 분석',
    skill_selection: 'AI 에이전트 스킬 라우팅 및 선택',
    voucher_pdf_to_md: '바우처 PDF → 마크다운 변환',
    voucher_md_to_json: '마크다운 → 구조화 JSON 추출',
  }

  const STEP_TYPE_LABEL: Record<string, string> = {
    stt_transcribe: 'STT',
    stt_streaming: 'STT',
    stt_diarize: 'STT',
    stt_text_diarize: 'STT',
    stt_aws_text_diarize: 'STT',
    chain_stt_refine: 'CHAIN',
    refine: 'LLM',
    summary: 'LLM',
    counseling_note: 'LLM',
    recommendation: 'LLM',
    case_analysis: 'LLM',
    skill_selection: 'AGENT',
    voucher_pdf_to_md: 'LLM',
    voucher_md_to_json: 'LLM',
  }

  const STEP_TYPE_COLOR: Record<string, string> = {
    stt_transcribe: 'bg-amber-50 text-amber-600',
    stt_streaming: 'bg-cyan-50 text-cyan-600',
    stt_diarize: 'bg-violet-50 text-violet-600',
    stt_text_diarize: 'bg-fuchsia-50 text-fuchsia-600',
    stt_aws_text_diarize: 'bg-cyan-50 text-cyan-600',
    chain_stt_refine: 'bg-violet-50 text-violet-600',
    refine: 'bg-blue-50 text-blue-600',
    summary: 'bg-blue-50 text-blue-600',
    counseling_note: 'bg-blue-50 text-blue-600',
    recommendation: 'bg-emerald-50 text-emerald-600',
    case_analysis: 'bg-indigo-50 text-indigo-600',
    skill_selection: 'bg-rose-50 text-rose-600',
    voucher_pdf_to_md: 'bg-teal-50 text-teal-600',
    voucher_md_to_json: 'bg-teal-50 text-teal-600',
  }

  function getGroupConfigs(group: StepGroup): PipelineConfigVM[] {
    return group.steps
      .map((key) => configs.find((c) => c.step === key))
      .filter((c): c is PipelineConfigVM => c != null)
  }
</script>

<div class="space-y-6">
  {#each STEP_GROUPS as group, gi}
    {@const groupConfigs = getGroupConfigs(group)}
    {#if groupConfigs.length > 0}
      <div>
        <div class="mb-3 flex items-center gap-2">
          <span class="text-base">{group.icon}</span>
          <h3 class="text-body-03-normal-semibold text-gray-900">{group.title}</h3>
          <span class="rounded-full px-1.5 py-0.5 text-label-01-normal-bold {group.badge.color}">
            {group.badge.label}
          </span>
          <span class="rounded-full bg-gray-100 px-2 py-0.5 text-label-01-normal-medium text-gray-500">
            {group.trigger}
          </span>
        </div>

        <div class="flex items-stretch gap-2">
          {#each groupConfigs as config, i (config.step)}
            {#if i > 0 && groupConfigs.length <= 3 && group.flow !== false}
              <div class="flex shrink-0 items-center">
                <svg class="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            {/if}

            <button
              class="group flex min-w-0 flex-1 flex-col gap-2.5 rounded-2xl border p-4 text-left transition-all hover:border-primary-300 hover:shadow-sm
                {config.isConfigured ? 'border-gray-200 bg-[#FDFDFD]' : 'border-dashed border-gray-300 bg-gray-50/50'}"
              onclick={() => onSelect(config)}
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="rounded-full px-1.5 py-0.5 text-label-01-normal-bold {STEP_TYPE_COLOR[config.step] ?? 'bg-gray-100 text-gray-500'}">
                    {STEP_TYPE_LABEL[config.step] ?? 'AI'}
                  </span>
                  {#if config.isConfigured}
                    <span class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-label-01-normal-medium text-emerald-600">설정됨</span>
                  {/if}
                </div>
              </div>

              <div>
                <p class="text-body-03-normal-semibold text-gray-900">{config.label}</p>
                <p class="mt-1 text-label-01-normal-regular leading-relaxed text-gray-400">
                  {STEP_HINTS[config.step] ?? config.description}
                </p>
              </div>

              <div class="flex items-center justify-between">
                <span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-label-01-normal-regular font-mono text-gray-500">
                  {config.isConfigured ? config.modelLabel : '기본 모델'}
                </span>
                <span class="text-label-01-normal-medium text-primary-500 opacity-0 transition-opacity group-hover:opacity-100">
                  {config.hasPrompt ? '프롬프트 수정 →' : '모델 변경 →'}
                </span>
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  {/each}
</div>
