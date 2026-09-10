<script lang="ts">
  /**
   * BrandMark — 마인드봄 워드마크.
   *
   * 인증 화면 6곳(login·signup·forgot/reset-password·accept-invite·
   * select-institution)이 같은 마크업을 리터럴로 복붙하고 있었다. 로고는
   * 한 곳에서만 바뀌어야 하는 자산이라 컴포넌트로 뺐다.
   *
   * 🔴 아이콘(파란 사각형 안 뇌 그림)을 두지 않는다. 정식 심볼이 아니라
   *    자리를 채우려고 넣은 것이었고, 앱 헤더는 처음부터 텍스트 워드마크만
   *    쓰고 있었다 — 인증 화면에만 아이콘이 붙어 표기가 갈려 있었다.
   *    심볼이 생기면 그때 여기 한 곳에 넣는다.
   *
   * 표기는 헤더와 같은 `MindBom`이다(로고타입은 번역하지 않는다).
   *
   * 색은 브랜드 primary-500(#2979FF). 참조 프로젝트 로고는 #4C87F6인데
   * 우리 팔레트의 400(#68A0FF)과 500 사이라 딱 맞는 단계가 없다 —
   * raw hex를 새로 들이는 대신 브랜드 primary를 쓴다(정본 §Do: raw hex 금지).
   */
  interface Props {
    /** 링크로 감쌀 경로. 주지 않으면 텍스트만 렌더한다. */
    href?: string
    /**
     * md(20) = 앱 헤더 — 화면에서 가장 큰 글자다.
     * sm(18) = 인증 카드 — 바로 아래 제목이 20이라, 로고를 20으로 두면
     *          같은 크기가 나란히 놓여 위계가 사라진다.
     */
    size?: 'sm' | 'md'
    class?: string
  }

  let { href, size = 'md', class: className = '' }: Props = $props()

  let sizeCls = $derived(
    size === 'sm' ? 'text-title-01-semibold' : 'text-headline-02-normal-bold'
  )
</script>

{#if href}
  <a
    {href}
    class="inline-block {sizeCls} text-primary-500 transition-colors hover:text-primary-600 {className}"
  >
    MindBom
  </a>
{:else}
  <span class="inline-block {sizeCls} text-primary-500 {className}">MindBom</span>
{/if}
