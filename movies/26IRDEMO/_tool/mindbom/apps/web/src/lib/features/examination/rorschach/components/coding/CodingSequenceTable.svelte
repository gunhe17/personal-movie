<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte'
  import { indexToCard, responseColor, zValue } from '../../constants'
  import type { ServerResponseDetail } from '../../actions'

  interface Props {
    /** 프로토콜 전체 반응 — 카드를 바꿔도 이 표는 바뀌지 않는다 */
    responses: ServerResponseDetail[]
    selectedId: string | null
    /** 행 클릭 — 그 반응의 카드로 옮기고 채점을 연다 */
    onSelect: (id: string) => void
    /** 일괄 AI 채점. 확정된 검사에서는 넘기지 않는다 */
    onScoreAll?: () => void
    isBatchScoring?: boolean
    /**
     * AI 채점을 걸 수 있는 반응 수 — 0이면 버튼을 잠근다.
     *
     * 판정은 부르는 쪽이 `canAiScore`로 한다. 표가 자체 규칙을 두면 팝오버의
     * 단일 채점 버튼과 갈려, 같은 반응인데 한쪽만 눌리는 상태가 생긴다.
     */
    scorableCount?: number
    /**
     * 채점 완료 수 — 푸터·확정 게이트와 **같은 규칙**으로 센 값을 받는다
     * (`Review.isCoded`). 표가 자체로 세면 낡은 채점을 완료로 쳐서 한 화면에
     * 두 숫자가 뜬다.
     */
    codedCount?: number
    /** AI 초안을 확정값으로 채택. 확정된 검사에서는 넘기지 않는다 */
    onAdoptAi?: (id: string) => void
    /** 지금 채택 중인 반응 — 그 행의 버튼만 잠근다 */
    adoptingId?: string | null
  }

  let {
    responses,
    selectedId,
    onSelect,
    onScoreAll,
    isBatchScoring = false,
    scorableCount = 0,
    codedCount: codedCountProp,
    onAdoptAi,
    adoptingId = null
  }: Props = $props()

  /**
   * **정식 반응만, 카드→반응번호 순.**
   *
   * 한계검증은 채점 대상이 아니다(§14-9). 계열 기록지는 R의 순서 그 자체가
   * 자료라(접근방식·카드별 반응수) 정렬 기준을 화면에서 만들지 않고
   * `response_no`를 그대로 따른다.
   */
  let rows = $derived(
    responses
      .filter((r) => r.is_formal)
      .sort(
        (a, b) =>
          a.card_no - b.card_no || (a.response_no ?? 0) - (b.response_no ?? 0)
      )
  )

  /**
   * 채점 완료 수 — **부모가 세어 넘긴다.**
   *
   * ⚠️ 여기서 `final_coding !== null`로 직접 세면 안 된다. 그러면 낡은 채점
   * (`coding_stale`)을 완료로 치는데, 푸터의 진행률과 확정 게이트는 낡음을
   * 미완으로 센다(`Review.isCoded` ↔ 서버 `completion.response_coded`).
   * 한 화면에 `확인됨 11/12`(푸터)와 `채점 12/12`(표)가 동시에 뜨고,
   * 임상가는 "다 했는데 왜 확정이 안 되지"에 갇힌다 — 실제로 그랬다.
   *
   * 세는 규칙은 한 곳(`isCoded`)에만 둔다.
   */
  let codedCount = $derived(codedCountProp ?? rows.length)

  /** 카드 로마숫자는 그 카드의 **첫 행에만** 적는다 — 종이 기록지의 서식이다 */
  function isCardHead(i: number): boolean {
    return i === 0 || rows[i - 1].card_no !== rows[i].card_no
  }

  /**
   * 결정인은 **마침표로 잇는다** (`M.FC`). 혼합반응(Blend)의 표기이며,
   * 쉼표로 이으면 내용(Content)과 구분이 안 된다.
   */
  const joinDeterminants = (v: string[] | null | undefined) =>
    (v ?? []).join('.')

  /** 내용·특수점수는 쉼표 */
  const joinComma = (v: string[] | null | undefined) => (v ?? []).join(', ')

  /**
   * 평범반응 — **세 값을 세 가지로 그린다** (`RorschachCoding.popular` 주석).
   *
   * `null`(아직 안 봤다)을 빈칸으로 그리면 "표를 보고 P가 아니라고 판단했다"와
   * 같아진다. 모름이 값으로 둔갑하는 자리라 옅은 물음표로 남긴다.
   */
  function popularCell(p: boolean | null | undefined) {
    if (p === true) return { text: 'P', unknown: false }
    if (p === false) return { text: '', unknown: false }
    return { text: '?', unknown: true }
  }

  /**
   * 쌍반응 — 평범반응과 **같은 규칙**으로 그린다(`popularCell`).
   *
   * (2)는 자아중심성 지표 3r+(2)/R에 직접 들어가므로, 안 본 반응을 빈칸으로
   * 그리면 "쌍이 아니라고 판단했다"와 구분이 사라진다. 같은 문제를 두 칸에서
   * 다르게 그리면 임상가가 규칙을 두 번 배워야 한다.
   */
  function pairCell(p: boolean | null | undefined) {
    if (p === true) return { text: '2', unknown: false }
    if (p === false) return { text: '', unknown: false }
    return { text: '?', unknown: true }
  }
</script>

<!--
  계열 기록지 (Sequence of Scores)

  **읽기 전용 파생 뷰다.** 편집은 팝오버 한 곳에서만 일어나고 이 표는 저장된
  `final_coding`만 그린다 — 편집 중인 값이 여기 비치면 같은 반응의 상태가 두
  곳에 생겨(피드백 v2 6번 A안의 걸림돌) 어느 쪽이 참인지 화면이 답을 못 한다.
  저장돼야 표에 나타나는 것이 곧 "저장됐다"의 신호가 된다.
-->
<div class="flex h-full min-h-0 flex-col bg-white">
  <!--
    툴바 — 좌측 `ResponseToolbar`와 **같은 높이·같은 테두리**다. 두 컬럼의
    첫 줄이 어긋나면 화면이 두 장으로 갈라져 보인다.

    `min-h-11`(44px = 좌측 툴바의 `py-2` + 칩 `h-7`)을 못박는 이유: 확정된
    검사에서는 일괄채점 버튼을 안 그리는데, 그러면 이 줄만 글자 높이로
    쪼그라들어 두 컬럼의 표 시작선이 어긋난다.
  -->
  <div
    class="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2"
  >
    <div class="flex min-w-0 items-center gap-2">
      <span class="shrink-0 text-xs font-medium text-gray-700">계열 기록지</span>
      <span class="shrink-0 text-label-02-normal-regular tabular-nums text-gray-400">
        R {rows.length} · 채점 {codedCount}/{rows.length}
      </span>
    </div>

    {#if onScoreAll}
      <!--
        일괄채점은 **초안만 채운다** — `final_coding`은 서버도 건드리지 않아
        확정 게이트가 그대로 선다. 그래서 확정 버튼과 나란히 두지 않고
        표의 머리에 둔다: 여기서 하는 일은 확정이 아니라 밑그림이다.
      -->
      <button
        type="button"
        onclick={() => onScoreAll?.()}
        disabled={isBatchScoring || scorableCount === 0}
        title={scorableCount === 0
          ? 'AI 채점을 걸 수 있는 반응이 없습니다 — 반응 내용·질문 답변·위치가 있어야 합니다.'
          : `입력이 다 찬 ${scorableCount}건을 AI로 채점합니다.`}
        class="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 text-label-01-normal-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if isBatchScoring}
          <span
            class="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/40 border-t-white"
          ></span>
          채점 중…
        {:else}
          <Icon name="auto_awesome" size="sm" />
          AI 일괄채점
        {/if}
      </button>
    {/if}
  </div>

  <div class="min-h-0 flex-1 overflow-auto">
    <!--
      ⚠️ **`border-collapse`를 쓰면 안 된다.** 헤더가 `sticky`인데 표가
      collapse 모드면 브라우저가 헤더 셀의 테두리를 **아예 그리지 않는다**
      (collapse에서 테두리는 셀이 아니라 표의 것이 되는데, sticky로 떠 있는
      행은 그 테두리를 들고 가지 못한다). 색을 아무리 진하게 해도 안 보인다.

      separate 모드에서는 테두리가 셀의 것이라 따라온다. 대신 **행(`<tr>`)에
      건 테두리는 그려지지 않으므로** 가로선도 셀에 걸어야 한다 — 아래 두
      `<tr>`의 `[&>*]:border-b`가 그것이다.
    -->
    <table class="w-full border-separate border-spacing-0">
      <!--
        헤더는 §4-2 Table의 렌더 클래스를 따른다 — 회색 반투명 바탕에
        blur, `body-02-normal-medium text-gray-600`. 앱의 다른 표와 같은
        머리를 얹어야 이 화면만 다른 물건처럼 보이지 않는다.
      -->
      <thead class="sticky top-0 z-10 bg-gray-50/80 backdrop-blur-sm">
        <!--
          칸마다 세로 구분선 — 부호가 한두 글자라 가로 여백만으로는 어느 칸
          값인지 눈으로 못 짚는다. 종이 기록지가 괘선을 긋는 이유가 그거다.
          마지막 칸은 긋지 않는다(패널 오른쪽 끝에 선이 겹쳐 보인다).
        -->
        <!--
          머리쪽 괘선은 `gray-300`이다. 바탕이 `gray-50`이라 `gray-200`은
          바탕에 묻혀 선이 있는지도 모른다 — 열을 나누는 일을 못 한다.
        -->
        <tr
          class="h-11 text-body-02-normal-medium text-gray-600 *:whitespace-nowrap *:border-b *:border-gray-300 [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-gray-300"
        >
          <!--
            열 폭은 **헤더 라벨과 실제 값 중 넓은 쪽**에 맞춘다. 라벨이
            줄바꿈되면 헤더만 두 줄이 되어 표 머리가 내려앉는다
            (`whitespace-nowrap`으로 줄바꿈 자체를 막고 폭으로 해결한다).
            값 기준: Loc `Dd99` · 결정인 `CF.YF` · Z `ZW 1.0` · 특수 `INCOM1`.
          -->
          <th class="w-16 pl-4 pr-3 text-left font-medium">카드</th>
          <th class="w-14 px-3 text-right font-medium">No</th>
          <th class="w-18 px-3 text-left font-medium">Loc</th>
          <th class="w-16 px-3 text-left font-medium">DQ</th>
          <th class="w-24 px-3 text-left font-medium">결정인</th>
          <th class="w-12 px-2 text-center font-medium">(2)</th>
          <th class="w-20 px-3 text-left font-medium">내용</th>
          <th class="w-10 px-2 text-center font-medium">P</th>
          <th class="w-20 px-3 text-right font-medium">Z</th>
          <th class="px-3 text-left font-medium">특수점수</th>
          <!--
            액션 열 — 폭을 고정해 버튼이 생겨도 표가 흔들리지 않게 한다.

            폭은 **가장 넓은 내용물**('재검토' 배지)에 맞춘다. 좁으면 배지가
            줄바꿈되어 그 행만 두 줄이 되고, 행 높이가 고정(`h-12`)이라
            글자가 잘린다.

            내용은 **가운데 정렬**이다. 오른쪽에 붙이면 배지가 없는 행(대부분)과
            있는 행 사이에 빈 구역이 크게 남아 표 끝이 비어 보인다. 가운데면
            남는 여백이 양쪽으로 갈려 그 자체가 우측 인셋 노릇을 한다.
          -->
          <th class="w-24 px-3 text-center"
            ><span class="sr-only">제안값 확정</span></th
          >
        </tr>
      </thead>
      <!--
        부호도 앱의 본문 서체로 쓴다. 등폭 서체가 문서 느낌을 내긴 하지만
        이 앱 어디에도 없는 언어라 표만 따로 노는 원인이 된다. 자릿수
        정렬은 `tabular-nums`가 맡는다.
      -->
      <tbody class="text-body-02-normal-regular tabular-nums">
        {#each rows as r, i (r.id)}
          <!--
            **표에 그리는 값은 확정값이고, 없으면 AI 초안이다.**

            초안까지 그리는 이유: 확정된 것만 보이면 표가 계속 비어 있어
            계열(접근방식·연쇄된 특수점수)을 읽을 수가 없다. 채점을 다 끝낸
            뒤에야 표가 쓸모를 갖는데, 그때는 이미 볼 필요가 없다.

            대신 **둘은 반드시 구별돼야 한다.** 초안이 확정값처럼 보이면
            임상가가 안 본 값을 본 것으로 착각한다 — CDSS에서 제일 위험한
            혼동이다. 초안 행은 글자를 흐리게(gray-400) 하고 우측에 확정
            버튼을 세워, 값이 아직 **제안**임을 자리로도 말한다.
          -->
          {@const isDraft = r.final_coding === null && r.ai_coding !== null}
          {@const c = r.final_coding ?? r.ai_coding}
          {@const selected = r.id === selectedId}
          {@const head = isCardHead(i)}
          {@const pop = popularCell(c?.popular)}
          {@const pr = pairCell(c?.pair)}
          <!--
            **낡은 채점** — 실시로 돌아가 원자료를 고친 뒤 다시 저장하지 않은
            반응. 값은 그대로 있지만 근거가 없어졌으므로 확정이 막힌다
            (`isCoded`). 지우지 않고 보여주는 이유는 임상가가 옛 값과 새
            원자료를 견줘 유지할지 고칠지 고르게 하려는 것이다.
          -->
          {@const isStale = r.coding_stale && r.final_coding !== null}
          <!-- 초안은 흐리게, 낡은 값은 amber, 확정값은 본문색. -->
          {@const tone = isStale
            ? 'text-amber-700'
            : isDraft
              ? 'text-gray-400'
              : 'text-gray-800'}
          <!--
            위치가 두 곳에 산다(§14-7 · 피드백 v2 b). 서버가 반응에서
            파생시키므로 평소엔 같지만, 갈리면 **채점 집계가 읽는 쪽은
            `coding.location`**이라 조용히 빠진다. 표가 그 어긋남을 드러낸다.
          -->
          {@const locMismatch =
            c !== null && (c.location ?? null) !== (r.area_code ?? null)}
          <!--
            행 전체가 클릭 대상이다 — 표에서 반응을 고르면 그 카드로 옮겨
            채점이 열린다. 마우스만 되면 키보드 사용자가 표를 못 쓰므로
            `DataTable`과 **같은 방식**으로 role·tabindex·Enter/Space를 준다.
          -->
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <tr
            role="button"
            tabindex={0}
            aria-label="카드 {indexToCard(r.card_no)} {r.response_no ??
              ''}번 반응"
            onclick={() => onSelect(r.id)}
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(r.id)
              }
            }}
            class="h-12 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 *:border-b *:border-gray-100 [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-r-gray-100
              {head && i > 0 ? '*:border-t *:border-t-gray-300' : ''}
              {selected
                ? 'bg-primary-50'
                : isStale
                  ? 'bg-amber-50/60 hover:bg-amber-50'
                  : 'hover:bg-gray-50'}"
          >
            <!-- 카드 열: 로마숫자 + 선택 반응의 색 바 -->
            <td class="relative pl-6 pr-3 text-left text-gray-800">
              {#if selected}
                <span
                  class="absolute inset-y-0 left-0 w-1 rounded-r"
                  style="background: {responseColor(r.response_no)};"
                ></span>
              {/if}
              {#if head}{indexToCard(r.card_no)}{/if}
            </td>
            <td class="px-3 text-right text-gray-500">{r.response_no ?? '·'}</td
            >

            {#if c === null}
              <!--
                미채점 — 칸을 비워 둔다. 종이 기록지에서도 빈 줄이 "아직"이다.
                여기에 '—'나 기본값을 채우면 채점한 것과 구별이 사라진다.
              -->
              <!--
                colspan은 **부호 칸 8개**(Loc·DQ·결정인·(2)·내용·P·Z·특수점수)다.
                액션 칸은 이 분기 밖에서 따로 렌더되므로 여기 세면 안 된다 —
                그러면 이 행만 12칸이 되어 표 전체가 한 칸 넓어지고, 오른쪽
                끝에 아무것도 없는 빈 열이 생긴다.
              -->
              <td colspan="8" class="pl-3 pr-6">
                <span class="text-body-03-normal-regular text-gray-400"
                  >미채점</span
                >
              </td>
            {:else}
              <td
                class="px-3 {tone} {locMismatch
                  ? 'bg-amber-50 font-semibold text-amber-700'
                  : ''}"
                title={locMismatch
                  ? `위치가 어긋납니다 — 기록 ${r.area_code ?? '없음'} / 채점 ${c.location ?? '없음'}`
                  : undefined}
              >
                {c.location ?? ''}
              </td>
              <td class="px-3 {tone}">{c.dq ?? ''}</td>
              <td class="px-3 {tone}">{joinDeterminants(c.determinants)}</td>
              <td
                class="px-2 text-center {pr.unknown ? 'text-gray-300' : tone}"
              >
                {pr.text}
              </td>
              <td class="px-3 {tone}">{joinComma(c.contents)}</td>
              <td
                class="px-2 text-center {pop.unknown
                  ? 'text-gray-300'
                  : tone}"
              >
                {pop.text}
              </td>
              <!--
                Z는 **부호와 수치를 함께** 적는다 (서버 DTO를 그대로 읽는다 —
                표는 파생 뷰라 변환을 끼울 이유가 없다).

                저장되는 값은 부호(`ZW`)뿐인데 그 수치는 카드마다 다르다 —
                카드 I의 ZW은 1.0, 카드 IX의 ZW은 5.5다(`Z_VALUES`). 합산되는
                것은 수치이므로 종이 기록지도 수치를 적는다. 부호만 보이면
                Zf·Zsum이 맞는지 표를 보고 가늠할 수 없다.
              -->
              <td class="whitespace-nowrap px-3 text-right {tone}">
                {#if c.z_score}
                  <span class="text-body-03-normal-regular text-gray-400"
                    >{c.z_score}</span
                  >
                  <span class="ml-1">{zValue(r.card_no, c.z_score) ?? '?'}</span
                  >
                {/if}
              </td>
              <td class="px-3 {tone}">{joinComma(c.special_scores)}</td>
            {/if}

            <!--
              제안값 확정 — **AI 초안을 그대로 확정값으로 옮긴다.**

              `stopPropagation`이 필수다. 이 셀은 행 클릭(=그 카드로 이동)
              안에 있어, 막지 않으면 확정과 동시에 화면이 다른 카드로 뛴다.

              버튼 자리는 확정된 행에서도 비워 두지 않고 '확정' 표시를 둔다 —
              나타났다 사라지면 행 높이가 흔들리고, 무엇보다 **누가 확정했는지**
              (사람인가 아직 초안인가)가 이 열 하나로 읽혀야 한다.
            -->
            <td class="whitespace-nowrap px-3 text-center">
              {#if isStale}
                <!--
                  낡은 행에는 확정 버튼을 두지 않는다. 여기서 한 번 눌러
                  되살릴 수 있으면 **바뀐 원자료를 안 보고 확정하는 길**이
                  생긴다 — 낡음 표시를 세운 이유가 그것을 막으려는 것이다.
                  팝오버를 열어(행을 누르면 열린다) 값을 보고 저장해야 풀린다.
                -->
                <span
                  class="inline-flex h-7 items-center rounded-md bg-amber-100 px-2 text-label-02-normal-medium text-amber-800"
                  title="실시 기록이 바뀌었습니다. 채점을 다시 확인하고 저장해야 확정할 수 있습니다."
                >
                  재검토
                </span>
              {:else if isDraft && onAdoptAi}
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation()
                    onAdoptAi?.(r.id)
                  }}
                  disabled={adoptingId === r.id}
                  class="inline-flex h-7 items-center justify-center rounded-md border border-primary-200 bg-primary-50 px-2 text-label-02-normal-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {adoptingId === r.id ? '확정 중…' : '확정'}
                </button>
              {:else if r.final_coding !== null}
                <span class="text-body-03-normal-regular text-gray-400">확정</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if rows.length === 0}
      <div class="py-16 text-center text-body-01-reading-regular text-gray-400">
        기록된 반응이 없습니다.
      </div>
    {/if}
  </div>
</div>
