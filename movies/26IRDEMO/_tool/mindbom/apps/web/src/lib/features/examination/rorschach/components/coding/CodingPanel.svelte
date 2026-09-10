<script lang="ts">
  import { CODING_OPTIONS, Z_VALUES, popularCandidates, zValue } from '../../constants'
  import type { RorschachCoding } from '../../types'
  import TagDropdown from './TagDropdown.svelte'
  import Tooltip from '$lib/components/ui/Tooltip.svelte'

  interface Props {
    title?: string
    /** AI 초안 */
    aiCoding: RorschachCoding | null
    /** 임상가 확정 (수정 가능). null이면 ai를 시작값으로 사용 */
    finalCoding: RorschachCoding | null
    /**
     * 반응의 위치 부호 — 임상가가 `LocationPicker`로 고른 값(§14-7).
     * `coding.location`의 정본이며 여기서 편집하면 반응에 저장된다.
     */
    areaCode?: string | null
    /** 카드 번호 1..10 — 평범반응 표를 찾는 데 쓴다 */
    cardNo?: number | null
    /** 위치 부호 변경 — 반응에 저장된다(조각이 아니라) */
    onChangeLocation?: (code: string | null) => void
    aiConfidence?: number | null
    aiReasoning?: string | null
    readonly?: boolean
    /** 저장할 변경이 남았는가 — 푸터 버튼의 활성 여부 (밖으로 내보낸다) */
    dirty?: boolean
    /**
     * 반영할 AI 제안이 남았는가 — **밖으로 내보내는 값이다.**
     *
     * AI 제안 상자는 팝오버 상단으로 올라갔는데(피드백), '전체 반영' 버튼의
     * 활성 여부는 **여기 편집 중인 값(`local`)**을 봐야 정확하다. 저장 전
     * 편집까지 반영되려면 이 컴포넌트가 판정해서 올려주는 수밖에 없다.
     */
    adoptable?: boolean
    onSave: (coding: RorschachCoding) => void
  }

  let {
    title = '',
    aiCoding,
    finalCoding,
    areaCode = null,
    cardNo = null,
    aiConfidence = null,
    aiReasoning = null,
    readonly = false,
    adoptable = $bindable(false),
    dirty = $bindable(false),
    onChangeLocation,
    onSave
  }: Props = $props()

  function emptyCoding(): RorschachCoding {
    return {
      location: null,
      dq: null,
      determinants: [],
      fq: null,
      pair: null,
      contents: [],
      popular: null,
      zScore: null,
      specialScores: []
    }
  }

  /**
   * 서버에서 온 코딩을 편집용으로 복제한다.
   *
   * ⚠️ **`structuredClone`을 쓰면 안 된다.** 부르는 쪽의 `responses`가
   * `$state`라 Svelte 5가 깊게 프록시를 씌우고, 그 안의 배열
   * (`determinants`·`contents`·`specialScores`)이 프록시인 채로 여기 들어온다.
   * `structuredClone`은 프록시를 복제하지 못하고 **DataCloneError를 던진다.**
   *
   * 그러면 이 함수를 부른 `$effect`가 통째로 죽어서 `local`이 빈 값에 머문다 —
   * **저장한 채점을 다시 열면 전부 비어 보이는** 증상이 정확히 이것이었다.
   * 에러는 콘솔에만 남고 화면은 "아직 안 채웠다"와 구분되지 않는다.
   *
   * 칸을 하나씩 옮기면 프록시가 벗겨지고, 어떤 칸이 있는지도 코드에 드러난다.
   */
  function cloneCoding(c: RorschachCoding): RorschachCoding {
    return {
      location: c.location,
      dq: c.dq,
      determinants: [...(c.determinants ?? [])],
      fq: c.fq,
      pair: c.pair,
      contents: [...(c.contents ?? [])],
      popular: c.popular,
      zScore: c.zScore,
      specialScores: [...(c.specialScores ?? [])]
    }
  }

  /** local 편집 상태. 빈 값으로 시작 후 effect에서 prop 동기화. */
  let local = $state<RorschachCoding>(emptyCoding())
  let lastKey = $state<string>('')

  /**
   * 외부 prop이 바뀌면 local 재초기화. JSON 비교로 무한 루프 방지.
   *
   * ⚠️ **AI 초안을 임상가 칸에 미리 채우지 않는다** (§14-4).
   *
   * 예전에는 `finalCoding ?? aiCoding`으로 시드를 잡았다. 그래서 화면상
   * "임상가가 W를 골랐다"와 "AI가 W라 했고 임상가는 아직 안 봤다"가 완전히
   * 똑같이 보였고, 서버는 확정 시 그 AI 값을 그대로 승격시켰다 — CDSS 원칙
   * (AI 초안 → 임상가 확인)이 깨진 자리다.
   *
   * 이제 AI 값은 옆 열에 읽기 전용으로만 보이고, 채택하려면 임상가가
   * 눌러야 한다. **채택도 능동적 행위로 기록된다.**
   *
   * location만 예외적으로 `areaCode`를 시드로 쓴다 — 그건 AI가 아니라
   * 임상가가 영역을 그리며 고른 값이기 때문이다.
   */
  $effect(() => {
    const key = JSON.stringify({ ai: aiCoding, fin: finalCoding, ac: areaCode })
    if (key === lastKey) return
    lastKey = key
    if (finalCoding) {
      local = cloneCoding(finalCoding)
      local.location = areaCode ?? local.location
    } else {
      const seed = emptyCoding()
      seed.location = areaCode
      local = seed
    }
  })

  /** AI 제안이 있는데 임상가 칸이 비어 있는 항목 — "AI 제안 채택" 버튼용 */
  let aiKeys = ['dq', 'fq', 'zScore'] as const
  let aiMultiKeys = ['determinants', 'contents', 'specialScores'] as const
  /**
   * 3상태 칸(`pair`·`popular`)도 센다 — **`handleAdopt`가 얹는 것과 같은
   * 목록이어야 한다.** 예전엔 여기서 둘을 빼먹어, AI가 (2)나 P를 제안했는데
   * 임상가 칸이 미확인이어도 버튼이 '확인됨'으로 떴다. 반영할 것이 남았는지
   * 세는 곳과 실제로 반영하는 곳이 갈리면 버튼이 거짓말을 한다.
   */
  let aiTriKeys = ['pair', 'popular'] as const
  let hasUnadopted = $derived.by(() => {
    if (!aiCoding) return false
    return (
      aiKeys.some((k) => aiCoding[k] && !local[k]) ||
      aiMultiKeys.some((k) => aiCoding[k]?.length && local[k].length === 0) ||
      aiTriKeys.some((k) => aiCoding[k] === true && local[k] === null)
    )
  })

  /** '전체 반영'을 누를 수 있는가 — 상자는 팝오버에 있고 판정만 여기서 한다 */
  let canAdopt = $derived(!readonly && hasUnadopted)
  $effect(() => {
    adoptable = canAdopt
  })
  $effect(() => {
    dirty = isDirty
  })

  /**
   * AI 제안 채택 — **팝오버가 부른다**(`bind:this`).
   *
   * 상자는 위로 올라갔지만 채택은 `local`을 건드리므로 여기 남는다.
   * 로직을 팝오버로 옮기면 편집 중인 값을 밖에서 알아야 해서 상태가 둘이 된다.
   */
  export function adopt() {
    adoptAi()
  }

  /**
   * 저장 — **팝오버 푸터가 부른다.**
   *
   * 버튼은 팝오버 하단에 붙었지만(피드백), 저장할 값(`local`)은 여기 있다.
   * 채택과 같은 이유로 자리만 옮기고 동작은 남긴다.
   */
  export function save() {
    handleSave()
  }

  /** AI 제안을 임상가 칸으로 옮긴다 — 비어 있는 칸만 채운다(덮어쓰지 않는다) */
  function adoptAi() {
    if (!aiCoding) return
    const next = { ...local }
    for (const k of aiKeys) if (aiCoding[k] && !next[k]) next[k] = aiCoding[k]
    for (const k of aiMultiKeys) {
      if (aiCoding[k]?.length && next[k].length === 0)
        next[k] = [...aiCoding[k]]
    }
    // 3상태 둘 다 **미확인(null)일 때만** AI 제안을 얹는다. `!next.pair`로
    // 보면 임상가가 "쌍 아님"으로 확정한 값까지 덮는다 — 채택은 빈 칸을
    // 채우는 일이지 판단을 뒤집는 일이 아니다(§14-8).
    if (aiCoding.pair && next.pair === null) next.pair = true
    if (aiCoding.popular && next.popular === null) next.popular = true
    local = next
  }

  /** 저장할 것이 있는가 — 확정본과 다르면 저장 가능 */
  let isDirty = $derived(
    JSON.stringify(local) !== JSON.stringify(finalCoding ?? emptyCoding())
  )

  /**
   * 표 안 컨트롤의 공통 골격 — **한 줄에 나란히 서므로 높이가 같아야 한다.**
   *
   * 예전에는 높이가 셋으로 갈려 있었다: LocationPicker는 `h-7`(28px), 다중선택
   * 트리거는 `min-h-6.5`(26px), 단일선택·토글은 높이 지정이 없어 글꼴에 따라
   * 정해졌다. 같은 줄에서 2~6px씩 어긋나 바닥선이 들쭉날쭉했다.
   *
   * `h-7`로 맞춘 것은 LocationPicker가 이미 그 값을 쓰고 있어서다 — 별도
   * 컴포넌트라 여기서 바꿀 수 없는 쪽에 맞추는 게 맞다.
   *
   * ⚠️ **값을 여기 한 곳에만 둔다.** 여섯 군데에 적어두면 하나를 고칠 때
   * 나머지가 남아 조용히 어긋난다 — 실제로 그래서 갈렸다.
   *
   * ⚠️ 클래스는 **문자열로 그대로 적는다.** Tailwind는 소스에서 클래스 이름을
   * 글자 그대로 찾으므로, 런타임에 조합해 만들면(`base.replace('h-7','min-h-7')`
   * 같은 것) 그 클래스는 CSS에 안 실린다. 조금 중복돼도 눈에 보이는 편이 낫다.
   */
  const CONTROL_COMMON =
    'rounded px-2 transition-colors disabled:opacity-60 disabled:cursor-default'
  /** 단일 선택(DQ·FQ·Z) — 값 하나가 가운데 놓인다 */
  const CONTROL_SINGLE = `h-7 min-w-12 border text-center text-label-01-normal-medium ${CONTROL_COMMON}`
  /**
   * 다중 선택(결정인·내용·특수점수) — 칩이 여러 개면 줄이 늘어난다.
   * 그래서 `h-7`이 아니라 `min-h-7`이다. 고정하면 칩이 상자 밖으로 넘친다.
   */
  const CONTROL_MULTI =
    'min-h-7 w-full border border-gray-200 hover:border-gray-300 text-left ' +
    `flex items-center gap-1 flex-wrap text-label-01-normal-medium ${CONTROL_COMMON}`
  /** 토글((2)·P) — 보더 대신 채움으로 상태를 말한다. 높이는 같다 */
  const CONTROL_TOGGLE = `h-7 inline-flex items-center justify-center text-label-01-normal-medium ${CONTROL_COMMON}`

  let activeDropdown = $state<string | null>(null)

  /** 각 트리거 버튼 ref (portal anchor용) */
  let triggerEls = $state<Record<string, HTMLButtonElement | null>>({
    location: null,
    dq: null,
    determinants: null,
    fq: null,
    contents: null,
    zScore: null,
    specialScores: null
  })

  function handleSingleSelect(
    key: 'location' | 'dq' | 'fq' | 'zScore',
    value: string
  ) {
    local = { ...local, [key]: local[key] === value ? null : value }
    activeDropdown = null
  }

  function handleMultiToggle(
    key: 'determinants' | 'contents' | 'specialScores',
    value: string
  ) {
    const arr = local[key] as string[]
    const next = arr.includes(value)
      ? arr.filter((v) => v !== value)
      : [...arr, value]
    local = { ...local, [key]: next }
  }

  /**
   * (2)도 **세 값을 돈다** — P와 같은 규칙이다(`cyclePopular` 주석).
   *
   * 쌍반응은 반점의 대칭에 근거해 같은 대상을 둘로 봤는가의 판단이라, 여기서도
   * "안 봤다"와 "쌍이 아니라고 판단했다"는 다른 상태다. 여기서 유독 값이 센
   * 이유는 (2)가 **자아중심성 지표 3r+(2)/R**에 직접 들어가고 그 값이 다시
   * S-CON·DEPI로 흘러가기 때문이다 — 검토 안 한 반응이 "쌍 아님"으로 집계되면
   * 지표가 조용히 낮아진다.
   */
  function cyclePair() {
    const next = local.pair === null ? true : local.pair ? false : null
    local = { ...local, pair: next }
  }

  /**
   * P는 **세 값을 돈다**: 미확인(null) → P(true) → P 아님(false) → 미확인.
   *
   * 예전엔 켜고 끄는 두 값이었고 기본값이 false였다. 그래서 "안 봤다"와
   * "표를 보고 P가 아니라고 판단했다"가 같은 값이 되어, 검토자가 무엇을
   * 확인했는지 알 수 없었다(§13 E-2).
   *
   * 집계는 true만 센다 — null과 false는 둘 다 P가 아니다. 구분이 필요한 곳은
   * 검토·감사추적이지 계산이 아니다.
   */
  function cyclePopular() {
    const next = local.popular === null ? true : local.popular ? false : null
    local = { ...local, popular: next }
  }

  /**
   * 이 카드·영역이 평범반응 자리인가 (워크북 〈표 5-2〉).
   *
   * ⚠️ **자동으로 P를 켜지 않는다.** 기준에 "반점의 꼭대기가 박쥐의 상단부로
   * 지각되고"처럼 무엇으로 봤는지가 걸려 있어, 영역이 맞아도 내용이 다르면
   * P가 아니다. 표는 "여기가 P 자리다"까지만 말하고 판단은 임상가가 한다
   * — AI 초안을 임상가 칸에 미리 채우지 않는 것과 같은 이유다(§14-4).
   */
  let pCandidates = $derived(
    cardNo ? popularCandidates(cardNo, local.location) : []
  )

  /**
   * 지금 고른 Z부호의 값 — **카드마다 다르다**(워크북 〈표 6-1〉 94쪽).
   *
   * 카드 I의 ZW은 1.0인데 카드 IX의 ZW은 5.5다. 부호만 보이면 임상가는
   * 자기가 몇 점을 주는지 모르고, "두 기준을 함께 만족하면 더 높은 값을
   * 준다"는 규칙도 적용할 수 없다.
   */
  let zSelectedValue = $derived(zValue(cardNo, local.zScore))
  /** 이 카드의 네 부호 값 — 고르기 전에 무엇이 높은지 보여준다 */
  let zCardValues = $derived(cardNo ? (Z_VALUES[cardNo] ?? null) : null)

  const POPULAR_LABEL = {
    unset: '미확인 — 표를 보고 판단해주세요',
    yes: '평범반응(P)으로 확정',
    no: '평범반응이 아님으로 확정'
  }

  const PAIR_LABEL = {
    unset: '미확인 — 대칭에 근거한 쌍인지 판단해주세요',
    yes: '쌍반응(2)으로 확정',
    no: '쌍반응이 아님으로 확정'
  }

  function handleSave() {
    // Svelte 5 $state proxy를 plain 객체로 변환해서 전달 (structuredClone 직접 호출 시 DataCloneError)
    onSave($state.snapshot(local) as RorschachCoding)
  }

  function fmtConfidence(c: number | null): string {
    if (c === null) return '-'
    return `${(c * 100).toFixed(0)}%`
  }
</script>

<!--
  높이를 채우지 않는다(`h-full` 없음) — 팝오버가 내용만큼 늘어나고 스크롤을
  두지 않기 때문이다. `h-full`이면 부모 높이에 맞춰 늘어난 뒤 자기 안에서
  다시 스크롤이 생겨, 결국 스크롤바가 두 겹이 된다.
-->
<!--
  **껍데기가 없다.** 예전엔 자기 테두리·둥근 모서리·패딩을 갖고 있었는데,
  팝오버에서 기록 표(반응·질문·위치)와 나란히 놓이면서 **상자 두 개가 위아래로
  붙은 모양**이 됐다. 채점지는 한 장인데 화면은 두 장으로 보였다.

  지금은 행만 내놓고, 테두리는 팝오버가 두 표를 감싸며 한 번만 그린다.
  그래서 여기 루트에는 배경·테두리를 두지 않는다.
-->
<div class="flex flex-col">
  {#if title}
    <header
      class="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0"
    >
      <h3 class="text-sm font-semibold text-gray-900">{title}</h3>
      {#if aiConfidence !== null}
        <span class="text-label-02-normal-regular text-gray-500"
          >AI {fmtConfidence(aiConfidence)}</span
        >
      {/if}
    </header>
  {/if}

  <div class="min-w-0 overflow-x-hidden">
    <!-- Coding Table — 5 groups. 여기가 **임상가의 칸**이다. -->
    <!-- overflow-hidden: 안쪽 라벨 셀의 각진 배경이 둥근 테두리 밖으로 나가는 걸 막는다 -->
    <div
      class="bg-white"
    >
      <!--
        Group: DQ — **위치 부호(Loc)는 여기 없다.**

        위치는 팝오버 상단의 기록 표에서 고친다(피드백 v2-3). 예전엔 여기에도
        `LocationPicker`가 있었는데, 채점 화면에서 기록 표가 열리면서 **같은
        값을 고치는 컨트롤이 한 팝오버에 둘**이 됐다. 하나를 바꾸면 다른 하나가
        따라오긴 하지만, 임상가는 둘이 다른 것을 뜻한다고 읽는다.

        `local.location`은 그대로 유지된다 — `areaCode` prop에서 시드되어
        확정 코딩에 함께 저장된다. 편집 창구만 하나로 줄인 것이다.
      -->
      <!--
        ⚠️ 첫 행에도 `border-t`가 있다. 이 표는 **기록 표(반응·질문·위치·방향)
        바로 아래에 이어 붙으므로**, 첫 행에 선이 없으면 위 행과 한 칸처럼
        붙어 버린다. 자기 상자를 갖고 있던 시절엔 필요 없던 선이다.
      -->
      <div class="flex border-t border-gray-200">
        <div
          class="w-14 shrink-0 bg-gray-50 px-2 py-2 text-gray-600 border-r border-gray-200 flex items-center text-label-01-normal-medium"
        >
          발달질
        </div>
        <div
          class="flex-1 min-w-0 px-2 py-1.5 flex items-center gap-3 flex-wrap"
        >
          <div class="flex items-center gap-1.5">
            <span
              class="text-label-02-normal-regular text-gray-400 uppercase tracking-wide"
              >DQ</span
            >
            <button
              bind:this={triggerEls.dq}
              onclick={() =>
                !readonly &&
                (activeDropdown = activeDropdown === 'dq' ? null : 'dq')}
              disabled={readonly}
              class="{CONTROL_SINGLE} {local.dq
                ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium'
                : 'border-gray-200 text-gray-400 hover:border-gray-300'}"
            >
              {local.dq || '-'}
            </button>
            {#if activeDropdown === 'dq' && triggerEls.dq}
              <TagDropdown
                anchor={triggerEls.dq}
                options={CODING_OPTIONS.dq}
                selected={local.dq}
                isMulti={false}
                onSelect={(v) => handleSingleSelect('dq', v)}
                onClose={() => (activeDropdown = null)}
              />
            {/if}
          </div>
        </div>
      </div>

      <!-- Group: 결정인 (determinants) -->
      <div class="flex border-t border-gray-200">
        <div
          class="w-14 shrink-0 bg-gray-50 px-2 py-2 text-gray-600 border-r border-gray-200 flex items-center text-label-01-normal-medium"
        >
          결정인
        </div>
        <div
          class="flex-1 min-w-0 px-2 py-1.5 flex items-center gap-1.5 flex-wrap"
        >
          <span
            class="text-label-02-normal-regular text-gray-400 uppercase tracking-wide"
            >Det</span
          >
          <div class="flex-1 min-w-0">
            <button
              bind:this={triggerEls.determinants}
              onclick={() =>
                !readonly &&
                (activeDropdown =
                  activeDropdown === 'determinants' ? null : 'determinants')}
              disabled={readonly}
              class={CONTROL_MULTI}
            >
              {#if local.determinants.length > 0}
                {#each local.determinants as v (v)}
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-label-02-normal-medium bg-orange-100 text-orange-800"
                    >{v}</span
                  >
                {/each}
              {:else}
                <span class="text-label-02-normal-regular text-gray-400"
                  >선택</span
                >
              {/if}
            </button>
            {#if activeDropdown === 'determinants' && triggerEls.determinants}
              <TagDropdown
                anchor={triggerEls.determinants}
                options={CODING_OPTIONS.determinants}
                selected={local.determinants}
                isMulti={true}
                onSelect={(v) => handleMultiToggle('determinants', v)}
                onClose={() => (activeDropdown = null)}
              />
            {/if}
          </div>
        </div>
      </div>

      <!-- Group: 형태질 (fq, pair, popular) -->
      <div class="flex border-t border-gray-200">
        <div
          class="w-14 shrink-0 bg-gray-50 px-2 py-2 text-gray-600 border-r border-gray-200 flex items-center text-label-01-normal-medium"
        >
          형태질
        </div>
        <div
          class="flex-1 min-w-0 px-2 py-1.5 flex items-center gap-3 flex-wrap"
        >
          <div class="flex items-center gap-1.5">
            <span
              class="text-label-02-normal-regular text-gray-400 uppercase tracking-wide"
              >FQ</span
            >
            <button
              bind:this={triggerEls.fq}
              onclick={() =>
                !readonly &&
                (activeDropdown = activeDropdown === 'fq' ? null : 'fq')}
              disabled={readonly}
              class="{CONTROL_SINGLE} {local.fq
                ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium'
                : 'border-gray-200 text-gray-400 hover:border-gray-300'}"
            >
              {local.fq || '-'}
            </button>
            {#if activeDropdown === 'fq' && triggerEls.fq}
              <TagDropdown
                anchor={triggerEls.fq}
                options={CODING_OPTIONS.fq}
                selected={local.fq}
                isMulti={false}
                onSelect={(v) => handleSingleSelect('fq', v)}
                onClose={() => (activeDropdown = null)}
              />
            {/if}
          </div>
          <!--
            쌍반응 — **세 값이다.** P와 같은 규칙으로 순환한다.
              ·   미확인 — 아직 판단하지 않았다 (기본값)
              (2) 쌍반응으로 확정
              ✕   쌍반응이 아님으로 확정

            예전엔 켜고 끄는 두 값이었고 기본값이 "아님"이었다. (2)는
            자아중심성 지표 3r+(2)/R에 직접 들어가고 그 값이 S-CON·DEPI로
            흘러가므로, 검토하지 않은 반응이 "쌍 아님"으로 집계되면 지표가
            조용히 낮아진다.
          -->
          <div class="flex items-center gap-1.5">
            <span
              class="text-label-02-normal-regular text-gray-400 uppercase tracking-wide"
              >(2)</span
            >
            <button
              onclick={() => !readonly && cyclePair()}
              disabled={readonly}
              title={local.pair === null
                ? PAIR_LABEL.unset
                : local.pair
                  ? PAIR_LABEL.yes
                  : PAIR_LABEL.no}
              aria-label="쌍반응 — {local.pair === null
                ? '미확인'
                : local.pair
                  ? '쌍반응'
                  : '쌍반응 아님'}"
              class="{CONTROL_TOGGLE} {local.pair === null
                ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                : local.pair
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-300 text-gray-600 hover:bg-gray-400'}"
            >
              {local.pair === null ? '·' : local.pair ? '(2)' : '✕'}
            </button>
          </div>
          <!--
            평범반응 — **세 값이다** (§13 E-2). 눌러서 순환한다.
              ·  미확인 — 아직 판단하지 않았다 (기본값)
              P  평범반응으로 확정
              ✕  평범반응이 아님으로 확정

            예전엔 켜고 끄는 체크박스였고 기본값이 "아님"이었다. 그래서 표를
            보지도 않고 넘어간 반응과 보고서 아니라고 판단한 반응이 화면상
            같았다 — P는 Exner 표의 함수이지 인상이 아니므로, 확인 여부가
            남아야 검토가 성립한다.
          -->
          <div class="flex items-center gap-1.5">
            <span
              class="text-label-02-normal-regular text-gray-400 uppercase tracking-wide"
              >P</span
            >
            <button
              onclick={() => !readonly && cyclePopular()}
              disabled={readonly}
              title={local.popular === null
                ? POPULAR_LABEL.unset
                : local.popular
                  ? POPULAR_LABEL.yes
                  : POPULAR_LABEL.no}
              aria-label="평범반응 — {local.popular === null
                ? '미확인'
                : local.popular
                  ? '평범반응'
                  : '평범반응 아님'}"
              class="{CONTROL_TOGGLE} {local.popular === null
                ? 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                : local.popular
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-300 text-gray-600 hover:bg-gray-400'}"
            >
              {local.popular === null ? '·' : local.popular ? 'P' : '✕'}
            </button>
            <!--
              이 카드·영역이 평범반응 자리라는 **알림**이다. 자동으로 켜지
              않는다 — 기준에 "무엇으로 봤는지"가 걸려 있어 영역이 맞아도
              내용이 다르면 P가 아니다(§14-4와 같은 형태: 제안 → 사람 확인).
            -->
            {#if pCandidates.length > 0 && local.popular === null}
              <Tooltip
                text={pCandidates
                  .map((p) => `${p.content} — ${p.criteria}`)
                  .join('\n\n')}
              >
                <span
                  class="inline-flex h-7 items-center gap-1 rounded bg-cyan-50 px-1.5 text-caption-01-normal-medium text-cyan-700"
                >
                  P 자리: {pCandidates.map((p) => p.content).join(' · ')}
                </span>
              </Tooltip>
            {/if}
          </div>
        </div>
      </div>

      <!-- Group: 내용 (contents) -->
      <div class="flex border-t border-gray-200">
        <div
          class="w-14 shrink-0 bg-gray-50 px-2 py-2 text-gray-600 border-r border-gray-200 flex items-center text-label-01-normal-medium"
        >
          내용
        </div>
        <div
          class="flex-1 min-w-0 px-2 py-1.5 flex items-center gap-1.5 flex-wrap"
        >
          <span
            class="text-label-02-normal-regular text-gray-400 uppercase tracking-wide"
            >Cont</span
          >
          <div class="flex-1 min-w-0">
            <button
              bind:this={triggerEls.contents}
              onclick={() =>
                !readonly &&
                (activeDropdown =
                  activeDropdown === 'contents' ? null : 'contents')}
              disabled={readonly}
              class={CONTROL_MULTI}
            >
              {#if local.contents.length > 0}
                {#each local.contents as v (v)}
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-label-02-normal-medium bg-indigo-100 text-indigo-700"
                    >{v}</span
                  >
                {/each}
              {:else}
                <span class="text-label-02-normal-regular text-gray-400"
                  >선택</span
                >
              {/if}
            </button>
            {#if activeDropdown === 'contents' && triggerEls.contents}
              <TagDropdown
                anchor={triggerEls.contents}
                options={CODING_OPTIONS.contents}
                selected={local.contents}
                isMulti={true}
                onSelect={(v) => handleMultiToggle('contents', v)}
                onClose={() => (activeDropdown = null)}
              />
            {/if}
          </div>
        </div>
      </div>

      <!-- Group: 특수 (zScore, specialScores) -->
      <div class="flex border-t border-gray-200">
        <div
          class="w-14 shrink-0 bg-gray-50 px-2 py-2 text-gray-600 border-r border-gray-200 flex items-center text-label-01-normal-medium"
        >
          특수
        </div>
        <!--
          Z와 Spc는 **항상 두 줄로** 쌓는다(`flex-col`).

          한 줄에 두면 Z 옆에 네 값(`ZW 1.0 · ZA 4.0 · …`)이 붙는 순간 폭이
          모자라 `flex-wrap`으로 넘어가고, 특수점수 칩이 늘면 또 넘어간다.
          줄이 접혔다 펴졌다 하면 표가 들썩인다 — 자리를 고정하면 눈이 값만 읽는다.
        -->
        <div class="flex min-w-0 flex-1 flex-col gap-1.5 px-2 py-1.5">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span
              class="text-label-02-normal-regular text-gray-400 uppercase tracking-wide"
              >Z</span
            >
            <button
              bind:this={triggerEls.zScore}
              onclick={() =>
                !readonly &&
                (activeDropdown =
                  activeDropdown === 'zScore' ? null : 'zScore')}
              disabled={readonly}
              class="{CONTROL_SINGLE} {local.zScore
                ? 'border-primary-400 bg-primary-50 text-primary-700 font-medium'
                : 'border-gray-200 text-gray-400 hover:border-gray-300'}"
            >
              {local.zScore || '-'}
            </button>
            {#if activeDropdown === 'zScore' && triggerEls.zScore}
              <TagDropdown
                anchor={triggerEls.zScore}
                options={CODING_OPTIONS.zScore}
                selected={local.zScore}
                isMulti={false}
                onSelect={(v) => handleSingleSelect('zScore', v)}
                onClose={() => (activeDropdown = null)}
              />
            {/if}
            <!--
              **수치를 보여준다.** Z부호는 카드마다 값이 달라서, 부호만으로는
              몇 점을 주는지 알 수 없다(카드 I의 ZW=1.0, IX의 ZW=5.5).
              채점지에도 값이 적히므로(`W+ FMa.FCo (2) A,Ls P 4.5`) 화면과
              종이가 같은 것을 보여주게 된다.

              고르기 전에는 네 부호의 값을 나란히 띄운다 — 워크북 94쪽의
              "두 기준을 함께 만족하면 더 높은 값을 준다"를 적용하려면
              무엇이 높은지 보여야 한다.
            -->
            {#if zSelectedValue}
              <span
                class="shrink-0 text-label-01-normal-bold text-primary-700 tabular-nums"
              >
                {zSelectedValue}
              </span>
            {:else if zCardValues}
              <span
                class="shrink-0 text-label-02-normal-regular text-gray-400 tabular-nums"
                title="이 카드의 조직활동 Z값 (워크북 표 6-1)"
              >
                {CODING_OPTIONS.zScore
                  .map((c) => `${c} ${zCardValues[c]?.toFixed(1) ?? '-'}`)
                  .join(' · ')}
              </span>
            {/if}
          </div>
          <div class="flex items-center gap-1.5 flex-1 min-w-35">
            <span
              class="text-label-02-normal-regular text-gray-400 uppercase tracking-wide"
              >Spc</span
            >
            <div class="flex-1 min-w-0">
              <button
                bind:this={triggerEls.specialScores}
                onclick={() =>
                  !readonly &&
                  (activeDropdown =
                    activeDropdown === 'specialScores'
                      ? null
                      : 'specialScores')}
                disabled={readonly}
                class={CONTROL_MULTI}
              >
                {#if local.specialScores.length > 0}
                  {#each local.specialScores as v (v)}
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-label-02-normal-medium bg-red-100 text-red-700"
                      >{v}</span
                    >
                  {/each}
                {:else}
                  <span class="text-label-02-normal-regular text-gray-400"
                    >선택</span
                  >
                {/if}
              </button>
              {#if activeDropdown === 'specialScores' && triggerEls.specialScores}
                <TagDropdown
                  anchor={triggerEls.specialScores}
                  options={CODING_OPTIONS.specialScores}
                  selected={local.specialScores}
                  isMulti={true}
                  onSelect={(v) => handleMultiToggle('specialScores', v)}
                  onClose={() => (activeDropdown = null)}
                />
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI 근거 -->
    <!-- {#if aiReasoning}
      <div class="mt-3 bg-gray-50 rounded-lg p-2.5">
        <p class="text-caption-01-normal-semibold uppercase text-gray-500 mb-1">AI 채점 근거</p>
        <p class="text-label-02-normal-regular text-gray-700 whitespace-pre-line leading-relaxed">{aiReasoning}</p>
      </div>
    {/if} -->

  </div>
</div>
