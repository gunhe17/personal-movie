<script lang="ts">
  /**
   * ProfileCard — 상세 페이지 좌측 프로필 카드 (2분할 레이아웃의 좌측).
   *
   * 정본 §콘텐츠 컨테이너 표준의 "콘텐츠 카드" — p-6 고정, radius 16.
   * 구성 순서는 참조 프로젝트 관례를 따른다:
   *   아바타 80 (상단 중앙) → gap16 → 이름 + 부가정보 → [헤더 끝]
   *   → mt-6 + 상단 구분선 → 레이블+데이터 → (추가 섹션)
   *
   * 헤더는 고정이고 본문만 스크롤한다 — 카드가 화면 높이를 넘어도
   * 이름·아바타는 항상 보인다.
   *
   * '수정' 같은 카드 스코프 액션은 흐름에서 빼내 우상단에 절대배치한다
   * (아바타 중앙 정렬을 깨지 않으려고).
   */
  import type { Snippet } from 'svelte'
  import PersonAvatar, { type AvatarRole } from '$components/ui/PersonAvatar.svelte'

  interface Props {
    name: string
    gender?: string | null
    role?: AvatarRole
    profileUrl?: string | null
    /** 이름 옆에 인라인으로 붙는 것 (코드·인증 배지 등) */
    nameSuffix?: Snippet
    /** 이름 아래 한 줄 (생년월일 │ 성별 등) */
    subline?: Snippet
    /** 카드 우상단 액션 (수정 버튼 등) */
    headerAction?: Snippet
    /** 스크롤되는 본문 */
    children: Snippet
    class?: string
  }

  let {
    name,
    gender = null,
    role = 'client',
    profileUrl = null,
    nameSuffix,
    subline,
    headerAction,
    children,
    class: className = ''
  }: Props = $props()
</script>

<section
  class="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-card {className}"
>
  <!-- 헤더 — 고정 -->
  <div class="relative flex shrink-0 flex-col items-center gap-4">
    {#if headerAction}
      <div class="absolute right-0 top-0">
        {@render headerAction()}
      </div>
    {/if}

    <PersonAvatar {name} {gender} {role} {profileUrl} size={80} />

    <div class="flex flex-col items-center gap-2">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <h1 class="text-headline-02-normal-semibold text-gray-900">{name}</h1>
        {#if nameSuffix}
          {@render nameSuffix()}
        {/if}
      </div>
      {#if subline}
        <div class="flex flex-wrap items-center justify-center gap-2">
          {@render subline()}
        </div>
      {/if}
    </div>
  </div>

  <!--
    본문 — 여기서만 스크롤한다. 좌우 -mx-6/px-6은 스크롤바가 카드 안쪽
    가장자리에 붙게 하려는 것(내용은 여전히 24 인셋).
  -->
  <div class="-mx-6 mt-6 min-h-0 flex-1 overflow-y-auto px-6">
    {@render children()}
  </div>
</section>
