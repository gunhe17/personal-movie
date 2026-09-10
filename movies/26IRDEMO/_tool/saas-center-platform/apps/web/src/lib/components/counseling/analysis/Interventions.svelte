<script lang="ts">
  // 개입과 반응 — 슈퍼비전에서 가장 값이 나는 자리.
  // 데이터가 없으면 빈 표를 세우지 않고, 왜 없는지와 어떻게 하면 생기는지를 알린다.
  //
  // 🔴 용어는 **'개입'**이다 (2026-09-03 재교정). 한때 '써본 방법'으로 풀어 썼는데,
  // 이건 과교정이었다 — 걷어낼 대상은 번역투 **조어**(치료적 동맹·정서 추세·개입의
  // 효과성)이지 현장에서 매일 쓰는 전문어가 아니다. 상담사는 슈퍼비전에서 "이번 회기
  // 개입은"이라고 말한다. 전문가용 도구가 전문어를 풀어 쓰면 정확도만 잃는다 —
  // '방법'은 개입보다 넓고 흐릿해서, 무엇을 세는 표인지가 헐거워진다.
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import Evidence from './Evidence.svelte'
  import type { CaseReportVM } from '$lib/features/counseling/analysis/view-model'

  let {
    report,
    onSelectSession
  }: { report: CaseReportVM; onSelectSession?: (session: number) => void } =
    $props()

  const EFFECT_COLOR: Record<string, 'green' | 'amber' | 'red' | 'gray'> = {
    높음: 'green',
    보통: 'amber',
    낮음: 'red',
    '판단 어려움': 'gray',
    // 2026-08 이전 저장분 호환 — 옛 프롬프트가 쓰던 값
    '평가 보류': 'gray'
  }
</script>

{#if report.interventions.length > 0}
  <div class="overflow-x-auto">
    <table class="w-full min-w-[720px] border-collapse">
      <thead>
        <tr class="border-b border-border-default">
          {#each [['개입 기법', 'w-44'], ['횟수', 'w-20'], ['회기', 'w-44'], ['반응', ''], ['효과', 'w-28']] as [label, w]}
            <th
              class="h-11 pr-3 pl-6 text-left text-body-02-normal-medium text-title-subtitle {w}"
            >
              {label}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each report.interventions as it}
          <tr class="border-b border-border-subtle align-top last:border-b-0">
            <td
              class="py-4 pr-3 pl-6 text-body-01-normal-medium text-body-strong"
            >
              {it.name}
            </td>
            <td
              class="py-4 pr-3 pl-6 text-body-02-normal-regular text-body-subtle"
            >
              {it.count ? `${it.count}회` : '-'}
            </td>
            <td class="py-4 pr-3 pl-6">
              <Evidence
                sessions={it.sessions}
                label={null}
                onSelect={onSelectSession}
              />
            </td>
            <td class="py-4 pr-3 pl-6">
              {#if it.response}
                <p class="text-body-02-reading-regular text-body-default">
                  {it.response}
                </p>
              {/if}
              {#if it.evidence}
                <p class="mt-1 text-body-03-reading-regular text-body-subtle">
                  {it.evidence}
                </p>
              {/if}
            </td>
            <td class="py-4 pr-3 pl-6">
              {#if it.effect}
                <BadgeRectangle
                  label={it.effect}
                  color={EFFECT_COLOR[it.effect] ?? 'gray'}
                />
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <div class="px-6 py-5">
    <p class="text-body-01-reading-regular text-body-default">
      상담일지에 어떤 개입을 했는지가 적혀 있지 않아 이 표를 만들 수 없어요.
    </p>
    <p class="mt-2 text-body-02-reading-regular text-body-subtle">
      회기를 녹음하면 개입이 일지에 남고, 다음 분석부터 개입별 효과가 이 자리에
      표로 나와요.
    </p>
  </div>
{/if}
