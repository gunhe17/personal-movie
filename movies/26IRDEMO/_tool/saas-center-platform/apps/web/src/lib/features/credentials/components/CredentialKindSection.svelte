<!--
  CredentialKindSection
  학력/경력/자격 하나의 섹션
  - 빈 상태: 안내 + 회색 [+ 추가하기] 버튼 (근무 일정 섹션과 동일 패턴)
  - 데이터 있을 때: 항목 리스트 + 마지막에 [+ 추가] 카드
-->
<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'

  import { KIND_EMPTY_LABEL } from '../constants'
  import type { CredentialGroup, CredentialItemVM } from '../view-model'
  import CredentialItemRow from './CredentialItemRow.svelte'

  interface Props {
    group: CredentialGroup
    readOnly?: boolean
    /** 빈 상태 문구 오버라이드 (미지정 시 KIND_EMPTY_LABEL 사용) */
    emptyLabel?: string
    onAdd?: () => void
    onEdit?: (item: CredentialItemVM) => void
    onDelete?: (item: CredentialItemVM) => void
    onRequestVerification?: (item: CredentialItemVM) => void
    onAttachmentClick?: (item: CredentialItemVM) => void
    /**
     * 섹션 타이틀 크기. 기본 M(18) — 구성원 상세처럼 섹션이 화면의 주 콘텐츠일 때.
     * 내 정보처럼 우측 탭 안의 하위 섹션이면 true(16)로 한 단계 낮춘다.
     */
    compactTitle?: boolean
  }

  let {
    group,
    readOnly = false,
    emptyLabel,
    onAdd,
    onEdit,
    onDelete,
    onRequestVerification,
    onAttachmentClick,
    compactTitle = false
  }: Props = $props()
</script>

<section class="flex flex-col gap-3">
  <!-- 섹션 타이틀 행 (Web_Design.md §패턴): 타이틀 + gap 4 + 카운트, 아래 콘텐츠와 gap 12.
       타이틀은 정본(headline-02/20)보다 한 단계 작은 title-01(18) — 탭 내부라 한 급 낮춘다.
       행 높이 24는 구성원 상세 세 탭 공통 규격 -->
  <header class="flex h-6 items-center gap-1">
    <Typography
      variant={compactTitle ? 'title-02-semibold' : 'title-01-normal-semibold'}
      color="text-gray-800"
    >
      {group.label}
    </Typography>
    <span class="text-body-03-normal-regular text-gray-500">
      {group.items.length}
    </span>
    {#if !readOnly}
      <!-- 추가 = 섹션 타이틀의 액션 (별도 영역 없이 아이콘+텍스트) -->
      <button
        type="button"
        onclick={onAdd}
        class="ml-auto flex items-center gap-2 text-action-primary transition-colors hover:text-action-primary-hover"
      >
        <PlusIcon20 />
        <Typography variant="body-02-normal-medium" color="text-current">
          추가
        </Typography>
      </button>
    {/if}
  </header>

  {#if group.items.length === 0}
    <!-- 빈 상태: readOnly면 높이 120 고정, 편집 가능하면 추가 버튼 위해 넉넉히 -->
    <div
      class="flex-center flex-col gap-3 bg-gray-50 rounded-lg {readOnly
        ? 'h-30'
        : 'min-h-40'}"
    >
      <Typography variant="body-01-medium" color="text-gray-500">
        {emptyLabel ?? KIND_EMPTY_LABEL[group.credential_type]}
      </Typography>
      {#if !readOnly}
        <!-- button-white · Medium(40): 높이 40 · 좌우 24 · 아이콘 20 · 레이블 15 -->
        <button
          type="button"
          onclick={onAdd}
          class="flex-center h-10 gap-2 rounded-lg bg-white px-6 text-title-subtitle ring-1 ring-inset ring-transparent transition-colors hover:text-body-strong hover:ring-gray-200"
        >
          <PlusIcon20 />
          <Typography variant="body-02-normal-medium" color="text-current">
            추가
          </Typography>
        </button>
      {/if}
    </div>
  {:else}
    <ul class="flex flex-col gap-3">
      {#each group.items as item (item.id)}
        <li>
          <CredentialItemRow
            {item}
            {readOnly}
            {onEdit}
            {onDelete}
            {onRequestVerification}
            {onAttachmentClick}
          />
        </li>
      {/each}
    </ul>
  {/if}
</section>
