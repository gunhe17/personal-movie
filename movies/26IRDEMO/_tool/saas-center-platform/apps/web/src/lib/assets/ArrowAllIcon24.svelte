<!--
  Figma SaaS V.2 통합 · Icon_24 / Property 1=Arrow_all (node 3592:274886)
  아래를 가리키는 듀오톤 이중 화살촉 — 위(옅은 화살촉)가 지나간 값, 아래(primary-400)가
  바뀔 값. '기존 → 변경'처럼 위아래로 놓인 두 값 사이의 전이를 가리키는 자리에 쓴다.
  에셋 원본 hex(#E5EEFF·#68A0FF)가 팔레트의 primary-100·primary-400과 정확히 같아
  hex 대신 토큰 클래스로 칠한다(듀오톤이라 currentColor는 못 쓴다).
  위 화살촉만 primary-200으로 한 단 내린다(2026-09-08) — 원본 primary-100은 이 아이콘이
  놓이는 brand-subtle 틴트 면 위에서 거의 사라져 이중 화살촉으로 읽히지 않았다.
-->
<script lang="ts">
  let { size = 24, className = '' }: { size?: number; className?: string } =
    $props()
</script>

<svg
  class={className}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path
    d="M21 7.47208L21 2L12.3041 7.47208L3 2L3 7.47208L12.3041 13L21 7.47208Z"
    class="fill-primary-200"
  />
  <path
    d="M21 16.4721L21 11L12.3041 16.4721L3 11L3 16.4721L12.3041 22L21 16.4721Z"
    class="fill-primary-400"
  />
</svg>
