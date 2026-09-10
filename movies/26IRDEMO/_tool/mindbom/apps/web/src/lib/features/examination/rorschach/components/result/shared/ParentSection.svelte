<script lang="ts">
  interface Props {
    title: string
    mainColor?: string
    headerClass?: string
    headerTextColor?: string
    class?: string
    children: import('svelte').Snippet
  }

  let {
    title,
    mainColor = '#3B82F6',
    headerClass = '',
    headerTextColor,
    class: className = '',
    children,
  }: Props = $props()

  let isDefault = $derived(mainColor === '#3B82F6')
  let hasDarkHeader = $derived(headerClass.includes('bg-gray-'))

  let textColor = $derived(
    headerTextColor
      ? headerTextColor
      : hasDarkHeader
        ? '#FFFFFF'
        : isDefault
          ? '#FFFFFF'
          : mainColor,
  )

  let borderColor = $derived(isDefault ? '#DBEAFE' : mainColor)
  let headerBg = $derived(
    hasDarkHeader ? '' : isDefault ? mainColor : `${mainColor}1A`,
  )
</script>

<!--
  **테두리 규칙 — 바깥은 섹션이, 안쪽은 표가.**

  섹션이 프레임(위·오른쪽, 바깥 컨테이너가 왼쪽·아래를 보탠다)을 그리고,
  안의 표는 **칸 사이 구분선만** 그린다. 표의 마지막 행·마지막 칸은 선을
  그리지 않는다(`last:border-b-0` / `last:border-r-0`).

  예전에는 둘 다 바깥 선을 그려서 1px짜리 두 줄이 나란히 섰다. 각 컴포넌트는
  자기 안에서 옳았고, **맞닿는 자리에서만 틀렸다** — 한 곳만 고치면 다른 표에
  같은 것이 남는다. 그래서 규칙을 여기 한 줄로 적는다.
-->
<div class="border-t border-r {className}" style="border-color: {borderColor};">
  <!-- `shrink-0` — 부모가 flex 컬럼일 때 헤더가 눌려 글자가 잘리는 것을 막는다 -->
  <div
    class="flex shrink-0 items-center justify-center h-6 {headerClass}"
    style="background: {headerBg}; border-bottom: 1px solid {mainColor};"
  >
    <p class="text-xs font-semibold" style="color: {textColor};">{title}</p>
  </div>
  {@render children()}
</div>
