<script lang="ts">
  import FieldNoteView from './FieldNoteView.svelte'
  import type { FieldNoteService } from '$lib/features/field-note/field-note-service'
  import { fly, fade } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'

  interface Props {
    /** 필드노트를 조회할 일정(schedule) ID */
    scheduleId: string
    /** 필드노트 서비스 인스턴스 */
    service: FieldNoteService
    /** 화자 편집 후보 이름들 (상담사·내담자) */
    participantCandidates?: string[]
    /** 열 때 보여줄 탭 */
    initialTab?: 'transcript' | 'memo' | 'analysis'
    /** 닫기 (X 버튼) */
    onClose: () => void
  }

  let {
    scheduleId,
    service,
    participantCandidates = [],
    initialTab = 'transcript',
    onClose
  }: Props = $props()
</script>

<!-- 필드노트 플로팅 시트: 배경 클릭·ESC로 닫히지 않고 X(닫기) 버튼으로만 닫힘 (보며 작성용).
     높이 = LNB '스케줄' 항목 높이까지 (내담자 기준이던 808에서 메뉴 한 칸 ≈ 56 키움).
     래퍼는 위치 계산 전용이므로 pointer-events-none — 이게 없으면 fixed inset-0이
     화면 전체를 덮어 뒤쪽 일지에 포커스가 가지 않는다. 시트 본체만 클릭을 받는다. -->
<div
  class="pointer-events-none fixed inset-0 z-[60] flex items-end justify-start p-6 pb-0"
  transition:fade={{ duration: 150 }}
  role="presentation"
>
  <div
    class="pointer-events-auto flex h-[85vh] max-h-[864px] w-[600px] max-w-full flex-col overflow-hidden rounded-t-[20px] shadow-[0_2px_20px_0_rgba(0,0,0,0.16)] backdrop-blur-[11.2px]"
    style="background: linear-gradient(143.63deg, rgba(34, 234, 191, 0.04), rgba(68, 134, 255, 0.04)), #ffffff;"
    transition:fly={{ y: 24, duration: 240, easing: cubicOut }}
    role="dialog"
    tabindex="-1"
  >
    <FieldNoteView
      {scheduleId}
      {service}
      {participantCandidates}
      {initialTab}
      onBack={onClose}
    />
  </div>
</div>
