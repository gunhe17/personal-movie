<script lang="ts">
  import type { ServerSpecialIndex } from '../../../actions'

  interface Props {
    /**
     * 지표 하나 — **항목 문장과 판정을 서버가 함께 준다.**
     *
     * 예전에는 서버가 `{"0": "v", "1": ""}`만 주고 문장은 이 화면의 배열에
     * 있었다. 둘을 잇는 것이 인덱스뿐이라 한쪽에 항목을 끼우면 그 뒤가
     * 통째로 밀렸는데 **아무 데서도 터지지 않았다** — 실제로 HVI가 밀려
     * "Zf > 12 ✔"가 전혀 다른 조건으로 켜졌다(워크북 137쪽 대조로 발견).
     */
    index: ServerSpecialIndex | undefined
  }
  let { index }: Props = $props()

  let items = $derived(index?.items ?? [])
  let metCount = $derived(items.filter((i) => i.met).length)
</script>

<!--
  **높이는 남는 자리를 나눠 갖는다.** 지표마다 항목 수가 다르다(S-CON 12개 ·
  CDI 5개). 고정 행 높이로 그리면 한 열은 바닥이 남고 다른 열은 꽉 차서
  네 열의 아래끝이 들쭉날쭉해진다. 행을 `flex-1`로 늘려 어느 지표든 컨테이너
  바닥에 맞춘다 — 항목이 적은 지표는 행이 두꺼워질 뿐이다.
  `min-h-7`은 남는 자리가 없을 때의 하한이다.
-->
<!--
  뿌리에는 `border-b`를 두지 않는다 — **항목 행이 각자 아래 선을 그리므로**
  마지막 행에서 선이 두 겹이 된다.
-->
<div class="flex flex-1 flex-col">
  <!-- 헤더: 판정 규칙과 결과. 규칙 문장도 서버가 준다 -->
  <div class="grid shrink-0 grid-cols-[40px_1fr]">
    <div class="flex h-7 items-center justify-center bg-gray-100 px-2">
      <span class="text-label-02-normal-regular text-gray-500">{metCount}</span>
    </div>
    <div class="flex h-7 items-center justify-between gap-2 bg-gray-100 px-2">
      <span class="truncate text-label-02-normal-regular text-gray-500"
        >{index?.rule ?? ''}</span
      >
      {#if index?.positive}
        <span
          class="shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-caption-01-normal-bold text-white"
          >양성</span
        >
      {/if}
    </div>
  </div>

  <!-- 항목들 -->
  {#each items as item, idx (idx)}
    <!-- 마지막 행은 아래 선을 안 그린다 — 섹션 프레임과 겹친다 -->
    <div class="grid min-h-7 flex-1 grid-cols-[40px_1fr] last:[&>*]:border-b-0">
      <div
        class="flex items-center justify-center border-r border-b border-gray-100 bg-gray-50 px-2"
      >
        <input
          type="checkbox"
          checked={item.met}
          disabled
          class="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
        />
      </div>
      <div
        class="flex items-center border-b border-gray-100 px-2.5 {item.met
          ? 'bg-blue-50'
          : ''}"
      >
        <span
          class="text-label-02-normal-regular {item.met
            ? 'text-blue-700'
            : 'text-gray-500'}">{item.label}</span
        >
      </div>
    </div>
  {/each}

  {#if items.length === 0}
    <div
      class="flex flex-1 items-center px-2.5 py-3 text-label-02-normal-regular text-gray-400"
    >
      산출하지 않았습니다.
    </div>
  {/if}
</div>
