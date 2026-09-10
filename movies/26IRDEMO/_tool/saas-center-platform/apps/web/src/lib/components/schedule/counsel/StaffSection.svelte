<script lang="ts">
  import type { MemberListItem } from '$root/src/lib/hooks/actions/member.action'

  import Typography from '@common/components/Typography.svelte'
  import MemberChip from '$lib/components/common/MemberChip.svelte'

  interface Props {
    isCounselor: boolean
    memberList: Array<MemberListItem>
    selectedMember: MemberListItem[]
    onToggleMember: (member: MemberListItem) => void
    /** 대표 담당자 ID. 지정되면 대표 UI (주황 왕관) 활성화. */
    primaryMemberId?: string | null
    /** 대표 지정 콜백. primaryMemberId 와 함께 전달되어야 대표 지정 UI 활성화. */
    onSetPrimary?: (member: MemberListItem) => void
    /** 자체 라벨(제목+안내문구) 노출 여부. 외부에서 라벨을 그릴 땐 false */
    showTitle?: boolean
  }

  let {
    isCounselor,
    memberList,
    selectedMember,
    onToggleMember,
    primaryMemberId = null,
    onSetPrimary,
    showTitle = true
  }: Props = $props()

  const RECEIVE_RETURN_TO = '/counseling/receive'

  const primarySupported = $derived(!!onSetPrimary)

  let autoSelected = $state<boolean>(false)

  $effect(() => {
    if (
      !autoSelected &&
      isCounselor &&
      memberList.length === 1 &&
      selectedMember.length === 0
    ) {
      onToggleMember(memberList[0])
      autoSelected = true
    }
  })
</script>

<section>
  {#if showTitle}
    <Typography
      variant="title-01-normal-semibold"
      className={primarySupported ? 'mb-2' : 'mb-3'}
    >
      담당자 <span class="field-required">*</span>
    </Typography>
    {#if primarySupported}
      <!-- 안내 = Reading(150%) 행간 (§Typography — wrap 대비). 모달과 동일 문구·규격 -->
      <Typography
        variant="body-03-reading-regular"
        color="text-body-subtle"
        className="mb-4"
      >
        처음 선택한 담당자가 대표 치료사로 지정돼요. 왕관 아이콘을 눌러 대표
        치료사를 변경할 수 있어요.
      </Typography>
    {/if}
  {/if}
  {#if memberList.length}
    <div class="flex flex-wrap gap-2">
      {#each memberList as member}
        {@const isSelected = !!selectedMember.find((m) => m.id === member.id)}
        {@const isPrimary = primarySupported && primaryMemberId === member.id}
        <MemberChip
          name={member.person.name}
          selected={isSelected && !isPrimary}
          primary={isPrimary}
          onclick={() => onToggleMember(member)}
          oncrownclick={primarySupported
            ? () => onSetPrimary?.(member)
            : undefined}
          primaryLabel="대표(주 치료사)"
          selectedLabel="보조 치료사"
        />
      {/each}
    </div>
  {:else}
    <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <Typography
        variant="body-02-regular"
        color="text-gray-600"
        className="mb-2"
      >
        등록된 구성원 없습니다. 구성원 관리에서 먼저 등록해주세요.
      </Typography>
      <a
        href="/member?returnTo={encodeURIComponent(RECEIVE_RETURN_TO)}"
        class="text-body-02-normal-medium text-primary-500 underline underline-offset-2 hover:text-primary-600"
      >
        구성원 관리로 이동
      </a>
    </div>
  {/if}
</section>
