<script lang="ts">
  // 우측 회기 목록(목업) — 실제 화면의 회기 카드 그리드 자리.
  import Typography from '@common/components/Typography.svelte'

  let { count = 6 }: { count?: number } = $props()
</script>

<div class="min-h-0 flex-1 overflow-y-auto p-6">
  <div class="grid grid-cols-2 gap-4">
    {#each Array(count) as _, i}
      <div class="h-30 rounded-2xl border border-gray-200 p-5">
        <Typography
          variant="body-01-normal-regular"
          color="text-caption-subtle"
        >
          {i + 1}회기 카드 (기존 화면 그대로)
        </Typography>
      </div>
    {/each}
  </div>
</div>
