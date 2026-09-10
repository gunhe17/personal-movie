<script lang="ts">
  import type { DefaultTemplateResponse } from '$lib/hooks/actions/messageTemplate.action'
  import { getVariableLabelMap } from '../constants'
  import { renderContentWithHighlight } from '../view-model'

  let {
    data,
    loading,
    error,
    onRetry,
    onCustomize,
    onSelect
  }: {
    data?: DefaultTemplateResponse
    loading: boolean
    error: boolean
    onRetry: () => void
    onCustomize: (content: string) => void
    onSelect: () => void
  } = $props()
  const content = $derived(
    data?.template?.content ?? data?.fallback_content ?? ''
  )
  const preview = $derived(
    renderContentWithHighlight(
      content,
      getVariableLabelMap('assessment_send_link')
    )
  )
</script>

<section
  aria-label="바로링크 기본 양식"
  class="space-y-3 border-b border-gray-200 p-6"
>
  <h2 class="text-base font-semibold text-gray-900">
    바로링크 전송 · 현재 기본 양식
  </h2>
  {#if loading}
    <p role="status" class="text-sm text-gray-500">
      기본 양식을 불러오는 중입니다.
    </p>
  {:else if error || !data}
    <p role="alert" class="text-sm text-red-600">
      기본 양식을 확인하지 못했습니다.
    </p>
    <button onclick={onRetry} class="text-sm text-primary-500 underline"
      >다시 불러오기</button
    >
  {:else}
    <p class="text-sm text-gray-700">
      {data.source === 'template'
        ? '센터 기본 양식'
        : data.source === 'system'
          ? '시스템 기본 양식'
          : '서비스 내장 기본 문구'}
      {data.template ? ` · ${data.template.name}` : ''}
    </p>
    <details class="rounded-lg bg-gray-50 p-3">
      <summary class="cursor-pointer text-sm text-gray-700"
        >기본 본문 확인</summary
      >
      <p class="mt-3 whitespace-pre-wrap text-sm text-gray-700">
        {@html preview}
      </p>
    </details>
    {#if !content.includes('{assessment_url}') || !content.includes('{verification_code}')}
      <p role="alert" class="text-sm text-amber-700">
        바로링크 또는 인증번호가 빠져 있어 전송할 수 없습니다. 기본 양식을
        수정해주세요.
      </p>
    {/if}
    {#if data.builtin_content && data.builtin_content !== content}
      <div class="space-y-2 rounded-lg border border-gray-200 p-3">
        <p class="text-sm text-gray-700">
          기존에 저장한 양식은 자동으로 바뀌지 않습니다. 서비스 기본 문구로 새
          센터 양식을 만들 수 있습니다.
        </p>
        <details>
          <summary class="cursor-pointer text-sm text-gray-700"
            >새 바로링크 기본 문구 확인</summary
          >
          <p class="mt-2 whitespace-pre-wrap text-sm text-gray-700">
            {@html renderContentWithHighlight(
              data.builtin_content,
              getVariableLabelMap('assessment_send_link')
            )}
          </p>
        </details>
        <button
          onclick={() => onCustomize(data.builtin_content!)}
          class="text-sm text-primary-500 underline"
          >새 바로링크 문구로 양식 만들기</button
        >
      </div>
    {/if}
    <p class="text-xs text-gray-500">
      센터 기본 → 시스템 기본 → 내장 문구 순서로 적용됩니다. 전송 화면에서 별도
      양식을 선택하면 그 양식을 사용합니다. 카카오 승인 템플릿과는 별개입니다.
    </p>
    {#if data.source === 'template'}
      <button onclick={onSelect} class="text-sm text-primary-500 underline"
        >센터 기본 양식 편집</button
      >
    {:else}
      <p class="text-xs text-gray-500">
        공통 기본 문구는 읽기 전용입니다. 센터 양식으로 복사한 뒤 수정·저장할 수
        있습니다.
      </p>
      <button
        onclick={() => onCustomize(content)}
        class="text-sm text-primary-500 underline"
        >센터 기본 양식으로 복사</button
      >
    {/if}
  {/if}
</section>
