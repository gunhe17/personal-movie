<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import type { SectionVM, SchemaStatsVM } from '../view-model'

  let { sections, stats }: { sections: SectionVM[]; stats: SchemaStatsVM } =
    $props()
</script>

<div class="rounded-lg border border-gray-200 bg-white p-6">
  <!-- 헤더: 제목 + 항목 수 + 필수/선택 -->
  <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-baseline gap-2">
      <Typography variant="headline-02-semibold" color="text-gray-900" tag="h2">
        양식 구성
      </Typography>
      <Typography variant="body-02-medium" color="text-gray-400" tag="span">
        {stats.totalFields}개 항목
      </Typography>
    </div>
    {#if stats.totalFields > 0}
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-500"
        tag="span"
      >
        필수 {stats.requiredFields} · 선택 {stats.optionalFields}
      </Typography>
    {/if}
  </div>

  <!-- 필드 타입 분포 칩 -->
  {#if stats.fieldTypeCounts.length > 0}
    <div class="mb-5 flex flex-wrap gap-1.5">
      {#each stats.fieldTypeCounts as tc (tc.label)}
        <span
          class="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600"
        >
          {tc.label}
          <span class="font-semibold text-gray-800">{tc.count}</span>
        </span>
      {/each}
    </div>
  {/if}

  <!-- 섹션별 필드 목록 -->
  {#if stats.totalFields === 0}
    <p class="py-8 text-center text-body-02-normal-regular text-gray-400">
      등록된 항목이 없어요
    </p>
  {:else}
    <div class="flex flex-col gap-6">
      {#each sections as section, i (section.title + i)}
        <div>
          <!-- 섹션 헤더 -->
          <div class="mb-2.5 flex items-center gap-2">
            <span
              class="flex h-5 w-5 items-center justify-center rounded bg-gray-800 text-label-02-normal-medium text-white"
            >
              {i + 1}
            </span>
            <Typography
              variant="body-01-normal-semibold"
              color="text-gray-800"
              tag="h3"
            >
              {section.title}
            </Typography>
            <Typography
              variant="body-03-regular"
              color="text-gray-400"
              tag="span"
            >
              {section.fields.length}개
            </Typography>
          </div>

          <!-- 필드 행 -->
          <ul class="flex flex-col">
            {#each section.fields as field (field.key)}
              <li
                class="grid grid-cols-[68px_1fr] gap-3 border-b border-gray-100 py-2.5 last:border-0"
              >
                <!-- 타입 배지 -->
                <div class="pt-0.5">
                  <span
                    class="inline-flex w-full items-center justify-center rounded px-1.5 py-0.5 text-label-02-normal-medium {field.typeBadgeText} {field.typeBadgeBg}"
                  >
                    {field.typeLabel}
                  </span>
                </div>

                <!-- 레이블 + 메타 -->
                <div class="flex min-w-0 flex-col gap-1.5">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      class="text-body-02-normal-medium {field.label
                        ? 'text-gray-800'
                        : 'italic text-gray-400'}"
                    >
                      {field.label || '(레이블 없음)'}
                    </span>
                    {#if field.required}
                      <span
                        class="inline-flex items-center rounded bg-status-danger-bg px-1.5 py-0.5 text-label-02-normal-medium text-red-600"
                      >
                        필수
                      </span>
                    {/if}
                  </div>

                  <!-- 선택지 -->
                  {#if field.hasOptions}
                    <div class="flex flex-wrap gap-1">
                      {#each field.options as opt, oi (oi)}
                        <span
                          class="inline-flex rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 text-label-02-normal-medium text-gray-500"
                        >
                          {opt}
                        </span>
                      {/each}
                    </div>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  {/if}
</div>
