<script lang="ts">
  /**
   * FilterResetButton — 리스트 페이지 필터 바의 "필터 초기화" 아이콘 버튼.
   *
   * 참조 프로젝트(docs/reference/web) clients 페이지의 초기화 버튼과 형태를
   * 맞췄다. 라벨 텍스트 없이 정사각 h-11 w-11이고, 테두리·배경이 옆의
   * Select·검색창과 같아(border-gray-200 bg-white) 필터 바의 한 칸으로 읽힌다.
   * 참조 프로젝트에 라벨이 붙은 변형(FilterResetButton)도 있지만, 리스트
   * 화면에서 쓰는 건 이 아이콘 전용 쪽이다.
   *
   * 아이콘만 있으면 뜻이 안 보이므로 Tooltip으로 이름을 준다(참조와 동일).
   * hover 시 180° 회전은 참조의 시그니처 모션.
   *
   * disabled는 "지울 필터가 없음"을 뜻한다. 눌러도 아무 일도 일어나지 않는
   * 버튼을 살려두면 사용자가 무반응을 고장으로 읽는다.
   */
  import Refresh from '$lib/assets/icons/Refresh.svelte'
  import Tooltip from './Tooltip.svelte'

  let {
    onclick,
    disabled = false,
    label = '필터 초기화'
  }: {
    onclick?: () => void
    disabled?: boolean
    label?: string
  } = $props()
</script>

<Tooltip text={label} {disabled}>
  <button
    type="button"
    {onclick}
    {disabled}
    aria-label={label}
    class="group flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white transition-colors {disabled
      ? 'cursor-default text-gray-300'
      : 'text-gray-500 hover:bg-gray-50'}"
  >
    <span
      class="flex transition-transform duration-300 {disabled
        ? ''
        : 'group-hover:rotate-180'}"
    >
      <Refresh size={24} />
    </span>
  </button>
</Tooltip>
