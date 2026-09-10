<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import NoFieldNoteIcon54 from '$lib/assets/NoFieldNoteIcon54.svelte'

  interface Props {
    onLinkExisting?: () => void
  }
  let { onLinkExisting }: Props = $props()
</script>

<div class="flex flex-1 flex-col items-center justify-center py-12 text-center">
  <NoFieldNoteIcon54 />

  <!-- 아이콘 ↔ 제목: 12px -->
  <Typography
    variant="title-01-reading-semibold"
    color="text-gray-800"
    className="mt-3"
  >
    아직 연결된 필드노트가 없어요
  </Typography>

  <!-- 제목 ↔ 설명: 8px -->
  <Typography
    variant="body-01-reading-regular"
    color="text-gray-600"
    className="mt-2"
  >
    모바일 앱에서 녹음한 필드노트를 연결하면<br />
    AI 요약과 상담 분석을 확인할 수 있어요.
  </Typography>

  <!-- 설명 ↔ 버튼: 16px, 크기 133 × 40, primary-500 -->
  <button
    type="button"
    onclick={() => onLinkExisting?.()}
    class="mt-4 inline-flex w-[133px] h-10 items-center justify-center rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors"
  >
    <Typography variant="body-01-normal-medium" color="text-white">
      필드노트 연결
    </Typography>
  </button>
</div>
