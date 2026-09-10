<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import FormSnapshot from './FormSnapshot.svelte'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'
  import type { TemplateVM } from '../view-model'

  interface Props {
    template: TemplateVM
    onclick?: () => void
    /** 선택 강조 (테마 선택 모달 등) */
    selected?: boolean
    /** 바깥 폭 클래스 (기본 고정 150px) */
    class?: string
    /** true면 부모 셀을 가득 채움(그리드 2행 맞춤) — 고정폭+A4 비율 대신 */
    fill?: boolean
  }

  let {
    template,
    onclick,
    selected = false,
    class: className = 'w-[150px]',
    fill = false
  }: Props = $props()
</script>

<div
  class="flex min-h-0 shrink-0 flex-col items-center gap-2 {fill
    ? 'h-full w-full'
    : className}"
>
  <!-- 문서 스냅샷 -->
  <button
    type="button"
    {onclick}
    class="relative aspect-[210/297] overflow-hidden rounded-lg border bg-white shadow-card transition-colors {fill
      ? 'min-h-0 max-w-full flex-1'
      : 'w-full'} {selected
      ? 'border-primary-500'
      : 'border-gray-200 hover:border-gray-300'}"
  >
    <!-- 스냅샷만 딤드 — 배지는 그 밖에 둬야 흐려진 이유를 알려준다
         (피커로 쓰일 때는 활성만 넘어오므로 이 분기가 걸리지 않는다) -->
    <div class="h-full w-full {template.isActive ? '' : 'opacity-40'}">
      <FormSnapshot schema={template.schema} />
    </div>
    {#if !template.isActive}
      <BadgeRound
        status="completed"
        label="비활성"
        class="absolute left-1.5 top-1.5 h-6 min-w-0 bg-tag-gray-bg px-2 text-tag-gray-fg"
      />
    {/if}
  </button>

  <!-- 라벨 -->
  <Typography
    variant="body-03-normal-regular"
    color={selected
      ? 'text-primary-600'
      : template.isActive
        ? 'text-gray-600'
        : 'text-gray-400'}
    tag="span"
    className="max-w-full truncate-safe"
  >
    {template.name}
  </Typography>
</div>
