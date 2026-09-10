<script lang="ts">
  /**
   * 사이드바 '검사자료' 탭의 자료 목록.
   *
   * 검사별 섹션(헤더 + 자료 그리드)을 그리는 일만 한다. 첨부 여부 판정과
   * 말풍선 상태는 route가 갖는다 — 둘 다 에디터 인스턴스를 만져야 해서
   * (본문에서 블록을 찾고 지운다) 여기로 내리면 editor를 통째로 넘겨야 한다.
   * 그리는 것과 본문을 고치는 것의 경계를 그렇게 나눴다.
   */
  import { slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import ChartThumb from './ChartThumb.svelte'
  import ChevronToggle from '$lib/assets/icons/ChevronToggle.svelte'
  import { EXAM_STATUS_VISUAL } from '$lib/features/examination/common/exam-visual'
  import type { ExamStatus } from '$lib/features/examination/common/constants'
  import type { MaterialAsset, MaterialGroup } from './materials'

  interface Props {
    groups: MaterialGroup[]
    /** 자료를 아직 불러오는 중인지 — 빈 목록의 문구가 달라진다 */
    assetsLoading: boolean
    /** 접힌 검사 id 집합 */
    collapsed: Set<string>
    /** 이 자료가 본문에 이미 들어가 있는지 */
    isAttached: (id: string, src?: string) => boolean
    onToggleCollapse: (examId: string) => void
    onOpenResult: (g: MaterialGroup) => void
    /** 미첨부 자료 클릭 — 본문에 삽입 */
    onAssetClick: (g: MaterialGroup, a: MaterialAsset) => void
    /** 첨부된 자료 클릭 — 말풍선 열기 */
    onAttachedClick: (a: MaterialAsset, e: MouseEvent) => void
    /** 미첨부 자료 드래그 시작 — 본문에 끌어다 놓는 경로 (드롭은 편집기 쪽이 받는다) */
    onAssetDragStart?: (g: MaterialGroup, a: MaterialAsset) => void
  }

  let {
    groups,
    assetsLoading,
    collapsed,
    isAttached,
    onToggleCollapse,
    onOpenResult,
    onAssetClick,
    onAttachedClick,
    onAssetDragStart
  }: Props = $props()

  // 색은 이 화면 고유(어두운 배경의 경고 뱃지)라 라벨만 공통 표에서 가져온다.
  function statusLabel(s: string): string {
    return EXAM_STATUS_VISUAL[s as ExamStatus]?.label ?? s
  }

  /**
   * 접근성 — 동작 최소화를 켠 사용자에겐 전환을 걸지 않는다.
   * duration 0으로 떨어뜨려 전환 자체는 유지한다(ModalContainer와 같은 방식).
   * ChevronToggle은 자체 CSS로 이미 존중하고 있다.
   */
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const slideCfg = { duration: reduceMotion ? 0 : 200, easing: cubicOut }
</script>

{#if groups.length === 0}
  <p class="mt-4 text-center text-body-03-reading-regular text-chrome-fg-3">
    {assetsLoading ? '자료 불러오는 중…' : '연결된 검사가 없습니다.'}
  </p>
{:else}
  <!-- 안내는 목록 위에 — 아래에 두면 스크롤을 끝까지 내려야 보인다 -->
  <p class="mb-2 px-0.5 text-label-01-reading-regular text-center text-chrome-fg-3">
    자료를 누르면 본문 커서 위치에 첨부됩니다.
  </p>
  <div class="space-y-3">
    {#each groups as g (g.examId)}
      {@const isOpen = !collapsed.has(g.examId)}
      <section
        class="overflow-hidden rounded-xl bg-chrome-raised ring-1 ring-chrome-line"
      >
        <!-- ── 검사 헤더 ──
             이 탭의 목적은 '자료 첨부'이므로 검사 정보는 압축하고
             자료 그리드가 주인공이 되게 한다.
             단 한 줄에 다 넣으면 검사명이 절반 넘게 잘려(사이드바 360px에
             이름 몫이 ~150px뿐) 두 줄로 나눈다. 1줄=식별·조작, 2줄=검사명. -->
        <div class="px-3 py-2.5">
          <div class="flex items-center gap-2">
            <!-- 색은 인라인 style — 모듈 symbolColor가 팔레트 밖 색이라
                 대응하는 Tailwind 클래스가 없다(ExamCreateModal과 같은 방식).
                 클래스명을 문자열로 조합하면 Tailwind가 스캔하지 못한다. -->
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              style="background-color: {g.dotColor}"
            ></span>
            <span class="shrink-0 text-body-02-normal-bold text-chrome-fg"
              >{g.code}</span
            >
            <!-- 확인완료가 아닌 검사만 상태를 표시한다 (대부분은 확인완료라 노이즈) -->
            {#if g.status !== 'confirmed'}
              <span
                class="shrink-0 rounded bg-orange-500/10 px-1.5 py-0.5 text-label-02-normal-semibold text-orange-300 ring-1 ring-orange-500/25"
              >
                {statusLabel(g.status)}
              </span>
            {/if}
            <button
              type="button"
              onclick={() => onOpenResult(g)}
              class="ml-auto shrink-0 rounded-lg px-1.5 py-1 text-label-02-normal-medium text-chrome-fg-2 transition-colors hover:bg-chrome-hover hover:text-chrome-fg"
              title="검사 결과 전체보기"
            >
              전체보기
            </button>
            <button
              type="button"
              onclick={() => onToggleCollapse(g.examId)}
              class="shrink-0 rounded p-1 text-chrome-fg-3 transition-colors hover:text-chrome-fg"
              aria-label={isOpen ? '접기' : '펼치기'}
              aria-expanded={isOpen}
            >
              <!-- 통짜 chevron을 뒤집는 대신 두 획이 평평해졌다 반대로 꺾인다 —
                   펼침/접힘이라는 동작 자체를 보여준다. -->
              <ChevronToggle open={isOpen} size={16} />
            </button>
          </div>
          <!-- 검사명은 헤더 폭 전체를 쓴다. 긴 이름도 대개 여기서 다 들어간다 -->
          <p class="mt-1 truncate text-label-01-reading-regular text-chrome-fg-3">
            {g.nameKo} · {g.date}
          </p>
        </div>

        <!-- ── 소속 에셋 ── -->
        {#if isOpen}
          <!-- 펼칠 때 높이가 0에서 자란다. 자료가 여러 개면 한 번에 튀어나오는데,
               슬라이드가 있으면 어느 섹션이 열렸는지 눈이 따라간다. -->
          <div transition:slide={slideCfg}>
            {#if g.items.length === 0}
              <p class="px-3 pb-3 text-label-01-reading-regular text-chrome-fg-3">
                {assetsLoading
                  ? '자료 불러오는 중…'
                  : '첨부 가능한 자료가 없습니다.'}
              </p>
            {:else}
              <div
                class="grid grid-cols-2 gap-2 border-t border-chrome-line p-2.5"
              >
                {#each g.items as a (a.id)}
                  {@const attached = isAttached(a.id, a.src)}
                  <!-- 말풍선 앵커 — 이 자료 박스 기준으로 오른쪽에 띄운다 -->
                  <div class="relative">
                  <button
                    type="button"
                    draggable={!attached && !!onAssetDragStart}
                    ondragstart={(e) => {
                      if (attached || !onAssetDragStart) return
                      e.dataTransfer?.setData('text/plain', a.name)
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
                      onAssetDragStart(g, a)
                    }}
                    onclick={(e) =>
                      attached
                        ? onAttachedClick(a, e)
                        : onAssetClick(g, a)}
                    title={attached
                      ? '이미 본문에 첨부됨 (다시 누르면 위치 확인·제거)'
                      : ''}
                    class="group relative flex w-full flex-col gap-1.5 rounded-lg p-2 text-left transition-colors {attached
                      ? 'bg-chrome-hover ring-1 ring-chrome-line'
                      : 'bg-chrome-sunken hover:bg-chrome-hover'}"
                  >
                    <div class="relative">
                      {#if a.kind === 'image' && a.src}
                        <!-- 보고서 크롭 이미지: 흰 바탕 위 차트 — 상단 정렬로 잘라 보여줌 -->
                        <img
                          src={a.src}
                          alt={a.name}
                          loading="lazy"
                          class="h-24 w-full rounded bg-white object-contain p-0.5 ring-1 ring-chrome-line transition-opacity {attached
                            ? 'opacity-55'
                            : ''}"
                        />
                      {:else if a.kind === 'table' && a.table?.rows?.length}
                        <!-- 실제 표 미리보기 — 합성 막대가 아니라 그 자료의 머리글·앞 행을
                             그대로 그린다. 데이터는 이미 들고 있었는데(AssetItem.table)
                             썸네일이 안 쓰고 있었다. 눌러 본문에 넣기 전에 무엇인지 읽힌다. -->
                        <div
                          class="h-24 w-full overflow-hidden rounded bg-white ring-1 ring-chrome-line transition-opacity {attached
                            ? 'opacity-55'
                            : ''}"
                        >
                          <table class="w-full table-fixed border-collapse">
                            <thead>
                              <tr>
                                {#each a.table.headers.slice(0, 3) as h}
                                  <th
                                    class="truncate-safe px-1 py-[3px] text-left text-[7px] leading-[9px] font-semibold text-white"
                                    style="background:{a.color ?? '#64748b'}"
                                  >
                                    {h}
                                  </th>
                                {/each}
                              </tr>
                            </thead>
                            <tbody>
                              {#each a.table.rows.slice(0, 6) as row}
                                <tr class="border-b border-chrome-line/60">
                                  {#each row.slice(0, 3) as cell}
                                    <td
                                      class="truncate-safe px-1 py-[2px] text-[7px] leading-[9px] text-chrome-fg-muted"
                                    >
                                      {cell}
                                    </td>
                                  {/each}
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        </div>
                      {:else}
                        <div
                          class="transition-opacity {attached
                            ? 'opacity-55'
                            : ''}"
                        >
                          <ChartThumb
                            variant={a.kind === 'table'
                              ? 'table'
                              : (a.chart ?? 'bar')}
                            color={a.color ?? '#64748b'}
                            seed={a.id.length + a.name.length}
                          />
                        </div>
                      {/if}
                      <!-- 첨부됨 표시 — 같은 자료를 두 번 넣는 실수를 막는다 -->
                      {#if attached}
                        <span
                          class="absolute top-1 right-1 flex items-center gap-0.5 rounded-full bg-chrome-sunken px-1.5 py-0.5 text-label-02-normal-semibold text-chrome-fg backdrop-blur-sm"
                        >
                          <svg
                            class="h-2.5 w-2.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M4 12.5 L9.5 18 L20 6.5" />
                          </svg>
                          첨부됨
                        </span>
                      {/if}
                    </div>
                    <span
                      class="w-full truncate text-body-03-normal-medium {attached ? 'text-chrome-fg-2' : 'text-chrome-fg'}"
                    >
                      {a.name}
                    </span>
                    {#if a.hint}
                      <span
                        class="w-full truncate text-label-01-normal-regular text-chrome-fg-3"
                      >
                        {a.hint}
                      </span>
                    {/if}
                  </button>

                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </section>
    {/each}
  </div>
{/if}
