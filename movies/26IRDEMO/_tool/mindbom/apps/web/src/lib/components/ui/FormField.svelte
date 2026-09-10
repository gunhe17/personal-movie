<script lang="ts" module>
  /**
   * 폼 필드 공통 클래스 — 모달·페이지 폼에서 입력 요소 생김새를 한 곳에 둔다.
   *
   * 예전엔 모달마다 긴 클래스 문자열을 손으로 복붙해서 h-10/h-11,
   * text-sm/text-body-02가 섞였다. 새 입력을 만들 땐 이 상수를 쓴다.
   *
   * 높이 44(h-11)는 정본 §2-3 표준이고 Select·DatePickerInput도 같은 값이라,
   * 한 줄에 나란히 놓았을 때 밑변이 맞는다.
   */
  export const FIELD_INPUT_CLASS =
    'h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-body-02-normal-regular text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-1 focus:ring-primary-400'

  /**
   * 보조 문구(note·hint) 크기 — 12px(label-02).
   * caption-01(10px)은 뱃지·아바타 이니셜처럼 고정 크기 UI 안의 글자 전용이라
   * 읽는 문장에는 쓰지 않는다(app.css §caption-01 주석).
   */
  export const FIELD_HELP_CLASS = 'text-label-02-normal-regular text-gray-400'

  /**
   * textarea — 높이는 rows로 정하고 사용자 리사이즈는 막는다(resize-none).
   * 손잡이로 늘리면 모달 레이아웃이 깨지고, 바디 스크롤과 싸운다.
   *
   * leading-relaxed를 얹는 이유: body-02 토큰은 line-height가 15px(=글자 크기)라
   * 한 줄 입력에 맞춰져 있다. 여러 줄인 textarea에 그대로 쓰면 줄이 서로 붙는다.
   */
  export const FIELD_TEXTAREA_CLASS =
    'w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-body-02-normal-regular leading-relaxed text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-primary-400 focus:ring-1 focus:ring-primary-400'
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    label,
    /** 지정하면 <label for>로 연결된다. Select처럼 input이 아닌 건 생략. */
    id = '',
    required = false,
    /** 라벨 아래 보조 설명 (예: "복수 선택 시 배터리로 등록됩니다") */
    note = '',
    /** 입력 아래 보조 설명 */
    hint = '',
    children
  }: {
    label: string
    id?: string
    required?: boolean
    note?: string
    hint?: string
    children: Snippet
  } = $props()
</script>

{#snippet labelInner()}
  {label}{#if required}<span class="text-red-500"> *</span>{/if}
{/snippet}

<!--
  세로 간격은 여기 한 곳에서만 준다 — 라벨/note/입력/hint가 각자 margin을 들면
  조합에 따라 간격이 달라진다(note 있을 때만 벌어지는 식).
  라벨→note는 좁게(gap-1), 라벨묶음→입력은 표준 6px(gap-1.5).
-->
<div class="flex flex-col gap-1.5">
  <div class="flex flex-col gap-1">
    {#if id}
      <label for={id} class="block text-body-02-normal-medium text-gray-700">
        {@render labelInner()}
      </label>
    {:else}
      <!-- Select 등 네이티브 폼 컨트롤이 아닌 경우 for로 못 묶으므로 span -->
      <span class="block text-body-02-normal-medium text-gray-700">
        {@render labelInner()}
      </span>
    {/if}

    {#if note}
      <p class={FIELD_HELP_CLASS}>{note}</p>
    {/if}
  </div>

  {@render children()}

  {#if hint}
    <p class={FIELD_HELP_CLASS}>{hint}</p>
  {/if}
</div>
