<script lang="ts">
  import type { RorschachCard } from '../../types'
  import type { CardStatus } from '../../actions'
  import { RORSCHACH_CARDS } from '../../constants'
  import { cardThumb } from '../../card-images'
  import Icon from '$components/ui/Icon.svelte'
  import ScrollStrip from '$components/ui/ScrollStrip.svelte'

  interface Props {
    activeCard: RorschachCard
    regionCounts: Record<RorschachCard, number>
    /** 카드별 모든 영역 채점 완료 여부. 미제공 시 false 처리. */
    allCodedByCard?: Partial<Record<RorschachCard, boolean>>
    /** 카드별 AI 채점이 진행 중인 영역이 있는지 — 깜박이는 점 표시. 미제공 시 false 처리. */
    aiScoringByCard?: Partial<Record<RorschachCard, boolean>>
    /**
     * 칩 아래 줄의 셈 단위 이름 — 기본은 기존 채점 화면의 '영역'.
     * 자유반응 화면은 '반응'을 센다(관계 역전 이후 셈 단위가 반응이다).
     */
    countLabel?: string
    /**
     * 카드 실시 상태 — 거부는 반응이 0개라 개수만으로는 미실시와 구분되지 않는다.
     * 미제공이면 표시하지 않는다(기존 채점 화면 동작 그대로).
     */
    statusByCard?: Partial<Record<RorschachCard, CardStatus>>
    onCardChange: (card: RorschachCard) => void
  }

  let {
    activeCard,
    regionCounts,
    allCodedByCard = {},
    aiScoringByCard = {},
    countLabel = '영역',
    statusByCard = {},
    onCardChange
  }: Props = $props()
</script>

<ScrollStrip
  activeKey={activeCard}
  gapClass="gap-2"
  class="border-b border-gray-200 bg-white px-4 py-2"
>
  {#each RORSCHACH_CARDS as card (card)}
    {@const isActive = card === activeCard}
    {@const count = regionCounts[card] ?? 0}
    {@const allCoded = count > 0 && (allCodedByCard[card] ?? false)}
    {@const aiScoring = aiScoringByCard[card] ?? false}
    {@const rejected = statusByCard[card] === 'rejected'}
    <!--
      폭 고정 — '영역 N' 줄의 유무로 칩 폭이 갈리면 눈금이 안 맞아 보인다.
      활성 표시는 HTP DrawingTabs와 같은 ring — 면 색만으로는 어느 칩이
      선택됐는지 훑어볼 때 잘 안 잡힌다.
    -->
    <button
      onclick={() => onCardChange(card)}
      data-strip-key={card}
      class="relative flex w-36 shrink-0 items-center gap-2 rounded-lg border p-1.5 pr-3 text-sm font-medium whitespace-nowrap transition-all
        {isActive
        ? 'border-primary-200 bg-primary-50 text-primary-700 ring-2 ring-primary-500 ring-offset-2'
        : 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
    >
      <!--
        썸네일 — 번호만으로는 "지금 몇 번이었지"가 헷갈린다.
        높이는 HTP DrawingTabs(h-14=56)에 맞췄다 — 두 검사의 그림/카드 선택
        칩이 같은 자리·같은 역할이라 크기가 갈리면 어색하다.

        🔴 폭은 정사각이 아니라 w-16(64)이다. 원본 4000x2250에서 잉크가 가장
           넓은 카드 X는 x 740~3276(2536px)을 차지하는데, 정사각으로 자르면
           가운데 2250px만 남아 **좌우가 잘린다**. 카드 X는 좌우로 퍼진 게
           특징이라 그게 깎이면 다른 그림처럼 보인다.
           64/56 = 1.14 비율이면 원본 2571px이 남아 10장 모두 안 잘린다.
           (카드 10장의 잉크 bbox를 실측해 정한 값 — 눈대중이 아니다)
        object-cover — contain으로 16:9를 통째로 넣으면 잉크가 절반 크기로
        쪼그라든다. cover로 여백만 잘라내야 잉크가 프레임을 채운다.
      -->
      <div
        class="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white {isActive
          ? 'border-primary-200'
          : 'border-gray-300'}"
      >
        <!-- 썸네일(384px) — 원본 4000px을 여기 쓰면 탭 전환이 눈에 띄게 느려진다 -->
        <img
          src={cardThumb(card)}
          alt=""
          loading="lazy"
          decoding="async"
          width="64"
          height="56"
          class="h-full w-full object-cover"
        />
      </div>
      <!--
        라벨·개수를 세로로 쌓는다(HTP DrawingTabs와 같은 형태).
        썸네일이 커진 만큼 가로로 늘어놓으면 칩 10개가 1440 화면에서
        가로 스크롤을 만든다 — 세로로 쌓으면 칩당 ~40px이 줄어든다.
      -->
      <span class="flex flex-col items-start gap-0.5 leading-tight">
        <span>카드 {card}</span>
        {#if rejected}
          <!-- 거부는 반응이 0개다 — 개수만으로는 미실시와 구분되지 않아
               따로 표시한다. 둘을 같게 보이면 R 판정에서 사실이 어긋난다. -->
          <span
            class="flex items-center gap-0.5 text-caption-01-normal-medium text-orange-600"
          >
            <Icon name="block" size="xs" />
            거부
          </span>
        {:else if count > 0}
          <!-- 채점이 다 끝난 카드는 체크로 — 숫자만으로는 '몇 개 있다'와
               '다 됐다'가 구분되지 않는다 -->
          <span
            class="flex items-center gap-0.5 text-caption-01-normal-medium {allCoded
              ? 'text-green-700'
              : isActive
                ? 'text-primary-600'
                : 'text-gray-400'}"
          >
            {#if allCoded}
              <Icon name="check_circle" size="xs" />
            {/if}
            {countLabel} {count}
          </span>
        {/if}
      </span>
      {#if aiScoring}
        <span
          aria-hidden="true"
          title="AI 분석 진행 중"
          class="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-blue-500 ring-2 ring-white animate-pulse"
        ></span>
      {/if}
    </button>
  {/each}
</ScrollStrip>
