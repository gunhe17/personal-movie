<script lang="ts">
  /**
   * 구성원 상세 · 담당 상담/검사 카드.
   *
   * 규격은 발명하지 않는다 — Web_Design.md가 정본:
   *   ① 내담자 최소 단위 = 아바타 40 + gap 12 + [이름 / gap 8 / 생년월일|성별]
   *   ② 구분선 `<hr class="my-4 border-gray-100">` (위아래 16)
   *   ③ 레이블+데이터(가로형) §Layout — 레이블 열 auto · 레이블↔값 24 · 행 높이 20 · 행간 8
   *      레이블 `body-01-normal-regular` gray-600 / 값 동일 variant gray-900 (빈값 gray-400 '-')
   * 카드 껍데기(radius 12 · 보더 · p-5 · 우측 셰브론)는 내담자 상세 진행현황 카드와 동일.
   * 다른 것은 관점뿐 — 내담자 상세는 담당자를, 여기(구성원 상세)는 내담자를 보여준다.
   */
  import Typography from '@common/components/Typography.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import type { CaseHistoryItem } from '$lib/features/members'

  interface Props {
    item: CaseHistoryItem
    /** 카드 클릭 시 케이스 상세로 이동 */
    onNavigate: (item: CaseHistoryItem) => void
    /** 다음 일정 포맷터 (KST 변환은 호출부 소유) */
    formatNext: (iso: string) => string | null
  }

  let { item, onNavigate, formatNext }: Props = $props()

  const isCounseling = $derived(item.kind === 'counseling')

  // 제목: 세트가 아닌 다건 검사는 "첫 검사명 외 N건"으로 축약 (내담자 상세와 동일)
  const displayTitle = $derived(
    item.kind === 'assessment' && !item.isSet && item.assessmentNames.length > 1
      ? `${item.assessmentNames[0]} 외 ${item.assessmentNames.length - 1}건`
      : item.title
  )

  const progressUnit = $derived(isCounseling ? '회기' : '건')
  const nextLabel = $derived(item.nextStart ? formatNext(item.nextStart) : null)

  // 상담 케이스의 '완료'는 종결 — 상담 카드·필터 탭과 용어를 맞춘다(검사는 '완료' 그대로)
  const statusText = $derived(
    isCounseling && item.statusText === '완료' ? '종결' : item.statusText
  )

  // 레이블+데이터 행. 값이 없으면 gray-400 '-' (Web_Design.md 빈값 규칙).
  // 세트 배지는 두지 않는다 — 배지 높이 24가 행 높이 20 규격을 깬다.
  const rows = $derived.by(() => {
    // 프로그램명과 진행률은 별도 행 — 한 셀에 합치면 2열 카드 폭(약 270)에서
    // 값이 잘린다(실측). 기준 카드(CounselingCard)도 진행률을 별도 행으로 둔다.
    const list = [
      {
        label: isCounseling ? '프로그램' : '검사',
        value: displayTitle,
        empty: false
      },
      {
        label: '진행률',
        value:
          item.total > 0
            ? `${item.completed}/${item.total} ${progressUnit}`
            : '-',
        empty: item.total === 0
      }
    ]
    // 장소 — 상담·검사 공통(검사도 일정에 배정된 상담실이 있다).
    // 순서: 프로그램·검사 → 진행률 → 장소 → 일정
    list.push({
      label: '장소',
      value: item.roomName ?? '-',
      empty: !item.roomName
    })
    list.push({
      label: isCounseling ? '다음 상담일' : '검사 일정',
      value: nextLabel ?? '-',
      empty: !nextLabel
    })
    return list
  })
</script>

<!-- 카드 전체가 케이스 상세로 가는 링크 -->
<button
  type="button"
  onclick={() => onNavigate(item)}
  class="flex h-full w-full flex-col rounded-xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
>
  <div class="flex min-w-0 flex-1 flex-col">
    <!-- ① 내담자 최소 단위 (케이스 코드는 노출하지 않는다) -->
    <div class="flex min-w-0 items-center gap-3">
      <ClientAvatar
        profileImageUrl={item.clientProfileImageUrl}
        name={item.clientName}
        gender={item.clientGender}
        sizeClass="h-10 w-10"
        textClass="text-body-02-normal-medium"
      />
      <!-- 이름 ↔ [생년월일|성별] 간격 8 — 내담자 카드 계열 공통 규격 -->
      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex min-w-0 items-center gap-1">
          <Typography
            variant="title-01-normal-semibold"
            color="text-title-default"
            className="truncate-safe"
            tag="span"
          >
            {item.clientName}
          </Typography>
          {#if item.clientCount > 1}
            <Typography
              variant="body-02-normal-regular"
              color="text-body-default"
              className="shrink-0 whitespace-nowrap"
              tag="span"
            >
              외 {item.clientCount - 1}명
            </Typography>
          {/if}
        </div>
        {#if item.clientCount <= 1}
          <ClientBirthGender
            birthDate={item.clientBirthDate}
            gender={item.clientGender}
          />
        {/if}
      </div>

      <!-- 케이스 상태 배지 — 타이틀(내담자 정보) 행의 우측 끝, 그 행 기준 세로 가운데.
           ml-auto로 카드 오른쪽 끝까지 밀고, 행의 items-center가 세로 중앙을 맡는다.
           포맷은 내담자 상세 진행현황 카드(CaseHistoryCard)와 동일 -->
      <span
        class="ml-auto inline-flex h-8 min-w-[63px] shrink-0 items-center justify-center rounded-[100px] px-3 text-body-03-normal-regular {item.statusClass}"
      >
        {statusText}
      </span>
    </div>

    <hr class="my-4 border-gray-100" />

    <!-- ② 레이블+데이터 (가로형) — Web_Design.md §Layout 정본:
         레이블 열 auto(가장 넓은 레이블 기준) · 레이블↔값 24 · 행 높이 20 · 행간 8 -->
    <dl
      class="grid flex-1 grid-cols-[auto_1fr] auto-rows-[20px] content-start items-center gap-x-6 gap-y-2"
    >
      {#each rows as row (row.label)}
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          {row.label}
        </Typography>
        <Typography
          variant="body-02-normal-regular"
          color={row.empty ? 'text-gray-400' : 'text-gray-900'}
          className="min-w-0 truncate-safe"
        >
          {row.value}
        </Typography>
      {/each}
    </dl>
  </div>
</button>
