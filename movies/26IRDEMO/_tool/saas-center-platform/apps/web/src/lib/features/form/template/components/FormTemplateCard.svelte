<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import type { TemplateVM } from '../view-model'

  interface Props {
    template: TemplateVM
  }

  let { template }: Props = $props()

  // 문항 placeholder 라벨 폭 (실제 preview 전까지) — 리터럴이라 Tailwind 스캔됨
  const ROW_LABEL_WIDTHS = [
    'w-2/5',
    'w-1/2',
    'w-1/3',
    'w-3/5',
    'w-2/5',
    'w-1/2'
  ]
</script>

<!-- 박스 전체가 A4 비율(210:297) -->
<div
  class="relative flex aspect-[210/297] w-[200px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
>
  <!-- 문서 영역 (가득 채움) — 추후 실제 form preview 로 교체 -->
  <div class="flex flex-1 flex-col gap-2 overflow-hidden p-4">
    <!-- 제목 placeholder -->
    <div class="h-2.5 w-3/5 shrink-0 rounded-full bg-gray-300"></div>
    <div class="h-px w-full shrink-0 bg-gray-100"></div>

    <div class="flex flex-1 flex-col gap-2.5 overflow-hidden">
      {#each ROW_LABEL_WIDTHS as w}
        <div class="space-y-1">
          <div class="h-1.5 {w} rounded-full bg-gray-200"></div>
          <div
            class="h-4 w-full rounded-[3px] border border-gray-200 bg-gray-50"
          ></div>
        </div>
      {/each}
    </div>
  </div>

  <!-- 하단 정보 바 (검사 관리 카드 바와 동일: h-11, border-t) — 제목만 표시 -->
  <div
    class="flex h-11 shrink-0 items-center border-t border-gray-200 bg-white px-4"
  >
    <Typography
      variant="body-02-medium"
      color="text-gray-800"
      tag="span"
      className="truncate-safe"
    >
      {template.name}
    </Typography>
  </div>
</div>
