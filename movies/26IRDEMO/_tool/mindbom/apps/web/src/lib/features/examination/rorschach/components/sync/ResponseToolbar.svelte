<script lang="ts">
  /**
   * 반응 선택 툴바 — 카드 탭 바로 아래. **실시와 채점이 같은 것을 쓴다.**
   *
   * 카드 탭이 "어느 카드"를 고르고, 이 줄이 "그 카드의 어느 반응"을 고른다.
   * 두 선택이 같은 층에 나란히 있어야 눈이 화면을 왕복하지 않는다(§14-5).
   *
   * ⚠️ **조각이 아니라 반응을 순회한다.** 예전 채점 화면 툴바는 `regions`를
   * 받아 칩을 그렸는데, 그러면 **영역이 아직 없는 반응은 고를 수 없었다** —
   * 실시 화면에서는 그게 정상 상태이고(자유반응만 하고 질문을 안 한 반응),
   * 채점 화면에서도 그 반응이 확정 게이트를 통과해버리던 원인이었다(§14-4).
   *
   * 칩 색이 **두 가지를 한꺼번에** 말한다:
   *   - 회색이면 빈 칸이 있다 (§14-12의 안전장치 — 이 신호를 잃으면 안 된다)
   *   - 색이 있으면 다 찼고, **그 색이 카드 위 조각의 색이다**
   *
   * 예전엔 완료를 전부 같은 초록으로 칠했다. 완성도는 말했지만 "칩 3번이
   * 어느 폴리곤인가"는 못 말했다 — 조각 라벨의 6px 숫자를 읽어야 했다.
   * 색을 반응별로 나누면 그 연결이 곁눈에 잡힌다.
   *
   * **미완에 고유색을 주지 않는 이유**: 색이 있으면 "채워졌다"로 읽힌다.
   * 회색 하나가 미완의 전용 신호여야 훑어보다 걸린다.
   */
  import type { Snippet } from 'svelte'
  import { scale } from 'svelte/transition'
  import { backOut } from 'svelte/easing'
  import ZoomControl from '$lib/components/ui/ZoomControl.svelte'
  import Icon from '$lib/components/ui/Icon.svelte'
  import { responseColor, RESPONSE_COLOR_NEUTRAL } from '../../constants'
  import type { ServerResponseDetail } from '../../actions'

  interface Props {
    /** 이 카드의 반응들 — response_no 순 */
    responses: ServerResponseDetail[]
    selectedId: string | null
    /** 이 반응이 채워야 할 칸을 다 채웠는가 — 칩 색이 이걸 따른다 */
    isDone?: (r: ServerResponseDetail) => boolean
    /**
     * 반응 **내용**을 감춘다 — 내담자 화면용.
     *
     * 칩 자체(번호·완성도)는 그대로 둔다. 피검자가 자기 반응이 몇 개인지 아는
     * 것은 실물 검사에서도 검사자가 채점지에 줄을 늘리는 걸 보는 것과 같다.
     * **감춰야 하는 건 무엇을 말했는지다** — 이전 반응의 문장을 다시 읽으면
     * 다음 반응이 오염된다.
     *
     * 지금 유출 경로는 툴팁 하나뿐이다: `title`에 자유반응 텍스트가 통째로 들어가
     * 칩에 손을 올리면 그대로 뜬다.
     */
    hideContent?: boolean
    onSelect: (id: string | null) => void
    /** 미제공 시 '반응 추가' 버튼을 그리지 않는다 (채점 화면) */
    onAdd?: () => void
    addDisabled?: boolean
    /** 미제공 시 줌 컨트롤을 그리지 않는다 */
    zoom?: number
    onZoomIn?: () => void
    onZoomOut?: () => void
    onZoomReset?: () => void
    /**
     * 우측 끝에 놓일 화면별 액션 (실시 화면의 '거부' 등).
     *
     * 툴바가 카드 레벨 행위를 알 필요는 없다 — 자리만 내준다.
     * 줌과 같은 자리를 쓰지만 둘이 함께 필요한 화면이 없다.
     */
    trailing?: Snippet
  }

  let {
    responses,
    selectedId,
    isDone,
    hideContent = false,
    onSelect,
    onAdd,
    addDisabled = false,
    zoom,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    trailing
  }: Props = $props()

  /**
   * 반응 번호 — **그냥 숫자다.**
   *
   * 예전에는 ①②③(원문자)을 썼다. 채점지 표기를 흉내낸 것인데, 글리프 안에
   * 원이 이미 들어 있어서 원형 칩 안에 넣으면 원이 이중이 되고 숫자가 그만큼
   * 작아진다 — 실시 중에 곁눈으로 보기에는 너무 작았다.
   *
   * 칩이 이미 원이므로 원은 칩이 그리고 숫자만 넣는다. 20을 넘겨도 깨지지
   * 않는다(원문자는 20까지만 있어서 `(21)`로 흘러넘쳤다).
   */
  function chipLabel(n: number | null): string {
    return n == null ? '·' : String(n)
  }

  let index = $derived(responses.findIndex((r) => r.id === selectedId))

  /**
   * Ctrl+↑↓로도 순회한다 — 손이 키보드에 있을 때 마우스로 옮기지 않게.
   * 반응 25개를 순서대로 지나갈 때 이게 없으면 매번 칩을 조준해야 한다.
   */
  function handleKeydown(e: KeyboardEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const next = index + (e.key === 'ArrowDown' ? 1 : -1)
    if (next < 0 || next >= responses.length) return
    onSelect(responses[next].id)
  }

  let hasZoom = $derived(zoom !== undefined)

  /**
   * 칩이 튀어나오는 시간 — `backOut`이라 목표 크기를 살짝 넘었다 돌아온다.
   *
   * 반응이 하나 늘었다는 걸 **목록을 세지 않고** 알게 하려는 것이다. 실시
   * 중에는 눈이 카드에 있고 툴바는 곁눈으로 보므로, 정적으로 하나 늘어난
   * 것은 잘 안 보인다. 움직임은 곁눈에 잡힌다.
   *
   * 카드를 바꿀 때도 그 카드의 칩들이 함께 튄다 — 목록이 통째로 갈리는
   * 것이므로 그게 맞다. 짧게(240ms) 둬서 카드 전환이 굼떠 보이지 않게 한다.
   *
   * ⚠️ **`out:` 전이는 두지 않는다.** Svelte는 나가는 요소를 전이가 끝날 때까지
   * DOM에 남겨두는데, 카드를 바꾸면 이전 카드 칩과 새 카드 칩이 그 시간 동안
   * 함께 존재한다. 화면에는 **없던 칩 하나가 번쩍 생겼다 사라지는** 것으로
   * 보이고, 자리까지 차지해 줄이 흔들린다. 들어올 때만 움직인다.
   */
  const CHIP_POP_MS =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 240
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2"
>
  <!-- 좌: 반응 칩. 반응이 많아도 가로 스크롤로 안 깨진다. -->
  <div class="flex min-w-0 items-center gap-2">
    <span class="mr-1 shrink-0 text-xs font-medium text-gray-700">반응</span>
    <!--
      가로 스크롤 컨테이너 — 반응이 많아도 줄이 안 깨진다.

      ⚠️ **여백은 장식이 아니다.** `overflow-x-auto`는 세로도 자르므로, 칩이
      자기 상자 밖으로 나가는 만큼을 안쪽 패딩으로 확보하고 같은 값의 음수
      마진으로 상쇄해야 한다. 밖으로 나가는 것이 둘이다:
        - 선택 표시 `outline-2 outline-offset-2` → 4px
        - 등장 애니메이션의 `backOut` 오버슈트 (목표 크기를 살짝 넘는다)
      4px일 때는 아웃라인 딱 그만큼이라 오버슈트가 잘렸다. 8px로 둘 다 담는다.
    -->
    <div
      class="-my-2 -mr-2 -ml-2 flex min-w-0 items-center gap-2 overflow-x-auto py-2 pr-2 pl-2"
    >
      {#each responses as r (r.id)}
        {@const active = r.id === selectedId}
        {@const done = isDone?.(r) ?? false}
        <!--
          색은 Tailwind 클래스가 아니라 인라인 style이다 — 팔레트 값이 런타임에
          정해지므로(`bg-[#3B82F6]` 같은 동적 클래스는 빌드 시 스캔에 안 잡혀
          스타일이 통째로 사라진다) 여기서는 style이 유일한 방법이다.
        -->
        <button
          type="button"
          in:scale={{ duration: CHIP_POP_MS, start: 0.5, easing: backOut }}
          onclick={() => onSelect(active ? null : r.id)}
          style="background-color: {done
            ? responseColor(r.response_no)
            : RESPONSE_COLOR_NEUTRAL};"
          class="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-label-01-normal-bold text-white shadow-sm transition-[outline,background-color] {active
            ? 'outline-2 outline-offset-2 outline-primary-500'
            : ''}"
          title={hideContent
            ? `반응 ${r.response_no}`
            : r.free_association_text || '(내용 없음)'}
          aria-label="반응 {r.response_no} 선택"
        >
          {chipLabel(r.response_no)}
        </button>
      {/each}
      {#if responses.length === 0}
        <span class="text-label-02-normal-regular text-gray-400">
          반응 없음
        </span>
      {/if}
    </div>

    {#if onAdd}
      <!--
        ⚠️ `onclick={onAdd}`로 직접 넘기지 않는다. onclick은 MouseEvent를 첫
        인자로 넘기는데, 받는 쪽이 선택 인자를 가지면(`handleAdd(at?: Date)`)
        그 이벤트가 조용히 그 자리에 들어앉는다. prop 타입이 `() => void`라
        타입검사기도 못 잡는다 — 실제로 그렇게 터졌다.
      -->
      <button
        type="button"
        onclick={() => onAdd?.()}
        disabled={addDisabled}
        class="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1 text-label-01-normal-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name="add" size="sm" />
        추가
      </button>
    {/if}
  </div>

  <!-- 우: 줌 컨트롤(채점) 또는 화면별 액션(실시의 '거부') -->
  {#if hasZoom && onZoomIn && onZoomOut && onZoomReset}
    <ZoomControl
      zoom={zoom ?? 1}
      {onZoomIn}
      {onZoomOut}
      {onZoomReset}
      resetLabel="원본 크기"
    />
  {:else if trailing}
    <div class="flex shrink-0 items-center gap-1.5">{@render trailing()}</div>
  {/if}
</div>
