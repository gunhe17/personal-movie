<script lang="ts">
  /**
   * AuthShell — 로그인·회원가입 등 인증 화면의 공통 셸.
   *
   * 6개 화면(login·signup·forgot/reset-password·accept-invite·
   * select-institution)이 배경·카드·로고·제목 블록을 리터럴로 복붙하고
   * 있었다. 임의값도 함께 퍼졌다 — `bg-[#f8f8f8]`(팔레트 밖)·
   * `max-w-[480px]`·카드 `rounded-xl`(정본 카드는 16=rounded-2xl).
   *
   * 규격
   *   배경 : bg-gray-50 (#F5F7F8) — 정본 bg-base
   *   카드 : rounded-2xl + border-gray-200 + shadow-card + p-8
   *   폭   : 480 기본, wide로 540 (login처럼 폼이 넓은 화면)
   *
   * 앱 안쪽 화면과 달리 카드 패딩이 32(p-8)다 — 정본의 콘텐츠 카드 24는
   * 정보 밀도가 높은 표면 기준이고, 인증 화면은 단일 폼이라 더 여유를 준다.
   */
  import type { Snippet } from 'svelte'
  import BrandMark from '$components/ui/BrandMark.svelte'

  interface Props {
    /** 카드 제목 (로그인 · 회원가입 …) */
    title: string
    /** 제목 아래 설명 한두 줄 */
    description?: string
    /** 폼이 넓은 화면(login)은 540 */
    wide?: boolean
    /** 카드 아래 중앙 링크 줄 (약관·로그인으로 돌아가기 등) */
    footer?: Snippet
    children: Snippet
  }

  let { title, description, wide = false, footer, children }: Props = $props()
</script>

<div
  class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 sm:px-6 sm:py-12"
>
  <div class="w-full {wide ? 'max-w-135' : 'max-w-120'}">
    <div class="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-card">
      <!--
        링크를 걸지 않는다 — 이 셸은 로그인 전(signup)·후(select-institution)
        화면이 함께 쓴다. 어디로 보내도 한쪽에는 어긋난다.
      -->
      <BrandMark size="sm" class="mb-6" />

      <h1 class="text-headline-02-semibold text-gray-900">{title}</h1>
      {#if description}
        <p class="mt-2 text-body-03-regular text-gray-500">{description}</p>
      {/if}

      <div class="mt-6">
        {@render children()}
      </div>
    </div>

    {#if footer}
      <div
        class="mt-8 flex items-center justify-center gap-2 text-body-03-regular text-gray-400"
      >
        {@render footer()}
      </div>
    {/if}
  </div>
</div>
