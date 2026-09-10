<script lang="ts">
  /**
   * DetailPageHeader — 상세 페이지 최상단 (뒤로가기 + 우측 액션).
   *
   * 🔴 대상의 이름을 여기 다시 쓰지 않는다. 2분할 상세에서는 좌측
   *    ProfileCard의 아바타 아래 이름이 곧 페이지 타이틀 역할을 하므로,
   *    위에 h1을 또 두면 같은 정보가 화면에 두 번 나온다.
   *    → 이 줄은 "어디서 왔는지"(목록으로 돌아가는 길)만 책임진다.
   *
   * 리스트 페이지의 PageTitleSection과 같은 높이 44를 유지해, 목록↔상세를
   * 오갈 때 아래 콘텐츠의 시작 위치가 튀지 않게 한다.
   */
  import type { Snippet } from 'svelte'
  import Icon from '$components/ui/Icon.svelte'

  interface Props {
    /** 뒤로 갈 목록 경로 */
    backHref: string
    /** 뒤로가기 링크 문구 (예: '내담자 목록') */
    backLabel: string
    /** 우측 액션 버튼들 */
    actions?: Snippet
    class?: string
  }

  let { backHref, backLabel, actions, class: className = '' }: Props = $props()
</script>

<div class="flex min-h-11 shrink-0 items-center justify-between gap-3 {className}">
  <a
    href={backHref}
    class="inline-flex items-center gap-1 text-body-02-normal-medium text-gray-500 transition-colors hover:text-gray-700"
  >
    <Icon name="chevron_left" size="sm" />
    {backLabel}
  </a>

  {#if actions}
    <div class="flex shrink-0 items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>
