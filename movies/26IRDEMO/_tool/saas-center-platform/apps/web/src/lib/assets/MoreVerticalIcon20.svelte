<!--
  더보기(세로 3점) 아이콘 20×20.
  점이 뷰박스 정중앙(cx=10, cy 4/10/16)에 놓여 있어 감싸는 버튼에서 별도 위치 보정이 필요 없다.
  fill=currentColor라 버튼의 text-* / hover:text-* 를 그대로 따라간다.
-->
<script lang="ts">
  interface Props {
    class?: string
  }
  let { class: className = '' }: Props = $props()
</script>

<svg
  class={className}
  width="20"
  height="20"
  viewBox="0 0 20 20"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <circle cx="10" cy="4" r="1.5" fill="currentColor" />
  <circle cx="10" cy="10" r="1.5" fill="currentColor" />
  <circle cx="10" cy="16" r="1.5" fill="currentColor" />
</svg>
