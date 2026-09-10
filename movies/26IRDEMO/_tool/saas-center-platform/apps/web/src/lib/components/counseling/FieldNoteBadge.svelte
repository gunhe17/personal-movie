<script lang="ts">
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import FieldnoteIcon16 from '$lib/assets/FieldnoteIcon16.svelte'
  import FieldnoteIcon20 from '$lib/assets/FieldnoteIcon20.svelte'

  /**
   * "이 회기엔 쓸 수 있는 필드노트가 있다" 한 가지만 알린다.
   *
   * 녹음 중·처리 중·실패는 전문가앱이 알리고 거기서 푼다 — 웹은 **사용 가능한 것만** 보여준다.
   * 상태를 색으로 가르지 않으므로 Round(상태 인디케이터)가 아니라 **Rectangle(정보 라벨)**이다
   * (Web_Design.md §Components>badge). 규격은 공용 `BadgeRectangle`이 소유한다.
   *
   * 좁은 자리(좌측 회기 리스트 행)는 배지가 안 들어가 아이콘만 남긴다 — 네이티브 20 그대로.
   */
  interface Props {
    iconOnly?: boolean
  }

  let { iconOnly = false }: Props = $props()

  const LABEL = '필드노트 있음'
</script>

{#if iconOnly}
  <span class="flex shrink-0 items-center" title={LABEL} aria-label={LABEL}>
    <FieldnoteIcon20 />
  </span>
{:else}
  <!-- Rectangle S(24) + 아이콘 16 — §Components>badge 공통 규약(아이콘 16 · gap 4) -->
  <BadgeRectangle label="필드노트" color="blue">
    {#snippet icon()}
      <FieldnoteIcon16 />
    {/snippet}
  </BadgeRectangle>
{/if}
