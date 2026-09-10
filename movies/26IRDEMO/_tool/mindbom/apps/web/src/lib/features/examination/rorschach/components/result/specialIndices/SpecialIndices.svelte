<script lang="ts">
  import ParentSection from '../shared/ParentSection.svelte'
  import IndexChecklist from './IndexChecklist.svelte'
  import type { ServerSpecialIndex } from '../../../actions'

  interface Props {
    data: Record<string, ServerSpecialIndex>
  }
  let { data }: Props = $props()

  /**
   * **항목 문장도 판정도 서버가 준다** — 이 화면은 그리기만 한다.
   *
   * 예전에는 여기에 지표별 항목 배열 6개(`SCON_ITEMS`…)와 임계값 표가
   * 손으로 적혀 있었다. 조건은 백엔드에, 문장은 여기에, 잇는 것은 문자열
   * 인덱스뿐이었다. 한쪽에 항목을 끼우면 그 뒤가 조용히 밀린다 — 실제로
   * HVI는 인덱스 2부터 밀려 **"Zf > 12 ✔"가 Zf를 보지 않는 조건으로**
   * 켜지고 있었다(워크북 137쪽 Constellation Worksheet 대조로 발견).
   *
   * 임계값을 화면이 가질 수 없는 이유도 있다: 원전의 HVI는 "1번 필수 +
   * 나머지 7개 중 4개", OBS는 "4개 복합 규칙 중 하나"라 개수 비교로는
   * 판정 자체가 성립하지 않는다.
   */
  const ORDER = [
    { key: 'sConstellation', title: 'S-Con (Suicide Constellation)' },
    { key: 'cdi', title: 'CDI (Coping Deficit Index)' },
    { key: 'depi', title: 'DEPI (Depression Index)' },
    { key: 'hvi', title: 'HVI (Hypervigilance Index)' },
    { key: 'pti', title: 'PTI (Perceptual-Thinking Index)' },
    { key: 'obs', title: 'OBS (Obsessive Style Index)' },
  ] as const

  /** 요약 칸 — 라벨·판정 모두 서버 값 그대로 */
  let summary = $derived(
    ORDER.map(({ key }) => ({ key, index: data?.[key] })).filter(
      (row) => row.index !== undefined
    )
  )

  /** 2·3·4열에 두 개씩 */
  let columns = $derived([
    ORDER.slice(0, 2),
    ORDER.slice(2, 4),
    ORDER.slice(4, 6),
  ])
</script>

<!--
  **콘텐츠 영역을 꽉 채운다.** 네 열이 같은 높이로 바닥까지 내려가고, 각
  지표 표는 남는 자리를 행이 나눠 갖는다(`IndexChecklist` 주석). 지표마다
  항목 수가 달라(S-CON 12 · CDI 5) 고정 높이로 두면 아래끝이 들쭉날쭉했다.
-->
<div class="grid h-full min-h-0 grid-cols-4 gap-2 p-2">
  <!-- 1열: 요약 -->
  <ParentSection
    title="특수 지표 요약"
    class="flex min-h-0 flex-col border border-blue-100"
  >
    <div class="flex-1 space-y-1.5 overflow-auto p-2">
      {#each summary as row (row.key)}
        {@const idx = row.index}
        {@const met = (idx?.items ?? []).filter((i) => i.met).length}
        <div
          class="flex items-center justify-between rounded px-2 py-1.5 {idx?.positive
            ? 'bg-red-50'
            : 'bg-gray-50'}"
        >
          <span
            class="text-xs font-medium {idx?.positive
              ? 'text-red-700'
              : 'text-gray-700'}">{idx?.label ?? row.key}</span
          >
          <div class="flex items-center gap-1.5">
            <span class="text-label-02-normal-regular text-gray-500"
              >{met}개 해당</span
            >
            {#if idx?.positive}
              <span
                class="rounded bg-red-500 px-1.5 py-0.5 text-caption-01-normal-bold text-white"
                >양성</span
              >
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </ParentSection>

  {#each columns as column, ci (ci)}
    <div class="flex flex-col gap-2">
      {#each column as { key, title } (key)}
        <!--
          두 지표가 **내용 높이를 지키고 남는 자리만 나눠 갖는다**(`flex-1`,
          basis auto).

          ⚠️ `basis-0`으로 반씩 강제하면 안 된다. 지표마다 항목 수가 크게
          다른데(S-CON 12 · CDI 5) 반씩 자르면 S-CON이 제 몫보다 커져 박스
          밖으로 흘러나간다 — 아래 테두리가 박스 밖에 그려져 **S-CON만
          테두리가 없는 것처럼 보였다.**
        -->
        <ParentSection
          {title}
          mainColor="#4B5563"
          class="flex flex-1 flex-col border border-gray-200"
          headerClass="bg-gray-600"
        >
          <IndexChecklist index={data?.[key]} />
        </ParentSection>
      {/each}
    </div>
  {/each}
</div>
