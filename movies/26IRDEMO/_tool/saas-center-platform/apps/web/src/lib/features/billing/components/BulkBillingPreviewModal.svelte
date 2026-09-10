<script lang="ts">
  import { onMount } from 'svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { requireCenterId } from '$lib/stores/center.store'
  import {
    getTodayMissingBillables,
    type BillableTarget
  } from '$lib/hooks/actions/billable.action'
  import { getPriceListsByReferences } from '$lib/hooks/actions/priceList.action'

  interface Props {
    closeModal?: () => void
  }
  let { closeModal = () => {} }: Props = $props()

  type ClientGroup = {
    clientId: string
    name: string
    sessionCount: number
    amount: number
    unpricedSessions: number
  }

  let loading = $state(true)
  let groups = $state<ClientGroup[]>([])
  let totalSessions = $state(0)

  const grandTotal = $derived(groups.reduce((s, g) => s + g.amount, 0))
  const unpricedTotal = $derived(
    groups.reduce((s, g) => s + g.unpricedSessions, 0)
  )

  onMount(async () => {
    try {
      const centerId = requireCenterId()
      const targets: BillableTarget[] =
        await getTodayMissingBillables().request({ centerId })
      totalSessions = targets.length

      // 모든 회기의 단가 참조를 한 번에 조회 (references → 단가표 unit_price)
      const allRefIds = [
        ...new Set(
          targets.flatMap((t) => t.references.map((r) => r.reference_id))
        )
      ]
      let priceMap = new Map<string, number>()
      if (allRefIds.length > 0) {
        const matched = await getPriceListsByReferences().request({
          centerId,
          referenceIds: allRefIds
        })
        priceMap = new Map(
          matched
            .filter((p) => p.reference_id)
            .map((p) => [p.reference_id!, p.unit_price ?? 0])
        )
      }

      // 내담자별 묶기 (한 내담자 = 청구서 1개 예정)
      const map = new Map<string, ClientGroup>()
      for (const t of targets) {
        if (!t.client_id) continue
        const g =
          map.get(t.client_id) ??
          ({
            clientId: t.client_id,
            name: t.client_name ?? '-',
            sessionCount: 0,
            amount: 0,
            unpricedSessions: 0
          } satisfies ClientGroup)
        g.sessionCount += 1
        let sessionAmount = 0
        for (const ref of t.references) {
          sessionAmount += priceMap.get(ref.reference_id) ?? 0
        }
        if (sessionAmount === 0) g.unpricedSessions += 1
        g.amount += sessionAmount
        map.set(t.client_id, g)
      }
      groups = [...map.values()].sort((a, b) => b.amount - a.amount)
    } finally {
      loading = false
    }
  })

  const won = (n: number) => `₩${n.toLocaleString('ko-KR')}`
</script>

<!-- bodyClass p-0! : 상단 요약을 sticky로 고정해야 해서 패딩을 내부 섹션이 소유한다
     (좌우·상단 20, footer가 없으므로 하단만 28 — §Components>modal) -->
<BaseModal title="미청구 예상금액" size="lg" bodyClass="p-0!" {closeModal}>
  {#snippet body()}
    <!-- footer 없는 조회 전용 — 본문 하단 40(§Components>modal) -->
    <div class="pb-10">
      {#if loading}
        <div class="flex items-center justify-center px-5 py-16">
          <Typography variant="body-01-normal-regular" color="text-gray-500">
            불러오는 중...
          </Typography>
        </div>
      {:else if groups.length === 0}
        <div
          class="flex flex-col items-center justify-center px-5 py-16 text-center"
        >
          <Typography variant="body-01-normal-semibold" color="text-gray-700">
            청구할 건이 없어요
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-400"
            className="mt-1.5 block"
          >
            오늘까지 진행된 미청구건이 없습니다.
          </Typography>
        </div>
      {:else}
        <!-- 통계 3칸 — 규격 정본 = 내담자 상세 바우처 탭(VoucherDetailPanel):
             블록 rounded-xl + p-4, 블록 간 gap 12 (보더 대신 bg-gray-50 면으로 구분),
             레이블 body-02-medium(title-subtle) → gap 12 → 값 headline-02-semibold
             → gap 4 → 단위 body-02-regular(body-subtle).
             sticky: 본문 전체가 스크롤될 때 상단 고정 -->
        <div class="sticky top-0 z-10 bg-white px-5 pt-5 pb-6">
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-xl bg-gray-50 p-4">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="block"
              >
                미청구건
              </Typography>
              <div class="mt-3 flex items-baseline gap-1">
                <Typography
                  variant="headline-02-normal-semibold"
                  color="text-title-default"
                >
                  {totalSessions}
                </Typography>
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-subtle"
                >
                  건
                </Typography>
              </div>
            </div>

            <div class="rounded-xl bg-gray-50 p-4">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="block"
              >
                청구서
              </Typography>
              <div class="mt-3 flex items-baseline gap-1">
                <Typography
                  variant="headline-02-normal-semibold"
                  color="text-title-default"
                >
                  {groups.length}
                </Typography>
                <Typography
                  variant="body-02-normal-regular"
                  color="text-body-subtle"
                >
                  개
                </Typography>
              </div>
            </div>

            <div class="rounded-xl bg-gray-50 p-4">
              <Typography
                variant="body-02-normal-medium"
                color="text-title-subtitle"
                className="block"
              >
                예상 청구액
              </Typography>
              <div class="mt-3 flex items-baseline gap-1">
                <!-- 금액만 mint — 청구 도메인 강조색(§5.1). 크기·간격은 규격 그대로 -->
                <Typography
                  variant="headline-02-normal-semibold"
                  color="text-mint-500"
                >
                  {won(grandTotal)}
                </Typography>
              </div>
            </div>
          </div>
        </div>

        <!-- footer 없는 조회 전용 모달 — 본문 하단만 28(§Components>modal, 좌우·상단은 20) -->
        <div class="px-5 pb-10">
          {#if unpricedTotal > 0}
            <div
              class="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3"
            >
              <span class="mt-0.5 text-amber-700" aria-hidden="true">!</span>
              <Typography
                variant="body-02-normal-regular"
                color="text-amber-700"
              >
                단가가 설정되지 않은 {unpricedTotal}건이 0원으로 집계됐어요.
                청구 전 단가표를 확인해 주세요.
              </Typography>
            </div>
          {/if}

          <!-- 표 설명 — 아래 표가 무엇을 기준으로 계산된 값인지 알려준다 -->
          <Typography
            variant="body-02-normal-regular"
            color="text-gray-500"
            className="mb-3 block"
          >
            현재 미청구된 <span
              class="text-body-02-normal-medium text-body-strong"
              >{totalSessions}</span
            >건을 기준으로 계산한 예상 금액이에요.
          </Typography>

          <!-- 내담자별 내역.
               3열 비율 고정(2:0.7:1) — 항목은 "N건"만 담아 좁게 — 옛 [1fr_auto_auto]는 내담자가 남는 폭을 다 먹어
               항목·금액이 우측 끝에 붙어 버렸다. 항목은 내담자 바로 옆(좌측)에 둔다.
               셀 구분은 세로선(border-r) — 셀 사이 간격은 각 셀의 px-4가 만든다(gap 없음). -->
          <div class="overflow-hidden rounded-lg border border-gray-200">
            <div
              class="grid grid-cols-[2fr_0.7fr_1fr] border-b border-gray-200 bg-gray-50"
            >
              <div class="border-r border-gray-200 px-4 py-2.5">
                <Typography
                  variant="body-03-normal-medium"
                  color="text-gray-500"
                >
                  내담자
                </Typography>
              </div>
              <div class="border-r border-gray-200 px-4 py-2.5">
                <Typography
                  variant="body-03-normal-medium"
                  color="text-gray-500"
                >
                  항목
                </Typography>
              </div>
              <div class="px-4 py-2.5">
                <Typography
                  variant="body-03-normal-medium"
                  color="text-gray-500"
                >
                  예상 금액
                </Typography>
              </div>
            </div>
            <div>
              {#each groups as g (g.clientId)}
                <div
                  class="grid grid-cols-[2fr_0.7fr_1fr] border-b border-gray-100 last:border-0"
                >
                  <div
                    class="flex min-w-0 items-center gap-2 border-r border-gray-100 px-4 py-3"
                  >
                    <Typography
                      variant="body-01-normal-medium"
                      color="text-gray-800"
                      className="min-w-0 truncate-safe"
                    >
                      {g.name}
                    </Typography>
                    {#if g.unpricedSessions > 0}
                      <span
                        class="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-label-02-normal-medium text-amber-700"
                      >
                        단가 미설정 {g.unpricedSessions}
                      </span>
                    {/if}
                  </div>
                  <div
                    class="flex items-center border-r border-gray-100 px-4 py-3"
                  >
                    <Typography
                      variant="body-02-normal-regular"
                      color="text-gray-600"
                    >
                      {g.sessionCount}건
                    </Typography>
                  </div>
                  <div class="flex items-center px-4 py-3">
                    <!-- 표의 금액은 Medium — 상단 요약(20/SemiBold)이 이 화면의 강조점이고
                         표는 그 내역이라, 여기까지 SemiBold면 강조가 두 곳이 된다 -->
                    <Typography
                      variant="body-01-normal-medium"
                      color="text-body-strong"
                    >
                      {won(g.amount)}
                    </Typography>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/snippet}
</BaseModal>
