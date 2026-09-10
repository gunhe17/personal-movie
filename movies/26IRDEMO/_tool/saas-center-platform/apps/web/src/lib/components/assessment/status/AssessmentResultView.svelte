<script lang="ts">
  /**
   * 검사 결과(채점·해석) 뷰 — 보고서 PDF와 별개로 점수·하위척도를 보여준다.
   *
   * 검사 상세 패널(스텝 2)과 소견 작성 모드의 [결과] 세그먼트가 공유한다.
   */
  import Typography from '@common/components/Typography.svelte'
  import SandGlass54 from '$lib/assets/SandGlass54.svelte'
  import GoodThumbIcon54 from '$lib/assets/GoodThumbIcon54.svelte'
  import WarningIcon54 from '$lib/assets/WarningIcon54.svelte'
  import ErrorBellIcon54 from '$lib/assets/ErrorBellIcon54.svelte'
  import type { AssessmentItem } from '$lib/features/assessment/status-detail/types'

  let { assessment } = $props<{ assessment: AssessmentItem }>()
</script>

{#if assessment.status === 'pending' || assessment.status === 'in_progress'}
  <div
    class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
  >
    <div class="mb-4"><SandGlass54 /></div>
    <Typography
      variant="title-01-normal-semibold"
      color="text-title-default"
      className="mb-2"
    >
      결과 데이터가 없어요
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-body-subtle"
      className="text-center"
    >
      검사가 제출되면 결과를 확인할 수 있어요.
    </Typography>
  </div>
{:else if assessment.status === 'refused'}
  <div
    class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
  >
    <Typography
      variant="body-02-regular"
      color="text-gray-500"
      className="text-center"
    >
      거부된 검사입니다.
    </Typography>
  </div>
{:else if assessment.status === 'cancelled'}
  <div
    class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
  >
    <Typography
      variant="body-02-regular"
      color="text-gray-500"
      className="text-center"
    >
      이 검사는 중단되었어요.
      {#if assessment.cancelledReason}
        <span class="block mt-3 text-gray-400 text-xs">
          사유: {assessment.cancelledReason}
        </span>
      {/if}
    </Typography>
  </div>
{:else}
  {@const payload = assessment.reportPayload as
    | Record<string, unknown>
    | null
    | undefined}
  {@const scoring = payload?.scoring as
    | {
        total_score?: number
        max_total_score?: number
        subscales?: Record<
          string,
          { name?: string; raw_score?: number; max_score?: number }
        >
      }
    | undefined}
  {@const interpretation = payload?.interpretation as
    | {
        summary?: string
        risk_label?: string
        risk_level?: string
        description?: string
        recommendations?: string[]
        subscales?: Record<string, string>
      }
    | undefined}
  {#if !payload || (!scoring && !interpretation)}
    <div
      class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
    >
      <div class="mb-4"><SandGlass54 /></div>
      <Typography
        variant="title-01-normal-semibold"
        color="text-title-default"
        className="mb-2"
      >
        결과 데이터가 없어요
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-body-subtle"
        className="text-center"
      >
        내담자가 검사를 제출하면 자동으로 결과가 생성됩니다.
      </Typography>
    </div>
  {:else}
    <div class="flex flex-1 flex-col px-8 py-6 overflow-auto">
      <div class="rounded-lg bg-gray-50 p-6 sm:p-8 border border-gray-200">
        {#if interpretation}
          <div class="flex flex-col items-center text-center mb-6">
            <div
              class="flex justify-center mb-4 [&>svg]:h-13.5 [&>svg]:w-auto"
              aria-hidden="true"
            >
              {#if interpretation.risk_level === 'high'}
                <ErrorBellIcon54 />
              {:else if interpretation.risk_level === 'low'}
                <GoodThumbIcon54 />
              {:else}
                <WarningIcon54 />
              {/if}
            </div>
            {#if interpretation.description}
              <Typography
                variant="body-01-reading-regular"
                color="text-gray-800"
                className="leading-relaxed"
              >
                {interpretation.description}
              </Typography>
            {/if}
          </div>
        {/if}
        <div class="rounded-lg bg-white">
          <table class="w-full min-w-100 border-separate border-spacing-0">
            <thead>
              <tr class="bg-[#F7F7F7]">
                <th
                  class="border border-gray-200 border-b border-r border-t border-l px-4 py-3 text-center text-sm font-semibold text-gray-900 rounded-tl-lg"
                  >항목</th
                >
                <th
                  class="border border-gray-200 border-b border-r border-t px-4 py-3 text-center text-sm font-semibold text-gray-900"
                  >해당군</th
                >
                <th
                  class="border border-gray-200 border-b border-r border-t px-4 py-3 text-center text-sm font-semibold text-gray-900 rounded-tr-lg"
                  >내점수/전체점수</th
                >
              </tr>
            </thead>
            <tbody>
              <tr class="bg-white">
                <td
                  class="border border-gray-200 border-b border-r border-l px-4 py-3 text-center text-sm font-normal text-gray-900"
                  >스마트폰 과의존</td
                >
                <td
                  class="border border-gray-200 border-b border-r px-4 py-3 text-center text-sm font-normal text-gray-900"
                >
                  {interpretation?.risk_label ?? '—'}
                </td>
                <td
                  class="border border-gray-200 border-b border-r px-4 py-3 text-center text-sm font-normal text-gray-900"
                >
                  {#if scoring && typeof scoring.total_score === 'number' && typeof scoring.max_total_score === 'number'}
                    {scoring.total_score}/{scoring.max_total_score}
                  {:else}
                    —
                  {/if}
                </td>
              </tr>
              <tr class="bg-white">
                <td
                  colspan="3"
                  class="border border-gray-200 border-b border-r border-l px-4 py-4 align-top rounded-bl-lg rounded-br-lg"
                >
                  <h3 class="text-base font-semibold text-gray-900 mb-2">
                    검사 결과
                  </h3>
                  {#if interpretation?.subscales && Object.keys(interpretation.subscales).length > 0}
                    <ul
                      class="list-disc list-inside text-sm text-gray-700 space-y-1 mb-3 leading-relaxed"
                    >
                      {#each Object.entries(interpretation.subscales) as [name, text]}
                        <li>
                          <span class="font-medium text-gray-900"
                            >{name}:</span
                          >
                          {text}
                        </li>
                      {/each}
                    </ul>
                  {/if}
                  <!-- 스마트폰 중독검사 결과 보기에서는 권장사항 미표시 -->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
{/if}
