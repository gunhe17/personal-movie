<script lang="ts">
  // AI 종합 판단 — 화면에서 AI 신호(ai-50 면 + ai-500 라인)는 여기 하나뿐이다.
  // "AI가 쓴 문장"과 "기록에서 뽑은 사실"이 시각적으로 갈려야 어디까지 믿을지 정할 수 있다.
  //
  // 라벨은 'AI 요약'이다 — 옛 'AI 한 줄 정리'는 실제로 두세 문장이 오는 자리라
  // 라벨이 화면과 어긋났다(프롬프트도 "무엇이 달라졌고 무엇이 남았는지" 둘을 요구한다).
  import AiStarIcon20 from '$lib/assets/AiStarIcon20.svelte'

  let { text, dense = false }: { text: string; dense?: boolean } = $props()
</script>

<div class="rounded-xl border border-ai-500 bg-ai-50 {dense ? 'p-4' : 'p-5'}">
  <div class="mb-2 flex items-center gap-2">
    <AiStarIcon20 />
    <span class="text-body-02-normal-medium text-ai-500">AI 요약</span>
  </div>
  <p class="text-body-01-reading-regular text-body-strong">{text}</p>
</div>
