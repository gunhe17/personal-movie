<script lang="ts">
  import ArrowRight from '$lib/assets/icons/ArrowRight.svelte'
  import Tooltip from '$lib/components/ui/Tooltip.svelte'

  interface Props {
    /** 이미지가 업로드된 그림 수 */
    uploadedCount: number
    totalCount: number
    /** 결과 보기로 넘어갈 수 있는지 (false면 비활성 + 툴팁) */
    canViewResults?: boolean
    /** canViewResults=false 일 때 비활성 버튼에 보일 툴팁 */
    viewDisabledHint?: string
    onViewResults: () => void
  }

  let {
    uploadedCount,
    totalCount,
    canViewResults = true,
    viewDisabledHint = '',
    onViewResults
  }: Props = $props()
</script>

<div
  class="h-16 shrink-0 flex items-center justify-between bg-white border-t border-gray-200 px-6"
>
  <div class="text-body-03-normal-regular text-gray-600">
    업로드 <span class="font-semibold text-gray-900">{uploadedCount}</span> / {totalCount}
  </div>

  <!-- 이탈은 헤더의 '검사 중단' 하나로 모았다. 입력은 자동저장된다. -->
  <div class="flex items-center gap-2">
    <Tooltip text={!canViewResults ? viewDisabledHint : ''} placement="top">
      <button
        onclick={onViewResults}
        disabled={!canViewResults}
        class="flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-5 py-2 text-body-03-normal-medium text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600"
      >
        결과 보기
        <ArrowRight size={20} />
      </button>
    </Tooltip>
  </div>
</div>
