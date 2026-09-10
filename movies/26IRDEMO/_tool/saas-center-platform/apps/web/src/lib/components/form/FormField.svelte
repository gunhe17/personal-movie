<script lang="ts">
  import type { Snippet } from 'svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    /** 라벨 텍스트 (없으면 라벨 줄 생략) */
    label?: string
    /** 필수 필드(*) 표시 */
    required?: boolean
    /** 에러 메시지 (있으면 빨간 텍스트로 노출) */
    error?: string
    /** data-field 값 (제출 검증 실패 시 스크롤 타겟). 보통 id와 동일 */
    field?: string
    /** label for= 연결 대상 id */
    htmlFor?: string
    /** 필수 값이 유효하게 채워졌는지 — 라벨 옆 완료 체크(✓) 시그널 */
    filled?: boolean
    /**
     * 에러 줄(min-h) 자리를 항상 차지할지.
     * true: 그리드 정렬 안정 (보호자 섹션처럼 인라인 에러가 있는 곳)
     * false: 에러 줄 없이 컴팩트 (내담자 정보 섹션처럼 요약 카드에 에러 표시하는 곳)
     */
    reserveErrorSpace?: boolean
    children: Snippet
  }

  let {
    label,
    required = false,
    error,
    field,
    htmlFor,
    filled = false,
    reserveErrorSpace = true,
    children
  }: Props = $props()
</script>

<div data-field={field}>
  {#if label}
    <label for={htmlFor} class="mb-2 flex items-center gap-1">
      <Typography variant="body-02-normal-medium" color="text-title-subtitle">
        {label}{#if required}<span class="text-status-danger"> *</span>{/if}
      </Typography>
      <!-- 완료 피드백: 필수 값이 유효하게 채워지면 옅은 체크 -->
      {#if filled}
        <svg
          class="h-3.5 w-3.5 text-primary-400 transition-opacity duration-200"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3.5 8.5L6.5 11.5L12.5 4.5"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {/if}
    </label>
  {/if}

  {@render children()}

  {#if error || reserveErrorSpace}
    <p class="mt-1 field-help is-error">{error ?? ''}</p>
  {/if}
</div>
