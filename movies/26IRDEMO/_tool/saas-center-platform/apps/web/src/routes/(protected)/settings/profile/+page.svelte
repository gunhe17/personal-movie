<script lang="ts">
  import { fade } from 'svelte/transition'
  import PageTitleSection from '$lib/components/PageTitleSection.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'

  const isOverlayMode = $derived(!responsive.isDesktop)

  // 내 정보: 센터별 프로필(이름, 연락처 등) 조회/수정
  // 계정 정보(/settings/account-info)와 역할 구분: 계정 = 로그인·탈퇴·보안, 내 정보 = 프로필
</script>

<div
  in:fade
  class="mx-auto flex max-w-[1200px] flex-col {isOverlayMode
    ? 'px-4 pt-4 pb-8'
    : 'pt-8 pb-[66px]'}"
>
  <PageTitleSection title="내 정보" className="mb-4" />

  <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
    <p class="text-body-02-normal-regular text-gray-500">
      내 정보(프로필) 수정 기능은 준비 중입니다.
    </p>
  </div>
</div>
